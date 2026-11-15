import {
  LEAGUE_MAPPINGS,
  PROMIEDOS_EVENT_TYPE_MAP,
  findLeagueMapping,
  resolveTvChannel,
} from '../config/mappings.ts';
import type {
  BracketStage,
  LeaderCategory,
  LeagueCategory,
  LineupPlayer,
  MatchCard,
  MatchEvent,
  MatchGoal,
  MatchOdds,
  MatchPrediction,
  MatchState,
  MatchStatistic,
  MatchStatus,
  MissingPlayer,
  RecentFormMatch,
  SquadMember,
  StandingGroup,
  StandingRow,
  StandingTable,
  TeamLineup,
  TvBroadcast,
  UnifiedLeagueDetail,
  UnifiedLeagueRef,
  UnifiedMatch,
  UnifiedMatchDetail,
  UnifiedTeamDetail,
  UnifiedTeamRef,
} from '../types/schema.ts';
import {
  extractPromiedosNextData,
  fetchJson,
  fetchText,
} from '../utils/http.ts';
import {
  deterministicId,
  parseMinuteParts,
  promiedosDateTimeToIso,
  slugify,
} from '../utils/normalize.ts';

const PM_API_BASE = 'https://api.promiedos.com.ar';
const PM_WEB_BASE = 'https://www.promiedos.com.ar';

const PM_API_HEADERS: Record<string, string> = {
  'X-VER': '1.11.7.5',
  Origin: PM_WEB_BASE,
  Referer: `${PM_WEB_BASE}/`,
};

export function promiedosTeamLogo(id: string): string {
  return `${PM_API_BASE}/images/team/${id}/4`;
}

export function promiedosTeamLogoLarge(id: string): string {
  return `${PM_API_BASE}/images/team/${id}/1`;
}

export function promiedosLeagueLogo(id: string): string {
  return `${PM_API_BASE}/images/league/${id}/1`;
}

export function promiedosCountryFlag(countryId: string): string {
  return `${PM_API_BASE}/images/country/${countryId}/1`;
}

export function promiedosTvLogo(id: string): string {
  return `${PM_API_BASE}/images/tvnetworks/${id}`;
}

function normalizeHexColor(hex?: string | null): string | undefined {
  if (!hex || typeof hex !== 'string') return undefined;
  const trimmed = hex.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parsePromiedosTrend(raw: unknown): Array<'W' | 'D' | 'L'> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const mapped: Array<'W' | 'D' | 'L'> = [];
  for (const item of raw) {
    if (item === 1 || item === '1' || item === 'W' || item === 'G') mapped.push('W');
    else if (item === 2 || item === '2' || item === 'D' || item === 'E') mapped.push('D');
    else if (item === 0 || item === '0' || item === 'L' || item === 'P') mapped.push('L');
  }
  return mapped.length > 0 ? mapped : undefined;
}

export function mapPromiedosLeagueRef(rawLeague: any): UnifiedLeagueRef {
  const pmId = rawLeague?.id ? String(rawLeague.id) : '';
  const pmSlug = rawLeague?.url_name ? String(rawLeague.url_name) : '';
  const name = String(rawLeague?.name ?? pmSlug ?? 'Fútbol');

  const mapping =
    (pmId ? findLeagueMapping(pmId) : undefined) ??
    (pmSlug ? findLeagueMapping(pmSlug) : undefined) ??
    findLeagueMapping(slugify(name));

  const canonicalSlug = mapping?.canonicalSlug ?? (pmSlug || slugify(name) || `pm-${pmId}`);
  const countryId = rawLeague?.country_id
    ? String(rawLeague.country_id)
    : mapping?.countryId;
  const logo = pmId ? promiedosLeagueLogo(pmId) : '';

  return {
    id: canonicalSlug,
    canonicalSlug,
    externalIds: {
      promiedos: pmId || undefined,
      espn: mapping?.espnId,
    },
    name: mapping?.name ?? name,
    shortName: rawLeague?.short_name ? String(rawLeague.short_name) : undefined,
    slug: pmSlug || canonicalSlug,
    countryId,
    countryName: rawLeague?.country_name
      ? String(rawLeague.country_name)
      : mapping?.countryName,
    countryFlag: countryId ? promiedosCountryFlag(countryId) : undefined,
    isInternational: Boolean(
      rawLeague?.is_international ?? mapping?.isInternational ?? false,
    ),
    logo,
    logos: {
      promiedos: logo || undefined,
    },
    promiedosUrl: pmId ? `${PM_WEB_BASE}/league/${pmSlug || canonicalSlug}/${pmId}` : undefined,
  };
}

function mapPromiedosTeamRef(
  rawTeam: any,
  score: number | null,
  penaltyScore: number | null | undefined,
  winnerIndex: number,
  teamPosition: 1 | 2,
): UnifiedTeamRef {
  const pmId = rawTeam?.id ? String(rawTeam.id) : '';
  const name = String(rawTeam?.name ?? 'Equipo');
  const shortName = String(rawTeam?.short_name ?? name);
  const slug = String(rawTeam?.url_name ?? (slugify(name) || `team-${pmId}`));
  const countryId = rawTeam?.country_id ? String(rawTeam.country_id) : undefined;
  const logoSmall = pmId ? promiedosTeamLogo(pmId) : '';
  const logoLarge = pmId ? promiedosTeamLogoLarge(pmId) : '';

  return {
    id: pmId ? `pm-${pmId}` : deterministicId('team', slug),
    externalIds: {
      promiedos: pmId || undefined,
    },
    name,
    shortName,
    abbreviation: rawTeam?.symbol_name ? String(rawTeam.symbol_name) : undefined,
    slug,
    logo: logoLarge || logoSmall,
    logos: {
      promiedos: logoSmall || undefined,
      promiedosLarge: logoLarge || undefined,
    },
    countryId,
    countryFlag: countryId ? promiedosCountryFlag(countryId) : undefined,
    colors: rawTeam?.colors
      ? {
          primary: normalizeHexColor(rawTeam.colors.color),
          text: normalizeHexColor(rawTeam.colors.text_color),
        }
      : undefined,
    score,
    penaltyScore: penaltyScore ?? undefined,
    redCards: typeof rawTeam?.red_cards === 'number' ? rawTeam.red_cards : 0,
    winner: winnerIndex === 1 || winnerIndex === 2 ? winnerIndex === teamPosition : null,
  };
}

