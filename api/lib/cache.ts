/**
 * EEXA Cache — backed by persist.ts (Redis or LMDB)
 * Zero in-memory Maps. Survives restart.
 */
import { getStore } from "./persist";

const NS = "cache:";

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const store = await getStore();
    return store.get<T>(NS + key);
  },
  async set<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
    const store = await getStore();
    await store.set(NS + key, value, ttlSeconds * 1000);
  },
  async del(key: string): Promise<void> {
    const store = await getStore();
    await store.del(NS + key);
  },
  async invalidatePattern(pattern: string): Promise<void> {
    const store = await getStore();
    const keys  = await store.keys(NS + pattern);
    for (const k of keys) await store.del(k);
  },
};

export const cacheKeys = {
  report:      (uid: string)    => `report:${uid}`,
  userReports: (userId: number) => `user_reports:${userId}`,
  company:     (id: number)     => `company:${id}`,
  user:        (uid: string)    => `user:${uid}`,
};
