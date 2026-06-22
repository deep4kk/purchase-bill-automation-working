/**
 * Minimal in-memory TTL cache.
 *
 * Use for read-heavy values that change infrequently. Callers invalidate
 * explicitly after writes — there is no per-key TTL eviction beyond the
 * next call that finds a stale entry, which refreshes the value.
 */

import { findSuppliers } from "./dal";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

export async function ttlCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return hit.value;

  const value = await loader();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export function invalidate(key: string): void {
  store.delete(key);
}

export function invalidateAll(): void {
  store.clear();
}

const SUPPLIER_CACHE_KEY = "suppliers:active";
const SUPPLIER_TTL_MS = 60_000;

export interface CachedSupplier {
  id: string;
  name: string;
  gstin: string | null;
}

export async function getCachedSuppliers(): Promise<CachedSupplier[]> {
  return ttlCache(SUPPLIER_CACHE_KEY, SUPPLIER_TTL_MS, async () => {
    const result = await findSuppliers({}, { limit: 1000 });
    return result.data.map((s) => ({
      id: s._id.toHexString(),
      name: s.name,
      gstin: s.gstin ?? null,
    }));
  });
}

export function invalidateSupplierCache(): void {
  invalidate(SUPPLIER_CACHE_KEY);
}