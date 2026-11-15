import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { LEAGUE_MAPPINGS } from './config/mappings.ts';
import { footballService, type ServiceResult } from './services/fusion.ts';
import type { ApiResponse, EnvBindings } from './types/schema.ts';
import { buildOpenApiSpec, renderDashboardHtml } from './ui/dashboard.ts';
import { sharedCache } from './utils/cache.ts';
import { HttpError } from './utils/http.ts';

type AppEnv = { Bindings: EnvBindings };

const app = new Hono<AppEnv>();

const matchesQuerySchema = z.object({
  date: z.string().optional(),
  league: z.string().optional(),
  state: z.string().optional(),
  team: z.string().optional(),
  live: z.enum(['true', 'false', '1', '0']).optional(),
  refresh: z.enum(['true', 'false', '1', '0']).optional(),
});

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposeHeaders: ['X-API-Version', 'X-Cache', 'X-Sources', 'X-Response-Time'],
    maxAge: 86400,
  }),
);

function getWaitUntil(
  c: Context<AppEnv>,
): ((promise: Promise<unknown>) => void) | undefined {
  try {
    const ctx = c.executionCtx;
    if (ctx && typeof ctx.waitUntil === 'function') {
      return (promise: Promise<unknown>) => ctx.waitUntil(promise);
    }
  } catch {
    // Ejecución fuera de Cloudflare Workers runtime (p.ej. tests locales)
  }
  return undefined;
}

function isTruthyFlag(val?: string): boolean {
  return val === 'true' || val === '1';
}

function respondOk<T>(
  c: Context<AppEnv>,
  result: ServiceResult<T>,
  cacheControl = 'public, max-age=15, s-maxage=25, stale-while-revalidate=120',
) {
  const version = c.env?.API_VERSION ?? '1.0.0';
  const timezone = c.env?.DEFAULT_TIMEZONE ?? 'America/Argentina/Buenos_Aires';

  c.header('X-API-Version', version);
  c.header('X-Cache', result.cache);
  c.header('X-Sources', result.sources.join(','));
  c.header('X-Response-Time', `${result.tookMs}ms`);
  c.header('Cache-Control', cacheControl);

  const body: ApiResponse<T> = {
    ok: true,
    data: result.data,
    meta: {
      version,
      generatedAt: new Date().toISOString(),
      timezone,
      cache: result.cache,
      sources: result.sources,
      warnings: result.warnings.length > 0 ? result.warnings : undefined,
      tookMs: result.tookMs,
    },
  };

  return c.json(body);
}

app.get('/', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.html(renderDashboardHtml(baseUrl));
});

app.get('/docs', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.html(renderDashboardHtml(baseUrl));
});

app.get('/openapi.json', (c) => {
  const baseUrl = new URL(c.req.url).origin;
  return c.json(buildOpenApiSpec(baseUrl));
});

app.get('/api/v1/health', (c) => {
  return c.json({
    ok: true,
    service: 'api-pro-pivo',
    version: c.env?.API_VERSION ?? '1.0.0',
    environment: c.env?.ENVIRONMENT ?? 'development',
    timezone: c.env?.DEFAULT_TIMEZONE ?? 'America/Argentina/Buenos_Aires',
    sources: ['promiedos', 'espn'],
    mappedLeaguesCount: LEAGUE_MAPPINGS.length,
    kvConfigured: Boolean(c.env?.FOOTBALL_KV),
    cacheStats: sharedCache.getStats(),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/v1/mappings', (c) => {
  return c.json({
    ok: true,
    count: LEAGUE_MAPPINGS.length,
    data: LEAGUE_MAPPINGS,
  });
});

app.get('/api/v1/live', async (c) => {
  const parsed = matchesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid query parameters', issues: parsed.error.issues }, 400);
  }
  const q = parsed.data;
  const result = await footballService.getLiveMatches(
    { league: q.league, team: q.team },
    c.env,
    getWaitUntil(c),
    isTruthyFlag(q.refresh),
  );
  return respondOk(
    c,
    result,
    'public, max-age=10, s-maxage=20, stale-while-revalidate=60',
  );
});

app.get('/api/v1/matches', async (c) => {
  const parsed = matchesQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Invalid query parameters', issues: parsed.error.issues }, 400);
  }
  const q = parsed.data;
  const result = await footballService.getScoreboardByDate(
    q.date ?? 'today',
    {
      league: q.league,
      state: q.state,
      team: q.team,
      liveOnly: isTruthyFlag(q.live),
    },
    c.env,
    getWaitUntil(c),
    isTruthyFlag(q.refresh),
  );
  return respondOk(c, result);
});