function mapPromiedosStatus(
  rawStatus: any,
  gameTime: unknown,
  gameTimeDisplay: unknown,
  statusDisplay: unknown,
  hasPenaltyShootout: boolean,
): MatchStatus {
  const statusEnum = Number(rawStatus?.enum ?? 1);
  const name = String(rawStatus?.name ?? '');
  const shortName = String(rawStatus?.short_name ?? rawStatus?.symbol_name ?? '');
  const combined = `${name} ${shortName}`.toLowerCase();
  const displayRaw = String(
    gameTimeDisplay ?? statusDisplay ?? shortName ?? name ?? '',
  ).trim();
  const parsedMinute = parseMinuteParts(
    gameTimeDisplay ? String(gameTimeDisplay) : toNumberOrNull(gameTime),
  );

  let state: MatchState = 'PRE';
  let isLive = false;
  let isFinished = false;
  let period: number | null = null;
  let minute = parsedMinute.minute;
  let minuteDisplay = parsedMinute.display || displayRaw;

  if (statusEnum === 1) {
    state = 'PRE';
    minute = null;
    minuteDisplay = '';
  } else if (statusEnum === 2) {
    isLive = true;
    if (/entretiempo|\bet\b|\bdescanso\b/i.test(combined) || shortName.toUpperCase() === 'ET') {
      state = 'HT';
      period = 1;
      minute = 45;
      minuteDisplay = 'ET';
    } else if (/penal|\bpen\b/i.test(combined)) {
      state = 'PEN';
      period = 5;
      minuteDisplay = displayRaw || 'PEN';
    } else if (/pr[oó]rroga|suplementario|\bte\b|\baet\b/i.test(combined)) {
      state = 'ET';
      period = 3;
    } else {
      state = 'LIVE';
      if (/1°|primer/i.test(combined)) period = 1;
      else if (/2°|segundo/i.test(combined)) period = 2;
    }
  } else {
    if (/posterg|aplaz|posp/i.test(combined)) {
      state = 'POSTPONED';
    } else if (/suspend|demor|abandon|interrump/i.test(combined)) {
      state = 'SUSPENDED';
    } else if (/cancel|anul/i.test(combined)) {
      state = 'CANCELLED';
    } else if (/penal/i.test(combined) || hasPenaltyShootout) {
      state = 'PEN';
      isFinished = true;
      minuteDisplay = minuteDisplay || 'PEN';
    } else {
      state = 'FT';
      isFinished = true;
      minuteDisplay = minuteDisplay || 'Final';
    }
    if (!isFinished) {
      minute = null;
    }
  }

  return {
    state,
    code: String(statusEnum),
    label: name || shortName || state,
    shortLabel: shortName || state,
    minute,
    minuteDisplay,
    period,
    isLive,
    isFinished,
  };
}

function mapPromiedosBroadcasts(rawNetworks: unknown): TvBroadcast[] {
  if (!Array.isArray(rawNetworks)) return [];
  const byKey = new Map<string, TvBroadcast>();
  for (const n of rawNetworks) {
    if (!n || (!n.name && !n.id)) continue;
    const promId = n.id ? String(n.id) : undefined;
    const name = String(n.name ?? n.id ?? '').trim();
    if (!name) continue;
    const resolved = resolveTvChannel(name, promId, promId ? promiedosTvLogo(promId) : undefined);
    const key = (resolved.id || resolved.slug || resolved.name).toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, resolved);
    }
  }
  return Array.from(byKey.values());
}

function mapPromiedosOdds(rawOdds: unknown): MatchOdds | undefined {
  if (!rawOdds || typeof rawOdds !== 'object') return undefined;
  const obj = rawOdds as Record<string, any>;
  const list = Array.isArray(obj.live)
    ? obj.live
    : Array.isArray(obj.original)
      ? obj.original
      : Array.isArray(obj.options)
        ? obj.options
        : [];
  if (list.length === 0) return undefined;

  const options = list
    .filter((o) => o && typeof o.value === 'number')
    .map((o) => ({
      outcome: String(o.name ?? ''),
      value: Number(o.value),
      trend: typeof o.trend === 'number' ? o.trend : undefined,
    }));

  if (options.length === 0) return undefined;

  const homeOpt = options.find((o) => o.outcome === '1');
  const drawOpt = options.find((o) => o.outcome.toUpperCase() === 'X');
  const awayOpt = options.find((o) => o.outcome === '2');

  return {
    provider: 'Promiedos',
    moneyline: {
      home: homeOpt?.value,
      draw: drawOpt?.value,
      away: awayOpt?.value,
    },
    options,
  };
}

function extractInlineGoals(rawTeams: any[]): MatchGoal[] {
  const goals: MatchGoal[] = [];
  rawTeams.forEach((team, idx) => {
    const teamSide: 'home' | 'away' = idx === 0 ? 'home' : 'away';
    if (!Array.isArray(team?.goals)) return;
    for (const g of team.goals) {
      const min = parseMinuteParts(g?.time_to_display ?? g?.time);
      const typeVal = Number(g?.goal_type ?? g?.type ?? 1);
      goals.push({
        teamSide,
        playerName: String(g?.player_name ?? g?.player_sname ?? 'Gol'),
        playerShortName: g?.player_sname ? String(g.player_sname) : undefined,
        minute: min.minute,
        minuteDisplay: min.display || String(g?.time_to_display ?? ''),
        isPenalty: typeVal === 3 || /\(p\)/i.test(String(g?.time_to_display ?? '')),
        isOwnGoal: typeVal === 2 || /\(e\/c\)/i.test(String(g?.time_to_display ?? '')),
      });
    }
  });
  goals.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
  return goals;
}

