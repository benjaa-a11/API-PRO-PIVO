import {
  type EffectiveTvChannel,
  type TvChannelMapping,
  getEffectiveTvChannels,
  isBaseTvChannel,
  normalizeTvKey,
  reapplyTvChannelMapping,
  setRuntimeTvOverrides,
  slugifyTvName,
} from '../config/mappings.ts';
import type { EnvBindings, TvBroadcast, UnifiedMatch } from '../types/schema.ts';
import { firestoreReadConfigMap, firestoreWriteConfigMap } from './firebase-config.ts';

const KV_OVERRIDES_KEY = 'config:tv-channel-overrides:v1';

export type PersistenceBackend = 'firestore' | 'kv' | 'memory';

let overridesMem: Record<string, TvChannelMapping> = {};
let configLoaded = false;

export interface UpsertChannelInput {
  slug?: string;
  id: string | null;
  name: string;
  category?: 'tv' | 'streaming' | 'ppv';
  country?: string;
  aliases?: string[];
}

export async function ensureChannelOverridesLoaded(env?: EnvBindings): Promise<void> {
  if (configLoaded) return;
  try {
    const fromFs = await firestoreReadConfigMap<TvChannelMapping>('tv_channels', env);
    if (fromFs) {
      overridesMem = fromFs;
      setRuntimeTvOverrides(overridesMem);
      if (env?.FOOTBALL_KV) {
        await env.FOOTBALL_KV.put(KV_OVERRIDES_KEY, JSON.stringify(overridesMem));
      }
      configLoaded = true;
      return;
    }
    if (env?.FOOTBALL_KV) {
      const raw = await env.FOOTBALL_KV.get(KV_OVERRIDES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, TvChannelMapping>;
        if (parsed && typeof parsed === 'object') {
          overridesMem = parsed;
          setRuntimeTvOverrides(overridesMem);
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load TV channel overrides:', err);
  } finally {
    configLoaded = true;
  }
}

async function persistOverrides(env?: EnvBindings): Promise<PersistenceBackend> {
  setRuntimeTvOverrides(overridesMem);
  const fsOk = await firestoreWriteConfigMap('tv_channels', overridesMem, env);
  if (env?.FOOTBALL_KV) {
    await env.FOOTBALL_KV.put(KV_OVERRIDES_KEY, JSON.stringify(overridesMem));
  }
  if (fsOk) return 'firestore';
  return env?.FOOTBALL_KV ? 'kv' : 'memory';
}

export async function upsertChannelOverride(
  input: UpsertChannelInput,
  env?: EnvBindings,
): Promise<{ channel: EffectiveTvChannel; persistedIn: PersistenceBackend }> {
  await ensureChannelOverridesLoaded(env);

  const cleanName = input.name.replace(/\s+/g, ' ').trim();
  const slug = (input.slug ? slugifyTvName(input.slug) : slugifyTvName(cleanName)) || 'channel';
  const existing = getEffectiveTvChannels().find((c) => c.slug === slug);

  const cleanId =
    input.id === null || input.id === undefined
      ? null
      : input.id.trim() === ''
        ? null
        : input.id.trim();

  const aliasSet = new Set<string>([normalizeTvKey(cleanName)]);
  for (const a of input.aliases ?? existing?.aliases ?? []) {
    const norm = normalizeTvKey(a);
    if (norm) aliasSet.add(norm);
  }

  const nextMapping: TvChannelMapping = {
    id: cleanId,
    name: cleanName || existing?.name || slug,
    slug,
    category: input.category ?? existing?.category ?? (cleanId ? 'tv' : 'streaming'),
    country: (input.country ?? existing?.country ?? 'AR').toUpperCase(),
    aliases: Array.from(aliasSet),
  };

  overridesMem[slug] = nextMapping;
  const persistedIn = await persistOverrides(env);
  const updated = getEffectiveTvChannels().find((c) => c.slug === slug)!;
  return { channel: updated, persistedIn };
}

export async function deleteChannelOverride(
  rawSlug: string,
  env?: EnvBindings,
): Promise<{ removed: boolean; restoredToDefault: boolean; persistedIn: PersistenceBackend }> {
  await ensureChannelOverridesLoaded(env);
  const slug = slugifyTvName(rawSlug);
  const existed = Boolean(overridesMem[slug]);
  if (!existed) {
    return {
      removed: false,
      restoredToDefault: false,
      persistedIn: 'firestore',
    };
  }
  delete overridesMem[slug];
  const persistedIn = await persistOverrides(env);
  return {
    removed: true,
    restoredToDefault: isBaseTvChannel(slug),
    persistedIn,
  };
}

export function resetInMemoryChannelOverridesForTests(): void {
  overridesMem = {};
  configLoaded = false;
  setRuntimeTvOverrides({});
}

function mapMatchBroadcasts(m: UnifiedMatch): void {
  if (Array.isArray(m.broadcasts) && m.broadcasts.length > 0) {
    m.broadcasts = m.broadcasts.map((b: TvBroadcast) => reapplyTvChannelMapping(b));
  }
}

export function applyChannelOverridesToPayload<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as Record<string, any>;

  // /api/v1/matches & /api/v1/live
  if (Array.isArray(obj.leagues)) {
    for (const grp of obj.leagues) {
      if (Array.isArray(grp?.matches)) {
        for (const m of grp.matches) mapMatchBroadcasts(m);
      }
    }
  }
  // /api/v1/matches/:id
  if (obj.match && Array.isArray(obj.match.broadcasts)) {
    mapMatchBroadcasts(obj.match);
  }
  // /api/v1/leagues/:id
  if (Array.isArray(obj.matches)) {
    for (const m of obj.matches) mapMatchBroadcasts(m);
  }
  // /api/v1/teams/:id
  if (obj.matches && !Array.isArray(obj.matches)) {
    for (const key of ['all', 'upcoming', 'recent']) {
      if (Array.isArray(obj.matches[key])) {
        for (const m of obj.matches[key]) mapMatchBroadcasts(m);
      }
    }
  }
  return payload;
}
