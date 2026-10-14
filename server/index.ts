import "./instrument";
import * as Sentry from "@sentry/node";
import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    // The chat widget is designed to be iframe-embedded on arbitrary client
    // websites, and widget.js/API responses must be loadable cross-origin from
    // those sites — so framing and cross-origin resource restrictions are off.
    // CSP is off too since the Vite-built React bundle isn't nonce-based yet.
    contentSecurityPolicy: false,
    frameguard: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);
// Optionally restrict which sites may embed this deployment's widget, so
// another site can't put a client's bot (and its OpenAI budget) on its pages.
// Comma-separated origins, e.g. "https://acme.com,https://www.acme.com".
const widgetAllowedOrigins = (process.env.WIDGET_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map(o => o.trim())
  .filter(o => /^https?:\/\/[^\s;,'"]+$/.test(o));
if (widgetAllowedOrigins.length > 0) {
  const policy = `frame-ancestors 'self' ${widgetAllowedOrigins.join(" ")}`;
  app.use((req, res, next) => {
    if (req.path === "/widget" || req.path === "/widget/") {
      res.setHeader("Content-Security-Policy", policy);
    }
    next();
  });
}

app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);
    const status = err.status || err.statusCode || 500;
    // 4xx errors (bad JSON, body too large) are safe to describe; 5xx are not
    const message = status < 500 ? err.message : "Internal Server Error";
    if (status >= 500) console.error(err);
    res.status(status).json({ error: message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
