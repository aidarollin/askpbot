import { RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW_MS } from "./config";

/**
 * In-memory sliding-window rate limiter, keyed by client IP.
 *
 * Known limitation, stated plainly: this is per-instance. Every isolate — a
 * Cloudflare Worker instance here, a serverless instance elsewhere — keeps its
 * own counter, so the effective limit across N warm instances is
 * N x RATE_LIMIT_REQUESTS. That is fine for a demo whose purpose is to stop one
 * tab from hammering the API, and wrong for real abuse prevention. The correct
 * fix is a shared store with the same interface — Cloudflare KV or a Durable
 * Object, now that Workers is the target — and `check()` is deliberately shaped
 * so that swap is a one-file change.
 */

const hits = new Map<string, number[]>();

/** Drop keys whose entire window has expired, so the Map cannot grow forever. */
function sweep(now: number): void {
  for (const [key, times] of hits) {
    if (times.length === 0 || now - times[times.length - 1] > RATE_LIMIT_WINDOW_MS) {
      hits.delete(key);
    }
  }
}

let lastSweep = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the caller may retry. Only meaningful when blocked. */
  retryAfterSeconds: number;
}

export function check(key: string): RateLimitResult {
  const now = Date.now();

  // Amortised cleanup — at most once per window, not on every request.
  if (now - lastSweep > RATE_LIMIT_WINDOW_MS) {
    sweep(now);
    lastSweep = now;
  }

  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const times = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (times.length >= RATE_LIMIT_REQUESTS) {
    hits.set(key, times);
    const oldest = times[0];
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000)),
    };
  }

  times.push(now);
  hits.set(key, times);
  return {
    allowed: true,
    remaining: RATE_LIMIT_REQUESTS - times.length,
    retryAfterSeconds: 0,
  };
}

/**
 * Best-effort client identity. Behind a platform proxy the real client address
 * is the first entry of x-forwarded-for; `request.ip` is not available in the
 * Node runtime. On Cloudflare, `cf-connecting-ip` is the more trustworthy
 * header and is worth preferring once this actually runs there. Falls back to a
 * shared bucket when no header is present, which is the safe direction
 * (over-limiting an unknown caller, not under-limiting).
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
