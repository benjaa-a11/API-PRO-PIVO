import type { EnvBindings } from '../types/schema.ts';

export type CacheStatus = 'HIT' | 'MISS' | 'STALE';

export interface CacheResult<T> {
  value: T;
  cache: CacheStatus;
  warning?: string;
}

export interface CacheGetOptions {
  staleTtlSeconds?: number;
  waitUntil?: (promise: Promise<unknown>) => void;
  bypassCache?: boolean;
}

interface StoredEnvelope<T> {
  value: T;
  createdAt: number;
  ttlMs: number;
  staleUntilMs: number;
}

export interface CacheStats {
  hits: number;
  staleHits: number;
  misses: number;
  errors: number;
  l1Size: number;
  inFlightSize: number;
  hitRate: number;
}

const DEFAULT_MAX_L1_ENTRIES = 450;

export class CacheManager {
  private readonly l1 = new Map<string, StoredEnvelope<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly maxEntries: number;

  private hits = 0;
  private staleHits = 0;
  private misses = 0;
  private errors = 0;

  constructor(maxEntries = DEFAULT_MAX_L1_ENTRIES) {
    this.maxEntries = maxEntries;
  }

  private getEdgeCache(): Cache | null {
    if (typeof caches === 'undefined') return null;
    const maybeCaches = caches as unknown as { default?: Cache };
    return maybeCaches?.default ?? null;
  }

  private edgeCacheKey(key: string): string {
    return `https://cache.api-pro-pivo.internal/v1/${encodeURIComponent(key)}`;
  }

  private setL1<T>(key: string, envelope: StoredEnvelope<T>): void {
    if (this.l1.has(key)) {
      this.l1.delete(key);
    } else if (this.l1.size >= this.maxEntries) {
      const oldestKey = this.l1.keys().next().value;
      if (oldestKey !== undefined) {
        this.l1.delete(oldestKey);
      }
    }
    this.l1.set(key, envelope);
  }

