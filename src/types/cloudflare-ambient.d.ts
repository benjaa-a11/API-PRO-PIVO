/**
 * Declaraciones ambientales mínimas de Cloudflare Workers para entornos donde aún no se ejecutó `npm install`
 * (y por tanto `node_modules/@cloudflare/workers-types` no está presente).
 */

interface KVNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  get<ExpectedValue = unknown>(key: string, type: 'json'): Promise<ExpectedValue | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: { expiration?: number; expirationTtl?: number; metadata?: unknown },
  ): Promise<void>;
  delete(key: string): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}
