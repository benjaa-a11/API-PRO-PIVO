export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  method?: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly bodySnippet?: string;

  constructor(status: number, url: string, message?: string, bodySnippet?: string) {
    super(message ?? `HTTP ${status} fetching ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.bodySnippet = bodySnippet;
  }
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 408 || (status >= 500 && status <= 599);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? 8000;
  const retries = options.retries ?? 2;
  const method = options.method ?? 'GET';

  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
    'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
    ...options.headers,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      const snippet = await response
        .text()
        .then((t) => t.slice(0, 220))
        .catch(() => '');

      const err = new HttpError(
        response.status,
        url,
        `HTTP ${response.status} from ${url}`,
        snippet,
      );

      if (!shouldRetryStatus(response.status) || attempt === retries) {
        throw err;
      }

      lastError = err;
    } catch (err) {
      lastError = err;
      if (err instanceof HttpError && !shouldRetryStatus(err.status)) {
        throw err;
      }
      if (attempt === retries) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }

    const jitter = Math.floor(Math.random() * 120);
    await sleep(160 * (attempt + 1) + jitter);
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchJson<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T> {
  const res = await fetchWithRetry(url, {
    ...options,
    headers: {
      Accept: 'application/json, text/plain, */*',
      ...options.headers,
    },
  });
  const text = await res.text();
  if (!text || !text.trim()) {
    throw new Error(`Empty JSON body from ${url}`);
  }
  return JSON.parse(text) as T;
}

export async function fetchText(
  url: string,
  options: FetchOptions = {},
): Promise<string> {
  const res = await fetchWithRetry(url, {
    ...options,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      ...options.headers,
    },
  });
  return res.text();
}

/**
 * Extrae el JSON embebido dentro de `<script id="__NEXT_DATA__">...</script>` en HTML de Promiedos.
 */
export function extractPromiedosNextData<T = Record<string, unknown>>(
  html: string,
): T | null {
  if (!html) return null;
  const match =
    /<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as T;
  } catch {
    return null;
  }
}

/**
 * Extrae un objeto JSON balanceado inmediatamente después de un marcador JS (por ej. `window['__espnfitt__']=`).
 * Evita backtracking de expresiones regulares sobre HTML grande de ESPN.
 */
export function extractJsonObjectAfterMarker<T = Record<string, unknown>>(
  html: string,
  marker: string,
): T | null {
  if (!html) return null;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) return null;

  const startBrace = html.indexOf('{', markerIndex + marker.length);
  if (startBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startBrace; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonSlice = html.slice(startBrace, i + 1);
        try {
          return JSON.parse(jsonSlice) as T;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

export function extractEspnFittData<T = Record<string, unknown>>(
  html: string,
): T | null {
  return (
    extractJsonObjectAfterMarker<T>(html, "window['__espnfitt__']=") ??
    extractJsonObjectAfterMarker<T>(html, 'window["__espnfitt__"]=') ??
    extractJsonObjectAfterMarker<T>(html, "window['__espnfitt__'] =")
  );
}
