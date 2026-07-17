import * as Sentry from "@sentry/node";

// Imported first (before express/routes) in index.ts so Sentry's ESM import
// hoisting guarantees this runs before the rest of the app initializes.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
}
