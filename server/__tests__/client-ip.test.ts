import { describe, it, expect, vi, afterEach } from "vitest";

const req = (headers: Record<string, string>, ip = "100.64.0.2") =>
  ({ headers, ip, socket: { remoteAddress: ip } }) as any;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getClientIp", () => {
  it("uses Railway's X-Real-IP when running on Railway", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "env-123");
    const { getClientIp } = await import("../client-ip");
    expect(getClientIp(req({ "x-real-ip": "65.112.8.87" }, "152.233.47.67"))).toBe("65.112.8.87");
    expect(getClientIp(req({}, "152.233.47.67"))).toBe("152.233.47.67");
  });

  it("ignores X-Real-IP elsewhere, where a client could forge it", async () => {
    vi.stubEnv("RAILWAY_ENVIRONMENT_ID", "");
    const { getClientIp } = await import("../client-ip");
    expect(getClientIp(req({ "x-real-ip": "1.2.3.4" }, "127.0.0.1"))).toBe("127.0.0.1");
  });
});