export function mapPromiedosGameToUnifiedMatch(
  rawGame: any,
  rawLeague?: any,
): UnifiedMatch {
  const pmId = String(rawGame?.id ?? '');
  const league = mapPromiedosLeagueRef(rawLeague ?? rawGame?.league ?? {});
  const rawTeams = Array.isArray(rawGame?.teams) ? rawGame.teams : [];
  const rawScores = Array.isArray(rawGame?.scores) ? rawGame.scores : [];
  const rawPens = Array.isArray(rawGame?.penalty_scores) ? rawGame.penalty_scores : [];

  const homeScore = toNumberOrNull(rawScores[0]);
  const awayScore = toNumberOrNull(rawScores[1]);
  const homePen = toNumberOrNull(rawPens[0]);
  const awayPen = toNumberOrNull(rawPens[1]);
  const normalizedHomeScore = homeScore !== null && homeScore >= 0 ? homeScore : null;
  const normalizedAwayScore = awayScore !== null && awayScore >= 0 ? awayScore : null;
  const hasPenalties =
    (homePen !== null && homePen >= 0) || (awayPen !== null && awayPen >= 0);

  const winnerIndex = Number(rawGame?.winner ?? -1);
  const home = mapPromiedosTeamRef(
    rawTeams[0],
    normalizedHomeScore,
    homePen !== null && homePen >= 0 ? homePen : null,
    winnerIndex,
    1,
  );
  const away = mapPromiedosTeamRef(
    rawTeams[1],
    normalizedAwayScore,
    awayPen !== null && awayPen >= 0 ? awayPen : null,
    winnerIndex,
    2,
  );

  const startTimeRaw = String(rawGame?.start_time ?? '');
  const dateIso = promiedosDateTimeToIso(startTimeRaw);
  const [datePart, timePart] = startTimeRaw.split(' ');
  const dateLocalAr = datePart
    ? datePart.split('-').reverse().join('-')
    : dateIso.slice(0, 10);
  const timeLocalAr = timePart ?? '';

  const status = mapPromiedosStatus(
    rawGame?.status,
    rawGame?.game_time,
    rawGame?.game_time_to_display,
    rawGame?.game_time_status_to_display,
    hasPenalties,
  );

  const urlSlug = String(
    rawGame?.url_name ?? `${home.slug}-vs-${away.slug}`,
  );
  const canonicalKey = `${dateLocalAr}:${league.canonicalSlug}:${home.slug}-vs-${away.slug}`;

  return {
    id: `pm:${pmId}`,
    canonicalKey,
    externalIds: { promiedos: pmId },
    sources: ['promiedos'],
    urlSlug,
    dateIso,
    dateLocalAr,
    timeLocalAr,
    stageRound: rawGame?.stage_round_name
      ? String(rawGame.stage_round_name)
      : undefined,
    league,
    status,
    home,
    away,
    goals: extractInlineGoals(rawTeams),
    cards: [],
    broadcasts: mapPromiedosBroadcasts(rawGame?.tv_networks),
    odds: mapPromiedosOdds(rawGame?.main_odds ?? rawGame?.live_odds?.odds),
    note: rawGame?.description ? String(rawGame.description) : undefined,
  };
}

function mapPromiedosGamesResponse(payload: any): {
  leagues: Array<{ league: UnifiedLeagueRef; matches: UnifiedMatch[] }>;
  matches: UnifiedMatch[];
} {
  const rawLeagues = Array.isArray(payload?.leagues) ? payload.leagues : [];
  const leagues: Array<{ league: UnifiedLeagueRef; matches: UnifiedMatch[] }> = [];
  const matches: UnifiedMatch[] = [];

  for (const rawLeague of rawLeagues) {
    const leagueRef = mapPromiedosLeagueRef(rawLeague);
    const rawGames = Array.isArray(rawLeague?.games) ? rawLeague.games : [];
    const leagueMatches: UnifiedMatch[] = [];
    for (const g of rawGames) {
      if (!g?.id) continue;
      const mapped = mapPromiedosGameToUnifiedMatch(g, rawLeague);
      leagueMatches.push(mapped);
      matches.push(mapped);
    }
    if (leagueMatches.length > 0) {
      leagues.push({ league: leagueRef, matches: leagueMatches });
    }
  }

  return { leagues, matches };
}

export async function fetchPromiedosDay(pmDate: string): Promise<{
  leagues: Array<{ league: UnifiedLeagueRef; matches: UnifiedMatch[] }>;
  matches: UnifiedMatch[];
}> {
  try {
    const data = await fetchJson<any>(`${PM_API_BASE}/games/${pmDate}`, {
      headers: PM_API_HEADERS,
      timeoutMs: 7000,
    });
    const parsed = mapPromiedosGamesResponse(data);
    if (parsed.matches.length > 0 || (Array.isArray(data?.leagues) && data.leagues.length > 0)) {
      return parsed;
    }
  } catch {
    // Fallback al HTML SSR de la portada cuando la API por fecha falla o responde vacío
  }

  const html = await fetchText(PM_WEB_BASE, { timeoutMs: 8000 });
  const nextData = extractPromiedosNextData<any>(html);
  const pageData = nextData?.props?.pageProps?.data;
  return mapPromiedosGamesResponse(pageData);
}

function buildFallbackCategories(): LeagueCategory[] {
  const groups = new Map<string, UnifiedLeagueRef[]>();
  for (const m of LEAGUE_MAPPINGS) {
    const cat = m.isInternational ? 'Internacional' : m.countryName;
    const list = groups.get(cat) ?? [];
    list.push({
      id: m.canonicalSlug,
      canonicalSlug: m.canonicalSlug,
      externalIds: { promiedos: m.promiedosId, espn: m.espnId },
      name: m.name,
      slug: m.promiedosSlug ?? m.canonicalSlug,
      countryId: m.countryId,
      countryName: m.countryName,
      countryFlag: promiedosCountryFlag(m.countryId),
      isInternational: m.isInternational,
      logo: m.promiedosId ? promiedosLeagueLogo(m.promiedosId) : '',
      logos: {
        promiedos: m.promiedosId ? promiedosLeagueLogo(m.promiedosId) : undefined,
      },
      promiedosUrl: m.promiedosId
        ? `${PM_WEB_BASE}/league/${m.promiedosSlug ?? m.canonicalSlug}/${m.promiedosId}`
        : undefined,
    });
    groups.set(cat, list);
  }
  return Array.from(groups.entries()).map(([name, leagues]) => ({ name, leagues }));
}

export async function fetchPromiedosMenu(): Promise<LeagueCategory[]> {
  try {
    const html = await fetchText(PM_WEB_BASE, { timeoutMs: 8000 });
    const nextData = extractPromiedosNextData<any>(html);
    const categories = nextData?.props?.pageProps?.menuData?.categories;
    if (Array.isArray(categories) && categories.length > 0) {
      return categories.map((cat: any) => ({
        name: String(cat?.name ?? 'Ligas'),
        icon: cat?.id ? promiedosCountryFlag(String(cat.id)) : undefined,
        leagues: (Array.isArray(cat?.leagues) ? cat.leagues : []).map((l: any) =>
          mapPromiedosLeagueRef({
            ...l,
            country_name: l?.country_name ?? cat?.name,
          }),
        ),
      }));
    }
  } catch {
    // Fallback al diccionario curado
  }
  return buildFallbackCategories();
}