  private async readFromEdge<T>(key: string): Promise<StoredEnvelope<T> | null> {
    const edge = this.getEdgeCache();
    if (!edge) return null;
    try {
      const matched = await edge.match(this.edgeCacheKey(key));
      if (!matched) return null;
      const parsed = (await matched.json()) as StoredEnvelope<T>;
      if (!parsed || typeof parsed.createdAt !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeToEdge<T>(
    key: string,
    envelope: StoredEnvelope<T>,
    totalTtlSeconds: number,
  ): Promise<void> {
    const edge = this.getEdgeCache();
    if (!edge) return;
    try {
      const response = new Response(JSON.stringify(envelope), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${Math.max(5, Math.ceil(totalTtlSeconds))}`,
        },
      });
      await edge.put(this.edgeCacheKey(key), response);
    } catch {
      // Cache API puede rechazar en entornos sin HTTP host; ignorar sin romper flujo
    }
  }

  private async readFromKv<T>(
    key: string,
    env?: EnvBindings,
  ): Promise<StoredEnvelope<T> | null> {
    const kv = env?.FOOTBALL_KV;
    if (!kv) return null;
    try {
      const raw = await kv.get(key, 'json');
      if (!raw || typeof raw !== 'object') return null;
      const parsed = raw as StoredEnvelope<T>;
      if (typeof parsed.createdAt !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private async writeToKv<T>(
    key: string,
    envelope: StoredEnvelope<T>,
    totalTtlSeconds: number,
    env?: EnvBindings,
  ): Promise<void> {
    const kv = env?.FOOTBALL_KV;
    if (!kv) return;
    try {
      // Cloudflare KV exige expirationTtl >= 60 segundos
      const expirationTtl = Math.max(60, Math.ceil(totalTtlSeconds));
      await kv.put(key, JSON.stringify(envelope), { expirationTtl });
    } catch {
      // No fallar si se alcanza el límite diario del plan gratuito KV
    }
  }

  private async persistEverywhere<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    staleTtlSeconds: number,
    env?: EnvBindings,
  ): Promise<StoredEnvelope<T>> {
    const now = Date.now();
    const totalTtlSeconds = ttlSeconds + staleTtlSeconds;
    const envelope: StoredEnvelope<T> = {
      value,
      createdAt: now,
      ttlMs: now + ttlSeconds * 1000,
      staleUntilMs: now + totalTtlSeconds * 1000,
    };

    this.setL1(key, envelope);
    await Promise.allSettled([
      this.writeToEdge(key, envelope, totalTtlSeconds),
      this.writeToKv(key, envelope, totalTtlSeconds, env),
    ]);

    return envelope;
  }

  private triggerRevalidate<T>(
    key: string,
    ttlSeconds: number,
    staleTtlSeconds: number,
    fetcher: () => Promise<T>,
    env?: EnvBindings,
    waitUntil?: (promise: Promise<unknown>) => void,
  ): void {
    if (this.inFlight.has(key)) return;

    const task = (async () => {
      try {
        const fresh = await fetcher();
        await this.persistEverywhere(key, fresh, ttlSeconds, staleTtlSeconds, env);
      } catch {
        this.errors++;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, task);
    if (waitUntil) {
      waitUntil(task);
    }
  }

  async getOrFetch<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    options: CacheGetOptions = {},
    env?: EnvBindings,
  ): Promise<CacheResult<T>> {
    const staleTtlSeconds = options.staleTtlSeconds ?? Math.max(ttlSeconds * 4, 120);
    const now = Date.now();

    let bestEnvelope: StoredEnvelope<T> | null = null;

    if (!options.bypassCache) {
      const fromL1 = this.l1.get(key) as StoredEnvelope<T> | undefined;
      if (fromL1) {
        bestEnvelope = fromL1;
        // Refrescar posición LRU
        this.l1.delete(key);
        this.l1.set(key, fromL1);
      }

      if (!bestEnvelope || now > bestEnvelope.ttlMs) {
        const fromEdge = await this.readFromEdge<T>(key);
        if (fromEdge && (!bestEnvelope || fromEdge.createdAt > bestEnvelope.createdAt)) {
          bestEnvelope = fromEdge;
          this.setL1(key, fromEdge);
        }
      }

      if ((!bestEnvelope || now > bestEnvelope.ttlMs) && env?.FOOTBALL_KV) {
        const fromKv = await this.readFromKv<T>(key, env);
        if (fromKv && (!bestEnvelope || fromKv.createdAt > bestEnvelope.createdAt)) {
          bestEnvelope = fromKv;
          this.setL1(key, fromKv);
        }
      }

      if (bestEnvelope) {
        if (now <= bestEnvelope.ttlMs) {
          this.hits++;
          return { value: bestEnvelope.value, cache: 'HIT' };
        }
        if (now <= bestEnvelope.staleUntilMs) {
          this.staleHits++;
          this.triggerRevalidate(
            key,
            ttlSeconds,
            staleTtlSeconds,
            fetcher,
            env,
            options.waitUntil,
          );
          return { value: bestEnvelope.value, cache: 'STALE' };
        }
      }
    }

    // Deduplicación singleflight para solicitudes simultáneas sobre la misma clave
    const pending = this.inFlight.get(key) as Promise<T> | undefined;
    if (pending) {
      const value = await pending;
      this.hits++;
      return { value, cache: 'HIT' };
    }

    this.misses++;

    const loadPromise = (async () => {
      try {
        const fresh = await fetcher();
        const persisted = this.persistEverywhere(
          key,
          fresh,
          ttlSeconds,
          staleTtlSeconds,
          env,
        );
        if (options.waitUntil) {
          options.waitUntil(persisted);
        } else {
          await persisted;
        }
        return fresh;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, loadPromise);

    try {
      const value = await loadPromise;
      return { value, cache: 'MISS' };
    } catch (err) {
      this.errors++;
      // Degradación elegante: si existe un dato viejo en memoria/edge/KV, servirlo como respaldo
      if (bestEnvelope) {
        return {
          value: bestEnvelope.value,
          cache: 'STALE',
          warning: `Upstream refresh failed; serving stale fallback (${err instanceof Error ? err.message : String(err)})`,
        };
      }
      throw err;
    }
  }

  getStats(): CacheStats {
    const total = this.hits + this.staleHits + this.misses;
    return {
      hits: this.hits,
      staleHits: this.staleHits,
      misses: this.misses,
      errors: this.errors,
      l1Size: this.l1.size,
      inFlightSize: this.inFlight.size,
      hitRate: total > 0 ? Number(((this.hits + this.staleHits) / total).toFixed(3)) : 0,
    };
  }
}

export const sharedCache = new CacheManager();
