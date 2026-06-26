/**
 * EEXA Rate Limiter — Production Persistent
 * Backed by getStore() (Redis or LMDB) — survives restarts.
 * Zero in-memory Maps for rate limit state.
 */
import { getStore } from "./persist";

const NS_RL = "rl:";

export async function rateLimitAllow(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  const store = await getStore();
  const rec   = await store.increment(NS_RL + key, windowMs);
  return rec.count <= max;
}

export async function rateLimitStatus(
  key: string,
  max: number
): Promise<{ remaining: number; resetAt: number }> {
  const store = await getStore();
  const rec   = await store.get<{ count: number; resetAt: number }>(NS_RL + key);
  if (!rec) return { remaining: max, resetAt: Date.now() };
  return { remaining: Math.max(0, max - rec.count), resetAt: rec.resetAt };
}

// Named limiters — thin wrappers for clarity
export const globalLimiter  = { allow: (k: string, m: number, w: number) => rateLimitAllow(`global:${k}`, m, w) };
export const authLimiter    = { allow: (k: string, m: number, w: number) => rateLimitAllow(`auth:${k}`, m, w) };
export const analyzeLimiter = { allow: (k: string, m: number, w: number) => rateLimitAllow(`analyze:${k}`, m, w) };
export const uploadLimiter  = { allow: (k: string, m: number, w: number) => rateLimitAllow(`upload:${k}`, m, w) };
export const aiLimiter      = { allow: (k: string, m: number, w: number) => rateLimitAllow(`ai:${k}`, m, w) };

// Legacy compat — previously called initRateLimiters()
export async function initRateLimiters(): Promise<void> {
  await getStore(); // ensure store is initialized
  console.log("[rateLimiter] initialized — backed by persistent store");
}

// RedisStore and InMemoryStore types kept for import compat in tests
export class InMemoryStore { /* stub — no longer used for security */ }
export class RedisStore    { /* stub — backed by persist.ts */        }
export class RateLimiter   { /* stub — use rateLimitAllow directly */ }

export async function getRedisClient(): Promise<unknown> { return null; }