function parsePromiedosLineupPlayer(p: any, starter: boolean): LineupPlayer {
  const jersey = toNumberOrNull(p?.jersey_num);
  return {
    name: String(p?.name ?? p?.player_short_name ?? 'Jugador'),
    shortName: p?.player_short_name ? String(p.player_short_name) : undefined,
    jerseyNumber: jersey !== null && jersey >= 0 ? jersey : null,
    position: String(p?.position ?? ''),
    formationPosition: p?.formation_position ? String(p.formation_position) : undefined,
    isCaptain: Boolean(p?.is_captain),
    starter,
    countryId: p?.country_id ? String(p.country_id) : undefined,
    countryFlag: p?.country_id ? promiedosCountryFlag(String(p.country_id)) : undefined,
    age: toNumberOrNull(p?.age),
    height: p?.height ? String(p.height) : undefined,
    pitchLocation:
      p?.pitch_location &&
      typeof p.pitch_location.x === 'number' &&
      typeof p.pitch_location.y === 'number'
        ? { x: p.pitch_location.x, y: p.pitch_location.y }
        : undefined,
  };
}

function parsePromiedosLineupTeam(
  rawTeamLineup: any,
  side: 'home' | 'away',
  supportsVisualLineups: boolean,
  teamRef: UnifiedTeamRef,
): TeamLineup {
  const starters = Array.isArray(rawTeamLineup?.starting)
    ? rawTeamLineup.starting.map((p: any) => parsePromiedosLineupPlayer(p, true))
    : [];
  const bench = Array.isArray(rawTeamLineup?.bench)
    ? rawTeamLineup.bench.map((p: any) => parsePromiedosLineupPlayer(p, false))
    : [];
  const staffFirst = Array.isArray(rawTeamLineup?.staff)
    ? rawTeamLineup.staff[0]
    : undefined;

  return {
    side,
    teamId: teamRef.id,
    teamName: teamRef.name,
    status: String(rawTeamLineup?.status ?? ''),
    formation: String(rawTeamLineup?.formation ?? ''),
    supportsVisualLineups,
    coach: staffFirst?.name
      ? {
          name: String(staffFirst.name),
          shortName: staffFirst.player_short_name
            ? String(staffFirst.player_short_name)
            : undefined,
          age: toNumberOrNull(staffFirst.age),
          countryId: staffFirst.country_id ? String(staffFirst.country_id) : undefined,
        }
      : undefined,
    starters,
    bench,
  };
}

function parsePromiedosMissingPlayers(arr: unknown): MissingPlayer[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((p: any) => {
    const jersey = toNumberOrNull(p?.jersey_num);
    return {
      name: String(p?.name ?? p?.player_short_name ?? 'Jugador'),
      shortName: p?.player_short_name ? String(p.player_short_name) : undefined,
      jerseyNumber: jersey !== null && jersey >= 0 ? jersey : null,
      position: p?.position ? String(p.position) : undefined,
      countryId: p?.country_id ? String(p.country_id) : undefined,
      age: toNumberOrNull(p?.age),
      reason: String(p?.missing_details?.reason ?? 'Ausente'),
      statusText: p?.missing_details?.will_play
        ? String(p.missing_details.will_play)
        : undefined,
      willPlay: p?.missing_details?.will_play_status === 1,
    };
  });
}

