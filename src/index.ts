import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import { LEAGUE_MAPPINGS, getEffectiveTvChannels } from './config/mappings.ts';
import {
  applyChannelOverridesToPayload,
  deleteChannelOverride,
  ensureChannelOverridesLoaded,
  upsertChannelOverride,
} from './services/channel-store.ts';
import {
  addExcludedLeague,
  applyLeagueExclusionsToPayload,
  ensureExcludedLeaguesLoaded,
  getExcludedLeagues,
  removeExcludedLeague,
} from './services/league-filter-store.ts';
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

const channelUpsertSchema = z.object({
  id: z
    .union([
      z.string().trim().regex(/^[a-zA-Z0-9._-]{1,64}$/, 'ID inválido (solo letras, números, ., _, -)'),
      z.literal(''),
      z.null(),
    ])
    .optional(),
  name: z.string().trim().min(1, 'El nombre es requerido').max(80).optional(),
  slug: z.string().trim().min(1).max(80).optional(),
  category: z.enum(['tv', 'streaming', 'ppv']).optional(),
  country: z.string().trim().min(2).max(5).optional(),
  aliases: z.array(z.string().trim().min(1).max(80)).max(25).optional(),
});

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token', 'X-Requested-With'],
    exposeHeaders: ['X-API-Version', 'X-Cache', 'X-Sources', 'X-Response-Time'],
  }),
);

app.use('/api/v1/*', async (c, next) => {
  await Promise.all([
    ensureChannelOverridesLoaded(c.env),
    ensureExcludedLeaguesLoaded(c.env),
  ]);
  await next();
});

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function checkAdminAuth(c: Context<AppEnv>): boolean {
  const secret = c.env?.ADMIN_TOKEN?.trim();
  if (!secret) return true;
  const authHeader = c.req.header('Authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const xToken = (c.req.header('X-Admin-Token') ?? '').trim();
  const provided = bearer || xToken;
  return Boolean(provided) && timingSafeEqual(provided, secret);
}

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
    data: applyLeagueExclusionsToPayload(applyChannelOverridesToPayload(result.data)),
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

app.get('/api/v1/channels', (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase();
  const all = getEffectiveTvChannels();
  const data = q
    ? all.filter(
        (ch) =>
          ch.name.toLowerCase().includes(q) ||
          (ch.id && ch.id.toLowerCase().includes(q)) ||
          ch.slug.toLowerCase().includes(q) ||
          ch.aliases.some((a) => a.includes(q)),
      )
    : all;
  const mappedIdsCount = data.filter((ch) => ch.id !== null).length;
  const overriddenCount = all.filter((ch) => ch.isOverridden || ch.isCustom).length;
  return c.json({
    ok: true,
    count: data.length,
    mappedIdsCount,
    overriddenCount,
    persistence: c.env?.FOOTBALL_KV ? 'kv' : 'memory',
    authMode: c.env?.ADMIN_TOKEN ? 'token-protected' : 'open-dev',
    data: data.map((ch) => ({
      id: ch.id,
      name: ch.name,
      slug: ch.slug,
      category: ch.category,
      country: ch.country,
      aliases: ch.aliases,
      isCustom: ch.isCustom,
      isOverridden: ch.isOverridden,
    })),
  });
});

app.post('/api/v1/channels', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ ok: false, error: 'Unauthorized: ADMIN_TOKEN requerido' }, 401);
  }
  const rawBody = await c.req.json().catch(() => null);
  const parsed = channelUpsertSchema.safeParse(rawBody);
  if (!parsed.success || !parsed.data.name) {
    return c.json(
      {
        ok: false,
        error: 'Payload inválido: se requiere name y opcionalmente id (string o null)',
        issues: parsed.success ? [] : parsed.error.issues,
      },
      400,
    );
  }
  const body = parsed.data;
  const res = await upsertChannelOverride(
    {
      slug: body.slug,
      name: body.name!,
      id: body.id === undefined ? null : body.id === '' ? null : body.id,
      category: body.category,
      country: body.country,
      aliases: body.aliases,
    },
    c.env,
  );
  return c.json({ ok: true, persistedIn: res.persistedIn, data: res.channel }, 201);
});

app.put('/api/v1/channels/:slug', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ ok: false, error: 'Unauthorized: ADMIN_TOKEN requerido' }, 401);
  }
  const slug = c.req.param('slug');
  const rawBody = await c.req.json().catch(() => null);
  const parsed = channelUpsertSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Payload inválido', issues: parsed.error.issues }, 400);
  }
  const existing = getEffectiveTvChannels().find((ch) => ch.slug === slug);
  const body = parsed.data;
  const name = body.name ?? existing?.name;
  if (!name) {
    return c.json({ ok: false, error: `Canal '${slug}' no encontrado; enviá 'name' para crearlo` }, 404);
  }
  const nextId =
    body.id === undefined
      ? (existing?.id ?? null)
      : body.id === ''
        ? null
        : body.id;

  const res = await upsertChannelOverride(
    {
      slug,
      name,
      id: nextId,
      category: body.category ?? existing?.category,
      country: body.country ?? existing?.country,
      aliases: body.aliases ?? existing?.aliases,
    },
    c.env,
  );
  return c.json({ ok: true, persistedIn: res.persistedIn, data: res.channel });
});

app.delete('/api/v1/channels/:slug', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ ok: false, error: 'Unauthorized: ADMIN_TOKEN requerido' }, 401);
  }
  const slug = c.req.param('slug');
  const res = await deleteChannelOverride(slug, c.env);
  if (!res.removed) {
    return c.json({ ok: false, error: `No hay override guardado para '${slug}'` }, 404);
  }
  return c.json({ ok: true, ...res });
});

const excludedLeagueSchema = z.object({
  slug: z.string().trim().min(1, 'El slug o ID de la liga es requerido').max(120),
  name: z.string().trim().max(120).optional(),
  promiedosId: z.string().trim().max(40).optional(),
  espnSlug: z.string().trim().max(60).optional(),
});

app.get('/api/v1/excluded-leagues', (c) => {
  const data = getExcludedLeagues();
  return c.json({
    ok: true,
    count: data.length,
    persistence: c.env?.FOOTBALL_KV ? 'kv' : 'memory',
    authMode: c.env?.ADMIN_TOKEN ? 'token-protected' : 'open-dev',
    data,
  });
});

app.post('/api/v1/excluded-leagues', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ ok: false, error: 'Unauthorized: ADMIN_TOKEN requerido' }, 401);
  }
  const rawBody = await c.req.json().catch(() => null);
  const parsed = excludedLeagueSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ ok: false, error: 'Payload inválido', issues: parsed.error.issues }, 400);
  }
  const res = await addExcludedLeague(parsed.data, c.env);
  return c.json({ ok: true, persistedIn: res.persistedIn, data: res.entry }, 201);
});

app.delete('/api/v1/excluded-leagues/:slug', async (c) => {
  if (!checkAdminAuth(c)) {
    return c.json({ ok: false, error: 'Unauthorized: ADMIN_TOKEN requerido' }, 401);
  }
  const slug = c.req.param('slug');
  const res = await removeExcludedLeague(slug, c.env);
  if (!res.removed) {
    return c.json({ ok: false, error: `La liga '${slug}' no está en la lista de exclusión` }, 404);
  }
  return c.json({ ok: true, ...res });
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
