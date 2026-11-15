import { findLeagueMapping, normalizeTvKey, slugifyTvName } from '../config/mappings.ts';
import type {
  EnvBindings,
  LeagueCategory,
  ScoreboardDayPayload,
  UnifiedLeagueRef,
  UnifiedMatch,
} from '../types/schema.ts';

const KV_EXCLUDED_KEY = 'config:excluded-leagues:v1';

export interface ExcludedLeagueEntry {
  slug: string;
  name: string;
  promiedosId?: string;
  espnSlug?: string;
  excludedAt: string;
}

let excludedMem: Record<string, ExcludedLeagueEntry> = {};
let kvLoaded = false;

export async function ensureExcludedLeaguesLoaded(env?: EnvBindings): Promise<void> {
  if (kvLoaded || !env?.FOOTBALL_KV) {
    kvLoaded = true;
    return;
  }
  try {
    const raw = await env.FOOTBALL_KV.get(KV_EXCLUDED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, ExcludedLeagueEntry>;
      if (parsed && typeof parsed === 'object') {
        excludedMem = parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to load excluded leagues from KV:', err);
  } finally {
    kvLoaded = true;
  }
}

async function persistExcluded(env?: EnvBindings): Promise<'kv' | 'memory'> {
  if (env?.FOOTBALL_KV) {
    await env.FOOTBALL_KV.put(KV_EXCLUDED_KEY, JSON.stringify(excludedMem));
    return 'kv';
  }
  return 'memory';
}

export function getExcludedLeagues(): ExcludedLeagueEntry[] {
  return Object.values(excludedMem).sort((a, b) => a.name.localeCompare(b.name));
}

export async function addExcludedLeague(
  input: { slug: string; name?: string; promiedosId?: string; espnSlug?: string },
  env?: EnvBindings,
): Promise<{ entry: ExcludedLeagueEntry; persistedIn: 'kv' | 'memory' }> {
  await ensureExcludedLeaguesLoaded(env);
  const mapped = findLeagueMapping(input.slug);
  const slug = mapped?.canonicalSlug ?? (slugifyTvName(input.slug) || input.slug.trim().toLowerCase());
  const entry: ExcludedLeagueEntry = {
    slug,
    name: input.name?.trim() || mapped?.name || input.slug.trim(),
    promiedosId: input.promiedosId ?? mapped?.promiedosId,
    espnSlug: input.espnSlug ?? mapped?.espnSlug,
    excludedAt: new Date().toISOString(),
  };
  excludedMem[slug] = entry;
  const persistedIn = await persistExcluded(env);
  return { entry, persistedIn };
}

export async function removeExcludedLeague(
  rawSlug: string,
  env?: EnvBindings,
): Promise<{ removed: boolean; persistedIn: 'kv' | 'memory' }> {
  await ensureExcludedLeaguesLoaded(env);
  const mapped = findLeagueMapping(rawSlug);
  const key = mapped?.canonicalSlug ?? (slugifyTvName(rawSlug) || rawSlug.trim().toLowerCase());
  const directKey = rawSlug.trim().toLowerCase();

  let removed = false;
  if (excludedMem[key]) {
    delete excludedMem[key];
    removed = true;
  } else if (excludedMem[directKey]) {
    delete excludedMem[directKey];
    removed = true;
  }
  const persistedIn = removed ? await persistExcluded(env) : env?.FOOTBALL_KV ? 'kv' : 'memory';
  return { removed, persistedIn };
}

export function isLeagueRefExcluded(league: {
  id?: string;
  canonicalSlug?: string;
  slug?: string;
  name?: string;
  externalIds?: { promiedos?: string; espn?: string };
}): boolean {
  const entries = Object.values(excludedMem);
  if (entries.length === 0) return false;

  const candidates = [
    league.canonicalSlug,
    league.id,
    league.slug,
    league.externalIds?.promiedos,
    league.externalIds?.espn,
  ]
    .filter(Boolean)
    .map((v) => String(v).trim().toLowerCase());

  const nameNorm = league.name ? normalizeTvKey(league.name) : '';

  return entries.some((ex) => {
    const exSlug = ex.slug.toLowerCase();
    if (candidates.includes(exSlug)) return true;
    if (ex.promiedosId && candidates.includes(ex.promiedosId.toLowerCase())) return true;
    if (ex.espnSlug && candidates.includes(ex.espnSlug.toLowerCase())) return true;
    if (nameNorm && normalizeTvKey(ex.name) === nameNorm) return true;
    return false;
  });
}

export function applyLeagueExclusionsToPayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.keys(excludedMem).length === 0) return payload;

  const obj = payload as Record<string, any>;

  // ScoreboardDayPayload (/api/v1/matches, /api/v1/live)
  if (Array.isArray(obj.leagues) && obj.summary && typeof obj.summary === 'object') {
    const sb = obj as unknown as ScoreboardDayPayload;
    const leagues = sb.leagues.filter((g) => !isLeagueRefExcluded(g.league));
    const matches = leagues.flatMap((g) => g.matches);
    return {
      ...sb,
      leagues,
      matches,
      summary: {
        ...sb.summary,
        totalMatches: matches.length,
        liveMatches: matches.filter((m: UnifiedMatch) => m.status.isLive).length,
        finishedMatches: matches.filter((m: UnifiedMatch) => m.status.isFinished).length,
        upcomingMatches: matches.filter((m: UnifiedMatch) => !m.status.isLive && !m.status.isFinished).length,
        leaguesCount: leagues.length,
      },
    } as unknown as T;
  }

  // Catalog (/api/v1/leagues)
  if (Array.isArray(obj.categories)) {
    const categories = (obj.categories as LeagueCategory[])
      .map((cat) => ({
        ...cat,
        leagues: cat.leagues.filter((l) => !isLeagueRefExcluded(l)),
      }))
      .filter((cat) => cat.leagues.length > 0);

    const featured = Array.isArray(obj.featured)
      ? obj.featured.filter((l: any) => !isLeagueRefExcluded(l))
      : obj.featured;

    return {
      ...obj,
      ...(featured ? { featured } : {}),
      categories,
    } as T;
  }

  // Search (/api/v1/search)
  if (typeof obj.query === 'string' && Array.isArray(obj.teams) && Array.isArray(obj.leagues)) {
    return {
      ...obj,
      leagues: (obj.leagues as UnifiedLeagueRef[]).filter((l) => !isLeagueRefExcluded(l)),
      matches: Array.isArray(obj.matches)
        ? (obj.matches as UnifiedMatch[]).filter((m) => !isLeagueRefExcluded(m.league))
        : obj.matches,
    } as T;
  }

  return payload;
}