export async function fetchPromiedosMatchDetail(
  pmGameId: string,
): Promise<UnifiedMatchDetail> {
  const payload = await fetchJson<any>(`${PM_API_BASE}/gamecenter/${pmGameId}`, {
    headers: PM_API_HEADERS,
    timeoutMs: 8000,
  });

  const game = payload?.game;
  if (!game) {
    throw new Error(`Promiedos gamecenter returned empty game for ${pmGameId}`);
  }

  const match = mapPromiedosGameToUnifiedMatch(game, game.league);
  const events: MatchEvent[] = [];
  const extractedGoals: MatchGoal[] = [];
  const extractedCards: MatchCard[] = [];
  const stageScores: UnifiedMatchDetail['stageScores'] = [];
  let penHome = 0;
  let penAway = 0;

  if (Array.isArray(game.events)) {
    for (const stage of game.events) {
      const stageName = String(stage?.name ?? '');
      const isPenStage = Boolean(stage?.is_penalties_stage);
      const s0 = toNumberOrNull(stage?.scores?.[0]);
      const s1 = toNumberOrNull(stage?.scores?.[1]);

      if (stageName && ((s0 !== null && s0 >= 0) || (s1 !== null && s1 >= 0))) {
        stageScores.push({
          stage: stageName,
          homeScore: s0 !== null && s0 >= 0 ? s0 : null,
          awayScore: s1 !== null && s1 >= 0 ? s1 : null,
          isPenalties: isPenStage,
        });
      }

      if (!Array.isArray(stage?.rows)) continue;
      for (const row of stage.rows) {
        const rowEvents = Array.isArray(row?.events) ? row.events : [];
        for (const ev of rowEvents) {
          const typeCode = Number(ev?.type ?? 0);
          const mappedType = PROMIEDOS_EVENT_TYPE_MAP[typeCode] ?? 'other';
          const teamSide: 'home' | 'away' | 'neutral' =
            ev?.team === 1 ? 'home' : ev?.team === 2 ? 'away' : 'neutral';
          const min = parseMinuteParts(ev?.time ?? row?.time);
          const texts: string[] = Array.isArray(ev?.texts)
            ? ev.texts.map((t: unknown) => String(t ?? ''))
            : [];
          const playerName = texts[0] || undefined;
          const secondaryPlayerName = texts[1] || undefined;
          const jersey = toNumberOrNull(ev?.player_jersey_num);

          events.push({
            stage: stageName || undefined,
            isShootout: isPenStage || typeCode === 16 || typeCode === 17,
            type: mappedType,
            rawType: typeCode,
            teamSide,
            teamId:
              teamSide === 'home'
                ? match.home.id
                : teamSide === 'away'
                  ? match.away.id
                  : undefined,
            teamName:
              teamSide === 'home'
                ? match.home.name
                : teamSide === 'away'
                  ? match.away.name
                  : undefined,
            minute: min.minute,
            minuteDisplay: min.display || String(ev?.time ?? row?.time ?? ''),
            playerName,
            playerJersey: jersey !== null && jersey >= 0 ? jersey : null,
            secondaryPlayerName,
            description: texts.filter(Boolean).join(' - ') || undefined,
            source: 'promiedos',
          });

          if (teamSide !== 'neutral') {
            if (
              mappedType === 'goal' ||
              mappedType === 'own_goal' ||
              mappedType === 'penalty_goal'
            ) {
              extractedGoals.push({
                teamSide,
                playerName: playerName ?? 'Gol',
                assistName: secondaryPlayerName,
                minute: min.minute,
                minuteDisplay: min.display || String(ev?.time ?? row?.time ?? ''),
                isPenalty: mappedType === 'penalty_goal',
                isOwnGoal: mappedType === 'own_goal',
              });
            } else if (mappedType === 'penalty_shootout_goal') {
              if (teamSide === 'home') penHome++;
              else penAway++;
            } else if (
              mappedType === 'yellow_card' ||
              mappedType === 'red_card' ||
              mappedType === 'second_yellow'
            ) {
              extractedCards.push({
                teamSide,
                cardType:
                  mappedType === 'yellow_card'
                    ? 'yellow'
                    : mappedType === 'second_yellow'
                      ? 'second_yellow'
                      : 'red',
                playerName: playerName ?? 'Tarjeta',
                jerseyNumber: jersey !== null && jersey >= 0 ? jersey : null,
                minute: min.minute,
                minuteDisplay: min.display || String(ev?.time ?? row?.time ?? ''),
              });
            }
          }
        }
      }
    }
  }

  if (extractedGoals.length > 0) {
    match.goals = extractedGoals;
  }
  if (extractedCards.length > 0) {
    match.cards = extractedCards;
    match.home.yellowCards = extractedCards.filter(
      (c) => c.teamSide === 'home' && c.cardType === 'yellow',
    ).length;
    match.away.yellowCards = extractedCards.filter(
      (c) => c.teamSide === 'away' && c.cardType === 'yellow',
    ).length;
  }
  if (penHome > 0 || penAway > 0) {
    match.home.penaltyScore = match.home.penaltyScore ?? penHome;
    match.away.penaltyScore = match.away.penaltyScore ?? penAway;
  }

  const statistics: MatchStatistic[] = [];
  if (Array.isArray(game.statistics)) {
    for (const st of game.statistics) {
      const label = String(st?.name ?? '');
      if (!label) continue;
      const v0 = String(st?.values?.[0] ?? '0');
      const v1 = String(st?.values?.[1] ?? '0');
      const pct0 = toNumberOrNull(st?.percentages?.[0]);
      const pct1 = toNumberOrNull(st?.percentages?.[1]);
      statistics.push({
        key: slugify(label),
        label,
        homeValue: v0,
        awayValue: v1,
        homeNumeric: toNumberOrNull(v0.replace('%', '')),
        awayNumeric: toNumberOrNull(v1.replace('%', '')),
        homePct: pct0 !== null ? Math.round(pct0 * 100) : null,
        awayPct: pct1 !== null ? Math.round(pct1 * 100) : null,
      });
    }
  }
  match.hasStatistics = statistics.length > 0;

  let homeLineup: TeamLineup | undefined;
  let awayLineup: TeamLineup | undefined;
  const lineupsRaw = game.players?.lineups;
  if (lineupsRaw && Array.isArray(lineupsRaw.teams)) {
    const visual = Boolean(lineupsRaw.support_visual_lineups);
    const homeRaw = lineupsRaw.teams.find((t: any) => t?.team_num === 1) ?? lineupsRaw.teams[0];
    const awayRaw = lineupsRaw.teams.find((t: any) => t?.team_num === 2) ?? lineupsRaw.teams[1];
    if (homeRaw) {
      homeLineup = parsePromiedosLineupTeam(homeRaw, 'home', visual, match.home);
    }
    if (awayRaw) {
      awayLineup = parsePromiedosLineupTeam(awayRaw, 'away', visual, match.away);
    }
  }
  match.hasLineups = Boolean(
    (homeLineup?.starters.length ?? 0) > 0 || (awayLineup?.starters.length ?? 0) > 0,
  );

  const missingRaw = Array.isArray(game.players?.missing_players)
    ? game.players.missing_players
    : [];
  const missingHome = parsePromiedosMissingPlayers(missingRaw[0]);
  const missingAway = parsePromiedosMissingPlayers(missingRaw[1]);

  const gameInfo: Array<{ label: string; value: string }> = [];
  let referee: string | undefined;
  const infoBroadcasts: TvBroadcast[] = [];

  if (Array.isArray(game.game_info)) {
    for (const item of game.game_info) {
      const label = String(item?.name ?? '').trim();
      const value = String(item?.value ?? '').trim();
      if (!label || !value) continue;
      gameInfo.push({ label, value });

      const low = label.toLowerCase();
      if (low.includes('estadio')) {
        match.venue = { name: value };
      } else if (low.includes('árbitro') || low.includes('arbitro')) {
        referee = value;
      } else if (low.includes('tv')) {
        for (const ch of value.split(/[,/|]+/)) {
          const name = ch.trim();
          if (name) infoBroadcasts.push(resolveTvChannel(name));
        }
      }
    }
  }
  if (infoBroadcasts.length > 0) {
    const mergedMap = new Map<string, TvBroadcast>();
    for (const b of [...match.broadcasts, ...infoBroadcasts]) {
      const k = (b.id || b.slug || b.name).toLowerCase();
      if (!mergedMap.has(k)) {
        mergedMap.set(k, b);
      }
    }
    match.broadcasts = Array.from(mergedMap.values());
  }

  let prediction: MatchPrediction | undefined;
  if (game.prediction && Array.isArray(game.prediction.options)) {
    const opts = game.prediction.options as Array<Record<string, any>>;
    const p1 = opts.find((o) => o?.name === '1')?.percentage;
    const px = opts.find((o) => String(o?.name).toUpperCase() === 'X')?.percentage;
    const p2 = opts.find((o) => o?.name === '2')?.percentage;
    prediction = {
      votesHomePct: toNumberOrNull(p1) ?? undefined,
      votesDrawPct: toNumberOrNull(px) ?? undefined,
      votesAwayPct: toNumberOrNull(p2) ?? undefined,
    };
  }

  const headToHead = game.head_to_head
    ? {
        homeWins: Number(game.head_to_head.home_wins ?? 0),
        draws: Number(game.head_to_head.draws ?? 0),
        awayWins: Number(game.head_to_head.away_wins ?? 0),
        recentMatches: (Array.isArray(game.head_to_head.games)
          ? game.head_to_head.games
          : []
        ).map((h: any) => ({
          id: h?.id ? `pm:${h.id}` : undefined,
          date: promiedosDateTimeToIso(h?.start_time) || h?.start_time,
          leagueName: h?.league?.name ? String(h.league.name) : undefined,
          homeName: String(h?.teams?.[0]?.name ?? ''),
          awayName: String(h?.teams?.[1]?.name ?? ''),
          homeScore: toNumberOrNull(h?.scores?.[0]),
          awayScore: toNumberOrNull(h?.scores?.[1]),
        })),
      }
    : undefined;

  const recentForm = {
    home: parsePromiedosTrend(game.recent_form?.home) ?? [],
    away: parsePromiedosTrend(game.recent_form?.away) ?? [],
  };

  return {
    match,
    gameInfo,
    referee,
    events,
    stageScores,
    statistics,
    lineups: {
      home: homeLineup,
      away: awayLineup,
    },
    missingPlayers: {
      home: missingHome,
      away: missingAway,
    },
    commentary: [],
    prediction,
    headToHead,
    recentForm,
  };
}

