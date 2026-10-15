import type { Request } from "express";

// Railway's edge proxy overwrites X-Real-IP with the visitor's address
// (checked 2026-10-14: forged X-Real-IP / X-Forwarded-For values are
// replaced), whereas req.ip resolves to one of Railway's own edge proxies, so
// keying limits on req.ip lumped unrelated visitors together. Off Railway
// (e.g. local dev) nothing overwrites the header, so it isn't trusted there.
// GET /api/admin/whoami shows what the server sees if this needs rechecking.
const ON_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT_ID;

// The visitor's IP, used for rate limits and the admin login lockout.
export function getClientIp(req: Request): string {
  if (ON_RAILWAY) {
    const realIp = req.headers["x-real-ip"];
    if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
