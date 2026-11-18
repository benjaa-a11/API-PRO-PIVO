import { normalizeTvKey } from '../config/mappings.ts';
import type {
  EnvBindings,
  LeagueCategory,
  ScoreboardDayPayload,
  StandingGroup,
  UnifiedLeagueRef,
  UnifiedMatch,
  UnifiedTeamRef,
} from '../types/schema.ts';
import type { PersistenceBackend } from './channel-store.ts';
import { firestoreReadConfigMap, firestoreWriteConfigMap } from './firebase-config.ts';

const KV_CUSTOM_LOGOS_KEY = 'config:custom-logos:v1';

export type CustomLogoTarget = 'team' | 'league';

export interface CustomLogoEntry {
  key: string;
  targetType: CustomLogoTarget;
  identifier: string;
  name?: string;
  logoUrl: string;
  updatedAt: string;
}

let customLogosMem: Record<string, CustomLogoEntry> = {};
let configLoaded = false;

export function buildCustomLogoKey(targetType: CustomLogoTarget, identifier: string): string {
  const clean = identifier.trim().toLowerCase();
  return `${targetType}:${clean}`;
}

export async function ensureCustomLogosLoaded(env?: EnvBindings): Promise<void> {
  if (configLoaded) return;
  try {
    const fromFs = await firestoreReadConfigMap<CustomLogoEntry>('custom_logos', env);
    if (fromFs) {
      customLogosMem = fromFs;
      if (env?.FOOTBALL_KV) {
        await env.FOOTBALL_KV.put(KV_CUSTOM_LOGOS_KEY, JSON.stringify(customLogosMem));
      }
      configLoaded = true;
      return;
    }
    if (env?.FOOTBALL_KV) {
      const raw = await env.FOOTBALL_KV.get(KV_CUSTOM_LOGOS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, CustomLogoEntry>;
        if (parsed && typeof parsed === 'object') {
          customLogosMem = parsed;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load custom logos:', err);
  } finally {
    configLoaded = true;
  }
}

async function persistCustomLogos(env?: EnvBindings): Promise<PersistenceBackend> {
  const fsOk = await firestoreWriteConfigMap('custom_logos', customLogosMem, env);
  if (env?.FOOTBALL_KV) {
    await env.FOOTBALL_KV.put(KV_CUSTOM_LOGOS_KEY, JSON.stringify(customLogosMem));
  }
  if (fsOk) return 'firestore';
  return env?.FOOTBALL_KV ? 'kv' : 'memory';
}

export function getCustomLogos(): CustomLogoEntry[] {
  return Object.values(customLogosMem).sort((a, b) => a.key.localeCompare(b.key));
}

export async function upsertCustomLogo(
  input: { targetType: CustomLogoTarget; identifier: string; name?: string; logoUrl: string },
  env?: EnvBindings,
): Promise<{ entry: CustomLogoEntry; persistedIn: PersistenceBackend }> {
  await ensureCustomLogosLoaded(env);
  const identifier = input.identifier.trim();
  const key = buildCustomLogoKey(input.targetType, identifier);
  const entry: CustomLogoEntry = {
    key,
    targetType: input.targetType,
    identifier,
    ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    logoUrl: input.logoUrl.trim(),
    updatedAt: new Date().toISOString(),
  };
  customLogosMem[key] = entry;
  const persistedIn = await persistCustomLogos(env);
  return { entry, persistedIn };
}

export async function deleteCustomLogo(
  rawKey: string,
  env?: EnvBindings,
): Promise<{ removed: boolean; persistedIn: PersistenceBackend }> {
  await ensureCustomLogosLoaded(env);
  const key = rawKey.trim().toLowerCase();
  if (!customLogosMem[key]) {
    return { removed: false, persistedIn: 'firestore' };
  }
  delete customLogosMem[key];
  const persistedIn = await persistCustomLogos(env);
  return { removed: true, persistedIn };
}

function findCustomLogo(
  targetType: CustomLogoTarget,
  candidates: Array<string | undefined>,
  name?: string,
): string | undefined {
  if (Object.keys(customLogosMem).length === 0) return undefined;

  for (const c of candidates) {
    if (!c) continue;
    const hit = customLogosMem[buildCustomLogoKey(targetType, c)];
    if (hit) return hit.logoUrl;
  }

  if (name) {
    const normName = normalizeTvKey(name);
    for (const entry of Object.values(customLogosMem)) {
      if (entry.targetType !== targetType) continue;
      if (
        normalizeTvKey(entry.identifier) === normName ||
        (entry.name && normalizeTvKey(entry.name) === normName)
      ) {
        return entry.logoUrl;
      }
    }
  }
  return undefined;
}

function patchTeamRef(team: UnifiedTeamRef | undefined): void {
  if (!team) return;
  const url = findCustomLogo(
    'team',
    [
      team.id,
      team.slug,
      team.externalIds?.promiedos ? `pm-${team.externalIds.promiedos}` : undefined,
      team.externalIds?.promiedos ? `pm:${team.externalIds.promiedos}` : undefined,
      team.externalIds?.espn ? `espn-${team.externalIds.espn}` : undefined,
      team.externalIds?.espn ? `espn:${team.externalIds.espn}` : undefined,
    ],
    team.name,
  );
  if (url) {
    team.logo = url;
    team.logos = { ...(team.logos ?? {}), custom: url };
  }
}

function patchLeagueRef(league: UnifiedLeagueRef | undefined): void {
  if (!league) return;
  const url = findCustomLogo(
    'league',
    [
      league.canonicalSlug,
      league.id,
      league.slug,
      league.externalIds?.promiedos,
      league.externalIds?.espn,
    ],
    league.name,
  );
  if (url) {
    league.logo = url;
    league.logos = { ...(league.logos ?? {}), custom: url };
  }
}

function patchMatch(m: UnifiedMatch | undefined): void {
  if (!m) return;
  patchLeagueRef(m.league);
  patchTeamRef(m.home);
  patchTeamRef(m.away);
}

function patchStandingGroups(groups: StandingGroup[] | undefined): void {
  if (!Array.isArray(groups)) return;
  for (const g of groups) {
    for (const row of g.rows ?? []) {
      patchTeamRef(row.team);
    }
  }
}

export function applyCustomLogosToPayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  if (Object.keys(customLogosMem).length === 0) return payload;

  const obj = payload as Record<string, any>;

  // Scoreboard (/api/v1/matches, /api/v1/live)
  if (Array.isArray(obj.leagues) && obj.summary) {
    const sb = obj as unknown as ScoreboardDayPayload;
    for (const grp of sb.leagues) {
      patchLeagueRef(grp.league);
      for (const m of grp.matches) patchMatch(m);
    }
    return payload;
  }

  // Match detail (/api/v1/matches/:id)
  if (obj.match && typeof obj.match === 'object') {
    patchMatch(obj.match);
    return payload;
  }

  // League detail (/api/v1/leagues/:id)
  if (obj.league && (Array.isArray(obj.standings) || Array.isArray(obj.matches))) {
    patchLeagueRef(obj.league);
    patchStandingGroups(obj.standings);
    patchStandingGroups(obj.promedios);
    if (Array.isArray(obj.matches)) {
      for (const m of obj.matches) patchMatch(m);
    }
    if (Array.isArray(obj.leaders)) {
      for (const cat of obj.leaders) {
        for (const ld of cat.leaders ?? []) {
          const url = findCustomLogo('team', [ld.teamId], ld.teamName);
          if (url) ld.teamLogo = url;
        }
      }
    }
    return payload;
  }

  // Team detail (/api/v1/teams/:id)
  if (obj.team && typeof obj.team === 'object') {
    patchTeamRef(obj.team);
    patchLeagueRef(obj.mainLeague);
    if (obj.matches) {
      for (const k of ['all', 'upcoming', 'recent']) {
        if (Array.isArray(obj.matches[k])) {
          for (const m of obj.matches[k]) patchMatch(m);
        }
      }
    }
    return payload;
  }

  // Catalog (/api/v1/leagues)
  if (Array.isArray(obj.categories)) {
    for (const cat of obj.categories as LeagueCategory[]) {
      for (const l of cat.leagues) patchLeagueRef(l);
    }
    return payload;
  }

  // Search (/api/v1/search)
  if (typeof obj.query === 'string' && Array.isArray(obj.teams) && Array.isArray(obj.leagues)) {
    for (const t of obj.teams as UnifiedTeamRef[]) patchTeamRef(t);
    for (const l of obj.leagues as UnifiedLeagueRef[]) patchLeagueRef(l);
    if (Array.isArray(obj.matches)) {
      for (const m of obj.matches as UnifiedMatch[]) patchMatch(m);
    }
    return payload;
  }

  return payload;
}