function classifyTableType(name: string, rows: any[], columns: any[] = []): StandingTable['type'] {
  const low = name.toLowerCase();
  if (low.includes('promedio') || low.includes('descenso') || low.includes('relegation')) {
    return 'promedios';
  }
  if (low.includes('anual') || low.includes('acumulada')) return 'annual';
  if (low.includes('posic') || low.includes('temporada') || low.includes('grupo') || low.includes('zona')) {
    return 'positions';
  }
  const hasProm =
    columns.some((c) => c?.key === 'Pct' || c?.key === 'Prom') ||
    rows.some((r) =>
      Array.isArray(r?.values) && r.values.some((v: any) => v?.key === 'Pct' || v?.key === 'Prom'),
    );
  return hasProm ? 'promedios' : 'positions';
}

function mapPromiedosStandingTable(rawTable: any, fallbackName: string): StandingTable {
  const name = String(rawTable?.name ?? fallbackName ?? 'Posiciones');
  const rawRows = Array.isArray(rawTable?.rows) ? rawTable.rows : [];
  const rawCols = Array.isArray(rawTable?.columns) ? rawTable.columns : [];
  const rawDests = Array.isArray(rawTable?.destinations) ? rawTable.destinations : [];
  const tableType = classifyTableType(name, rawRows, rawCols);
  const isPromedios = tableType === 'promedios';

  const colTitleByKey = new Map<string, string>();
  for (const c of rawCols) {
    if (c?.key && c?.title) {
      colTitleByKey.set(String(c.key), String(c.title));
    }
  }

  const destLabelByColor = new Map<string, string>();
  const legend: Array<{ color: string; label: string }> = [];
  for (const d of rawDests) {
    const color = normalizeHexColor(d?.color);
    const label = String(d?.name ?? '');
    if (color && label) {
      destLabelByColor.set(color.toLowerCase(), label);
      legend.push({ color, label });
    }
  }

  const rows: StandingRow[] = rawRows.map((r: any, idx: number) => {
    const obj = r?.entity?.object ?? {};
    const pmTeamId = obj?.id ? String(obj.id) : '';
    const valuesArr = Array.isArray(r?.values) ? r.values : [];
    const valMap: Record<string, string | number> = {};

    let played = 0;
    let won = 0;
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let goalDifference = 0;
    let points = 0;
    let average: number | null = null;
    let form: Array<'W' | 'D' | 'L'> | undefined;

    for (const v of valuesArr) {
      const k = String(v?.key ?? '');
      const val = v?.value;
      if (!k) continue;

      if (k === '{trend}') {
        form = parsePromiedosTrend(val);
        continue;
      }

      const colTitle = colTitleByKey.get(k);
      if (typeof val === 'string' || typeof val === 'number') {
        valMap[colTitle ? `${k} (${colTitle})` : k] = val;
      }

      if (k === 'GamePlayed' || k === 'PJ') {
        played = toNumberOrNull(val) ?? 0;
      } else if (k === 'Ratio' || k === 'Dif') {
        goalDifference = toNumberOrNull(val) ?? 0;
      } else if (k === 'Points' || k === 'Pts') {
        points = toNumberOrNull(val) ?? 0;
      } else if (k === 'Pct' || k === 'Prom' || k === 'Average') {
        average = toNumberOrNull(val);
      } else if (k === 'Goals' && typeof val === 'string' && val.includes(':')) {
        const [gf, ga] = val.split(':').map((n) => Number.parseInt(n, 10));
        if (Number.isFinite(gf)) goalsFor = gf;
        if (Number.isFinite(ga)) goalsAgainst = ga;
      } else if (k === 'GF') {
        goalsFor = toNumberOrNull(val) ?? 0;
      } else if (k === 'GC') {
        goalsAgainst = toNumberOrNull(val) ?? 0;
      } else if (!isPromedios && (k === 'GamesWon' || k === 'G')) {
        won = toNumberOrNull(val) ?? 0;
      } else if (!isPromedios && (k === 'GamesEven' || k === 'E')) {
        drawn = toNumberOrNull(val) ?? 0;
      } else if (!isPromedios && (k === 'GamesLost' || k === 'P')) {
        lost = toNumberOrNull(val) ?? 0;
      }
    }

    const qColor = normalizeHexColor(r?.destination_color);
    const qLabel = qColor ? destLabelByColor.get(qColor.toLowerCase()) : undefined;

    return {
      position: toNumberOrNull(r?.num) ?? idx + 1,
      team: {
        id: pmTeamId ? `pm-${pmTeamId}` : deterministicId('team', String(obj?.name ?? idx)),
        externalIds: { promiedos: pmTeamId || undefined },
        name: String(obj?.name ?? 'Equipo'),
        shortName: obj?.short_name ? String(obj.short_name) : undefined,
        slug: obj?.url_name ? String(obj.url_name) : undefined,
        logo: pmTeamId ? promiedosTeamLogoLarge(pmTeamId) : '',
        colors: obj?.colors
          ? {
              primary: normalizeHexColor(obj.colors.color),
              text: normalizeHexColor(obj.colors.text_color),
            }
          : undefined,
      },
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
      average,
      form,
      qualificationColor: qColor,
      qualificationLabel: qLabel,
      rawValues: Object.keys(valMap).length > 0 ? valMap : undefined,
    };
  });

  return {
    id: rawTable?.id ? String(rawTable.id) : undefined,
    name,
    type: tableType,
    rows,
    legend: legend.length > 0 ? legend : undefined,
  };
}