app.get('/api/v1/matches/:id', async (c) => {
  const id = c.req.param('id');
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getMatchDetail(
    id,
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    result,
    'public, max-age=15, s-maxage=20, stale-while-revalidate=120',
  );
});

app.get('/api/v1/leagues', async (c) => {
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getLeaguesCatalog(
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    result,
    'public, max-age=1800, s-maxage=3600, stale-while-revalidate=21600',
  );
});

app.get('/api/v1/leagues/:id', async (c) => {
  const id = c.req.param('id');
  const round = c.req.query('round');
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getLeagueDetail(
    id,
    round,
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    result,
    'public, max-age=120, s-maxage=300, stale-while-revalidate=1800',
  );
});

app.get('/api/v1/leagues/:id/standings', async (c) => {
  const id = c.req.param('id');
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getLeagueDetail(
    id,
    undefined,
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    {
      ...result,
      data: {
        league: result.data.league,
        standingsGroups: result.data.standingsGroups,
        brackets: result.data.brackets,
        playerLeaders: result.data.playerLeaders,
      },
    },
    'public, max-age=120, s-maxage=300, stale-while-revalidate=1800',
  );
});

app.get('/api/v1/leagues/:id/rounds/:roundKey', async (c) => {
  const id = c.req.param('id');
  const roundKey = c.req.param('roundKey');
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getLeagueDetail(
    id,
    roundKey,
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    {
      ...result,
      data: {
        league: result.data.league,
        selectedRound: result.data.selectedRound,
        rounds: result.data.rounds,
        matches: result.data.matches,
      },
    },
    'public, max-age=60, s-maxage=180, stale-while-revalidate=600',
  );
});

app.get('/api/v1/teams/:id', async (c) => {
  const id = c.req.param('id');
  const leagueHint = c.req.query('league');
  const refresh = isTruthyFlag(c.req.query('refresh'));
  const result = await footballService.getTeamDetail(
    id,
    leagueHint,
    c.env,
    getWaitUntil(c),
    refresh,
  );
  return respondOk(
    c,
    result,
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=7200',
  );
});

app.get('/api/v1/search', async (c) => {
  const q = c.req.query('q') ?? '';
  if (q.trim().length < 2) {
    return c.json(
      { ok: false, error: 'Query parameter "q" must have at least 2 characters' },
      400,
    );
  }
  const result = await footballService.search(q, c.env, getWaitUntil(c));
  return respondOk(c, result, 'public, max-age=60, s-maxage=120');
});

app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: `Route not found: ${c.req.method} ${c.req.path}`,
      hint: 'Visit /openapi.json or / for documentation',
    },
    404,
  );
});

app.onError((err, c) => {
  const status =
    err instanceof HttpError
      ? err.status === 404
        ? 404
        : 502
      : err.message.toLowerCase().includes('invalid') ||
          err.message.toLowerCase().includes('unknown')
        ? 400
        : 500;

  return c.json(
    {
      ok: false,
      error: err.message || 'Internal Server Error',
      status,
    },
    status,
  );
});

export default {
  fetch(request: Request, env: EnvBindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledEvent, env: EnvBindings, ctx: ExecutionContext) {
    ctx.waitUntil(
      footballService.warmCache(env, (p) => ctx.waitUntil(p)),
    );
  },
};