function mapPromiedosLeaderTables(rawStats: any): LeaderCategory[] {
  const tables = Array.isArray(rawStats?.tables) ? rawStats.tables : [];
  return tables.map((t: any) => ({
    name: String(t?.name ?? 'Líderes'),
    leaders: (Array.isArray(t?.rows) ? t.rows : []).map((r: any, idx: number) => {
      const playerObj = r?.entity?.object ?? {};
      const teamId = playerObj?.team_id ? String(playerObj.team_id) : '';
      const firstVal = Array.isArray(r?.values) ? r.values[0]?.value : '';
      return {
        rank: toNumberOrNull(r?.num) ?? idx + 1,
        playerName: String(playerObj?.name ?? playerObj?.sname ?? 'Jugador'),
        teamName: playerObj?.team_name ? String(playerObj.team_name) : undefined,
        teamLogo: teamId ? promiedosTeamLogo(teamId) : undefined,
        value: firstVal ?? 0,
      };
    }),
  }));
}

export async function fetchPromiedosLeagueRound(
  leagueId: string,
  roundKey: string,
  leagueRef?: UnifiedLeagueRef,
): Promise<UnifiedMatch[]> {
  let payload: any;
  try {
    payload = await fetchJson<any>(
      `${PM_API_BASE}/league/games/${leagueId}/${encodeURIComponent(roundKey)}`,
      { headers: PM_API_HEADERS, timeoutMs: 8000 },
    );
  } catch {
    payload = await fetchJson<any>(
      `${PM_API_BASE}/league/games/${leagueId}/${encodeURIComponent(roundKey)}`,
      {
        headers: { ...PM_API_HEADERS, 'X-VER': '1.11.7.3' },
        timeoutMs: 8000,
      },
    );
  }

  const rawGames = Array.isArray(payload?.games)
    ? payload.games
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.league?.games)
        ? payload.league.games
        : [];

  return rawGames
    .filter((g: any) => g && g.id)
    .map((g: any) =>
      mapPromiedosGameToUnifiedMatch(
        g,
        payload?.league ??
          (leagueRef
            ? {
                id: leagueId,
                name: leagueRef.name,
                url_name: leagueRef.slug,
                country_id: leagueRef.countryId,
                country_name: leagueRef.countryName,
                is_international: leagueRef.isInternational,
              }
            : { id: leagueId }),
      ),
    );
}

export async function fetchPromiedosLeague(
  leagueId: string,
  slugHint?: string,
): Promise<UnifiedLeagueDetail> {
  const mapping = findLeagueMapping(leagueId);
  const slug = slugHint ?? mapping?.promiedosSlug ?? 'futbol';

  let data: any = null;
  try {
    const apiPayload = await fetchJson<any>(
      `${PM_API_BASE}/league/tables_and_fixtures/${leagueId}`,
      { headers: PM_API_HEADERS, timeoutMs: 8000, retries: 1 },
    );
    if (
      apiPayload?.league ||
      Array.isArray(apiPayload?.tables_groups) ||
      apiPayload?.brackets
    ) {
      data = apiPayload;
    }
  } catch {
    // Promiedos responde HTTP 500 en /tables_and_fixtures/hc -> fallback HTML SSR
  }

  if (!data) {
    const html = await fetchText(`${PM_WEB_BASE}/league/${slug}/${leagueId}`, {
      timeoutMs: 9000,
    });
    const nextData = extractPromiedosNextData<any>(html);
    data = nextData?.props?.pageProps?.data ?? nextData?.props?.pageProps;
  }

  if (!data) {
    throw new Error(`Promiedos league data unavailable for ${leagueId}`);
  }

  const league = mapPromiedosLeagueRef(data.league ?? { id: leagueId, url_name: slug });

  const standingsGroups: StandingGroup[] = [];
  if (Array.isArray(data.tables_groups)) {
    for (const grp of data.tables_groups) {
      const groupName = String(grp?.name ?? 'General');
      const rawTables = Array.isArray(grp?.tables)
        ? grp.tables.map((entry: any) =>
            entry?.table
              ? { ...entry.table, name: entry.name ?? entry.table.name }
              : entry,
          )
        : grp?.table
          ? [{ ...grp.table, name: grp.name ?? grp.table.name }]
          : [];
      const mappedTables = rawTables.map((t: any) =>
        mapPromiedosStandingTable(t, groupName),
      );
      if (mappedTables.length > 0) {
        standingsGroups.push({ name: groupName, tables: mappedTables });
      }
    }
  }

  const brackets: BracketStage[] = [];
  const rawStages = Array.isArray(data.brackets?.stages)
    ? data.brackets.stages
    : [];
  for (const st of rawStages) {
    const stageMatches: BracketStage['matches'] = [];
    for (const grp of Array.isArray(st?.groups) ? st.groups : []) {
      const rawGames = Array.isArray(grp?.games) ? grp.games : [];
      if (rawGames.length > 0) {
        for (const g of rawGames) {
          const teams = (Array.isArray(g?.teams) ? g.teams : []).map(
            (t: any, idx: number) => ({
              id: t?.id ? `pm-${t.id}` : undefined,
              name: String(t?.name ?? 'A definir'),
              shortName: t?.short_name ? String(t.short_name) : undefined,
              logo: t?.id ? promiedosTeamLogo(String(t.id)) : undefined,
              score: toNumberOrNull(g?.scores?.[idx]),
              winner:
                g?.winner === 1 || g?.winner === 2 ? g.winner === idx + 1 : undefined,
            }),
          );
          stageMatches.push({
            id: g?.id ? `pm:${g.id}` : undefined,
            name: g?.url_name ? String(g.url_name) : undefined,
            status: g?.game_time_status_to_display
              ? String(g.game_time_status_to_display)
              : g?.status?.short_name
                ? String(g.status.short_name)
                : undefined,
            teams,
          });
        }
      } else if (Array.isArray(grp?.participants)) {
        stageMatches.push({
          teams: grp.participants.map((p: any) => ({
            id: p?.id ? `pm-${p.id}` : undefined,
            name: String(p?.name ?? 'A definir'),
            shortName: p?.short_name ? String(p.short_name) : undefined,
            logo: p?.id ? promiedosTeamLogo(String(p.id)) : undefined,
          })),
        });
      }
    }
    brackets.push({
      name: String(st?.name ?? 'Llaves'),
      shortName: st?.short_name ?? null,
      matches: stageMatches,
    });
  }

  const rawFilters = Array.isArray(data.games?.filters) ? data.games.filters : [];
  const rounds = rawFilters.map((f: any) => ({
    name: String(f?.name ?? f?.key ?? ''),
    key: String(f?.key ?? ''),
    selected: Boolean(f?.selected),
  }));
  const selectedRound =
    rounds.find((r: { selected?: boolean }) => r.selected)?.key ??
    rounds.find((r: { key: string }) => r.key === 'latest')?.key ??
    rounds[0]?.key;

  let matches: UnifiedMatch[] = [];
  const embeddedGames = Array.isArray(data.games?.games)
    ? data.games.games
    : Array.isArray(data.games?.rows)
      ? data.games.rows
      : [];
  if (embeddedGames.length > 0) {
    matches = embeddedGames
      .filter((g: any) => g?.id)
      .map((g: any) => mapPromiedosGameToUnifiedMatch(g, data.league));
  } else if (selectedRound) {
    try {
      matches = await fetchPromiedosLeagueRound(leagueId, selectedRound, league);
    } catch {
      matches = [];
    }
  }

  const playerLeaders = mapPromiedosLeaderTables(data.players_statistics);

  return {
    league,
    standingsGroups,
    brackets,
    rounds,
    selectedRound,
    matches,
    playerLeaders,
  };
}

export async function fetchPromiedosTeam(teamId: string): Promise<UnifiedTeamDetail> {
  const payload = await fetchJson<any>(`${PM_API_BASE}/team/${teamId}`, {
    headers: PM_API_HEADERS,
    timeoutMs: 8000,
  });

  const comp = payload?.competitor;
  if (!comp) {
    throw new Error(`Promiedos team not found for id ${teamId}`);
  }

  const team = mapPromiedosTeamRef(comp, null, null, -1, 1);
  const mainLeague = payload?.main_league
    ? mapPromiedosLeagueRef(payload.main_league)
    : undefined;

  const info: Array<{ label: string; value: string }> = Array.isArray(payload?.team_info)
    ? payload.team_info
        .filter((i: any) => i?.name && i?.value)
        .map((i: any) => ({ label: String(i.name), value: String(i.value) }))
    : [];

  let stadium: UnifiedTeamDetail['stadium'];
  if (payload?.stadium) {
    const rawCoords = String(payload.stadium.coordinates ?? '');
    const [latStr, lngStr] = rawCoords.split(',');
    const lat = toNumberOrNull(latStr);
    const lng = toNumberOrNull(lngStr);
    const stdInfo: Array<{ label: string; value: string }> = Array.isArray(
      payload.stadium.info,
    )
      ? payload.stadium.info
          .filter((i: any) => i?.name && i?.value)
          .map((i: any) => ({ label: String(i.name), value: String(i.value) }))
      : [];
    const capItem = stdInfo.find((i) => i.label.toLowerCase().includes('capacidad'));
    const cityItem = stdInfo.find((i) => i.label.toLowerCase().includes('ciudad'));

    stadium = {
      name: String(payload.stadium.name ?? 'Estadio'),
      city: cityItem?.value,
      capacity: capItem?.value,
      coordinates:
        lat !== null && lng !== null ? { lat, lng } : undefined,
      info: stdInfo,
    };
  }

  const squad: UnifiedTeamDetail['squad'] = [];
  if (Array.isArray(payload?.squad?.groups)) {
    for (const grp of payload.squad.groups) {
      const groupName = String(grp?.name ?? 'Plantel');
      const players: SquadMember[] = (Array.isArray(grp?.rows) ? grp.rows : []).map(
        (r: any) => {
          const p = r?.entity?.object ?? {};
          const numVal = toNumberOrNull(p?.num);
          return {
            name: String(p?.name ?? 'Jugador'),
            shortName: p?.sname ? String(p.sname) : undefined,
            jerseyNumber: numVal !== null && numVal > 0 ? numVal : null,
            position: String(p?.position ?? groupName),
            formationPosition: p?.formation_position
              ? String(p.formation_position)
              : undefined,
            age: toNumberOrNull(p?.age),
            birthdate: p?.birthdate ? String(p.birthdate) : undefined,
            height: p?.height ? String(p.height) : undefined,
            weight: p?.weight ? String(p.weight) : undefined,
            countryId: p?.country_id ? String(p.country_id) : undefined,
            countryFlag: p?.country_id
              ? promiedosCountryFlag(String(p.country_id))
              : undefined,
            isStaff: Boolean(p?.is_staff),
          };
        },
      );
      if (players.length > 0) {
        squad.push({ groupName, players });
      }
    }
  }

  const extractTeamGames = (rows: unknown): UnifiedMatch[] => {
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r: any) => r?.game?.id)
      .map((r: any) =>
        mapPromiedosGameToUnifiedMatch(r.game, r.game.league ?? payload.main_league),
      );
  };

  const recent = extractTeamGames(payload?.games?.last?.rows);
  const upcoming = extractTeamGames(payload?.games?.next?.rows);

  const playerStatsFilters = Array.isArray(payload?.stats?.filters)
    ? payload.stats.filters.map((f: any) => ({
        key: String(f?.key ?? ''),
        name: String(f?.name ?? ''),
        selected: Boolean(f?.selected),
        tables: mapPromiedosLeaderTables(f),
      }))
    : undefined;

  return {
    team,
    mainLeague,
    info,
    stadium,
    squad,
    matches: {
      recent,
      upcoming,
      all: [...upcoming, ...recent],
    },
    playerStatsFilters,
  };
}
