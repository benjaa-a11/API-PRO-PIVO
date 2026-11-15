import { LEAGUE_MAPPINGS, findLeagueMapping } from '../config/mappings.ts';
import type {
  CommentaryItem,
  LineupPlayer,
  MatchCard,
  MatchEvent,
  MatchEventType,
  MatchGoal,
  MatchOdds,
  MatchPrediction,
  MatchState,
  MatchStatistic,
  MatchStatus,
  PlayerMatchStats,
  RecentFormMatch,
  StandingGroup,
  StandingRow,
  StandingTable,
  TeamLineup,
  TvBroadcast,
  UnifiedLeagueRef,
  UnifiedMatch,
  UnifiedMatchDetail,
  UnifiedTeamDetail,
  UnifiedTeamRef,
} from '../types/schema.ts';
import { extractEspnFittData, fetchJson, fetchText } from '../utils/http.ts';
import { deterministicId, parseMinuteParts, slugify } from '../utils/normalize.ts';

const ESPN_SITE_API = 'https://site.api.espn.com/apis/site/v2/sports/soccer';
const ESPN_STANDINGS_API = 'https://site.api.espn.com/apis/v2/sports/soccer';
const ESPN_DROPDOWN_URL =
  'https://site.api.espn.com/apis/site/v2/leagues/dropdown?sport=soccer&limit=500&lang=es&region=ar';
const ESPN_WEB_BASE = 'https://www.espn.com.ar';

interface EspnLeagueHint {
  id?: string;
  name?: string;
  shortName?: string;
  abbrev?: string;
  slug?: string;
  isTournament?: boolean;
  logo?: string;
  logoDark?: string;
}

function normalizeHex(hex?: string | null): string | undefined {
  if (!hex || typeof hex !== 'string') return undefined;
  const trimmed = hex.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function extractUidLeagueId(uid?: string): string | undefined {
  if (!uid) return undefined;
  const match = /~l:(\d+)/.exec(uid);
  return match?.[1];
}

function getEspnLogoUrls(
  obj: any,
  fallbackId?: string,
  kind: 'team' | 'league' = 'team',
): { defaultLogo?: string; darkLogo?: string } {
  const logos = Array.isArray(obj?.logos) ? obj.logos : [];
  const defaultEntry =
    logos.find((l: any) => Array.isArray(l?.rel) && l.rel.includes('default')) ?? logos[0];
  const darkEntry = logos.find(
    (l: any) => Array.isArray(l?.rel) && l.rel.includes('dark'),
  );

  let defaultLogo: string | undefined =
    defaultEntry?.href ?? (typeof obj?.logo === 'string' ? obj.logo : undefined);
  let darkLogo: string | undefined = darkEntry?.href;

  if (!defaultLogo && fallbackId) {
    defaultLogo =
      kind === 'team'
        ? `https://a.espncdn.com/i/teamlogos/soccer/500/${fallbackId}.png`
        : `https://a.espncdn.com/i/leaguelogos/soccer/500/${fallbackId}.png`;
  }

  return { defaultLogo, darkLogo };
}

export function mapEspnLeagueRef(rawLeague: EspnLeagueHint): UnifiedLeagueRef {
  const espnId = rawLeague.id ? String(rawLeague.id) : undefined;
  const espnSlug = rawLeague.slug ? String(rawLeague.slug) : undefined;
  const mapping =
    (espnSlug ? findLeagueMapping(espnSlug) : undefined) ??
    (espnId ? findLeagueMapping(espnId) : undefined) ??
    (rawLeague.name ? findLeagueMapping(slugify(rawLeague.name)) : undefined);

  const fallbackName = rawLeague.name ?? espnSlug ?? 'Fútbol';
  const canonicalSlug =
    mapping?.canonicalSlug ??
    (espnSlug ? espnSlug.replace(/\./g, '-') : slugify(fallbackName)) ??
    `espn-${espnId ?? 'unknown'}`;

  const espnLogo =
    rawLeague.logo ??
    (espnId
      ? `https://a.espncdn.com/i/leaguelogos/soccer/500/${espnId}.png`
      : undefined);

  return {
    id: canonicalSlug,
    canonicalSlug,
    externalIds: {
      promiedos: mapping?.promiedosId,
      espn: espnId ?? mapping?.espnId,
    },
    name: mapping?.name ?? fallbackName,
    shortName: rawLeague.shortName ?? rawLeague.abbrev,
    slug: espnSlug ?? canonicalSlug,
    countryId: mapping?.countryId,
    countryName: mapping?.countryName,
    isInternational: Boolean(rawLeague.isTournament ?? mapping?.isInternational ?? false),
    logo: espnLogo ?? '',
    logos: {
      espn: espnLogo,
      espnDark: rawLeague.logoDark,
    },
    espnUrl: espnSlug ? `${ESPN_WEB_BASE}/futbol/liga/_/nombre/${espnSlug}` : undefined,
  };
}

function mapEspnTeamRef(comp: any): UnifiedTeamRef {
  const team = comp?.team ?? {};
  const teamId = String(team?.id ?? comp?.id ?? '');
  const name = String(team?.displayName ?? team?.name ?? 'Equipo');
  const shortName = String(team?.shortDisplayName ?? team?.name ?? name).trim();
  const slug = slugify(name) || `espn-${teamId}`;
  const { defaultLogo, darkLogo } = getEspnLogoUrls(team, teamId, 'team');

  const scoreVal = comp?.score !== undefined && comp?.score !== '' ? toNum(comp.score) : null;
  const penaltyVal = toNum(comp?.shootoutScore);
  const recordStr = Array.isArray(comp?.records)
    ? comp.records.find((r: any) => r?.summary)?.summary
    : undefined;

  return {
    id: teamId ? `espn-${teamId}` : deterministicId('team', slug),
    externalIds: {
      espn: teamId || undefined,
    },
    name,
    shortName: shortName || name,
    abbreviation: team?.abbreviation ? String(team.abbreviation) : undefined,
    slug,
    logo: defaultLogo ?? '',
    logos: {
      espn: defaultLogo,
      espnDark: darkLogo,
    },
    colors:
      team?.color || team?.alternateColor
        ? {
            primary: normalizeHex(team.color),
            secondary: normalizeHex(team.alternateColor),
          }
        : undefined,
    form: comp?.form ? String(comp.form) : undefined,
    record: recordStr ? String(recordStr) : undefined,
    score: scoreVal,
    penaltyScore: penaltyVal !== null ? penaltyVal : undefined,
    redCards: 0,
    winner: typeof comp?.winner === 'boolean' ? comp.winner : null,
  };
}

function mapEspnStatus(rawStatus: any, hasShootout: boolean): MatchStatus {
  const typeObj = rawStatus?.type ?? {};
  const rawState = String(typeObj?.state ?? 'pre').toLowerCase();
  const typeName = String(typeObj?.name ?? '').toUpperCase();
  const detail = String(typeObj?.shortDetail ?? typeObj?.detail ?? '');
  const desc = String(typeObj?.description ?? detail ?? '');

  let state: MatchState = 'PRE';
  let isLive = false;
  let isFinished = false;

  if (typeName.includes('POSTPONED')) {
    state = 'POSTPONED';
  } else if (typeName.includes('SUSPENDED') || typeName.includes('DELAYED')) {
    state = 'SUSPENDED';
  } else if (typeName.includes('CANCELED') || typeName.includes('CANCELLED')) {
    state = 'CANCELLED';
  } else if (rawState === 'in') {
    isLive = true;
    if (typeName.includes('HALFTIME') || detail === 'ET' || detail === 'HT') {
      state = 'HT';
    } else if (typeName.includes('SHOOTOUT') || typeName.includes('PENALT')) {
      state = 'PEN';
    } else if (typeName.includes('EXTRA')) {
      state = 'ET';
    } else {
      state = 'LIVE';
    }
  } else if (rawState === 'post' || typeObj?.completed) {
    isFinished = true;
    state = typeName.includes('SHOOTOUT') || typeName.includes('PENALT') || hasShootout ? 'PEN' : 'FT';
  } else {
    state = 'PRE';
  }

  const displayStr = String(rawStatus?.displayClock ?? detail ?? '');
  const min = parseMinuteParts(displayStr);

  return {
    state,
    code: String(typeObj?.id ?? typeName ?? rawState),
    label: desc || detail || state,
    shortLabel: detail || state,
    minute:
      state === 'HT'
        ? 45
        : isLive || isFinished
          ? min.minute
          : null,
    minuteDisplay: state === 'HT' ? 'ET' : displayStr || detail,
    period: toNum(rawStatus?.period),
    isLive,
    isFinished,
  };
}

function mapEspnBroadcasts(comp: any): TvBroadcast[] {
  const broadcasts: TvBroadcast[] = [];
  const seen = new Set<string>();

  const add = (name: string) => {
    const clean = name.trim();
    if (!clean || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    broadcasts.push({ name: clean, country: 'AR' });
  };

  if (Array.isArray(comp?.broadcasts)) {
    for (const b of comp.broadcasts) {
      if (Array.isArray(b?.names)) {
        for (const n of b.names) add(String(n));
      } else if (b?.media?.shortName) {
        add(String(b.media.shortName));
      } else if (typeof b === 'string') {
        add(b);
      }
    }
  }
  if (Array.isArray(comp?.geoBroadcasts)) {
    for (const gb of comp.geoBroadcasts) {
      if (gb?.media?.shortName) add(String(gb.media.shortName));
    }
  }
  if (typeof comp?.broadcast === 'string' && comp.broadcast) {
    for (const part of comp.broadcast.split('/')) add(part);
  }
  return broadcasts;
}

function mapEspnOdds(rawOdds: unknown): MatchOdds | undefined {
  const arr = Array.isArray(rawOdds) ? rawOdds : rawOdds ? [rawOdds] : [];
  const first = arr[0] as Record<string, any> | undefined;
  if (!first) return undefined;

  const hMoney = toNum(first?.homeTeamOdds?.moneyLine);
  const dMoney = toNum(first?.drawOdds?.moneyLine);
  const aMoney = toNum(first?.awayTeamOdds?.moneyLine);

  const options: MatchOdds['options'] = [];
  if (hMoney !== null) options.push({ outcome: '1', value: hMoney, label: first.details });
  if (dMoney !== null) options.push({ outcome: 'X', value: dMoney });
  if (aMoney !== null) options.push({ outcome: '2', value: aMoney });

  if (options.length === 0) return undefined;

  return {
    provider: first?.provider?.name ? String(first.provider.name) : 'ESPN',
    moneyline: {
      home: hMoney ?? undefined,
      draw: dMoney ?? undefined,
      away: aMoney ?? undefined,
    },
    options,
  };
}

function toArgentinaDateParts(isoStr: string): { dateLocalAr: string; timeLocalAr: string } {
  if (!isoStr) return { dateLocalAr: '', timeLocalAr: '' };
  const date = new Date(isoStr);
  if (Number.isNaN(date.getTime())) return { dateLocalAr: '', timeLocalAr: '' };
  // Argentina es UTC-3 sin horario de verano
  const arMs = date.getTime() - 3 * 3600 * 1000;
  const ar = new Date(arMs);
  const y = ar.getUTCFullYear();
  const m = String(ar.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ar.getUTCDate()).padStart(2, '0');
  const hh = String(ar.getUTCHours()).padStart(2, '0');
  const mm = String(ar.getUTCMinutes()).padStart(2, '0');
  return {
    dateLocalAr: `${y}-${m}-${d}`,
    timeLocalAr: `${hh}:${mm}`,
  };
}

function extractEspnDetailsGoalsAndCards(
  comp: any,
  homeTeamId: string | undefined,
  awayTeamId: string | undefined,
): { goals: MatchGoal[]; cards: MatchCard[]; homeReds: number; awayReds: number } {
  const details = Array.isArray(comp?.details) ? comp.details : [];
  const goals: MatchGoal[] = [];
  const cards: MatchCard[] = [];
  let homeReds = 0;
  let awayReds = 0;

  for (const d of details) {
    if (d?.shootout) continue;
    const teamId = d?.team?.id ? String(d.team.id) : '';
    const teamSide: 'home' | 'away' =
      teamId && awayTeamId && teamId === awayTeamId
        ? 'away'
        : teamId && homeTeamId && teamId === homeTeamId
          ? 'home'
          : 'home';

    const min = parseMinuteParts(d?.clock?.displayValue);
    const athletes = Array.isArray(d?.athletesInvolved) ? d.athletesInvolved : [];
    const playerName = String(athletes[0]?.displayName ?? athletes[0]?.shortName ?? '');
    const playerId = athletes[0]?.id ? String(athletes[0].id) : undefined;

    if (d?.scoringPlay) {
      goals.push({
        teamSide,
        playerName: playerName || 'Gol',
        playerShortName: athletes[0]?.shortName ? String(athletes[0].shortName) : undefined,
        playerId,
        minute: min.minute,
        minuteDisplay: min.display || String(d?.clock?.displayValue ?? ''),
        isPenalty: Boolean(d?.penaltyKick),
        isOwnGoal: Boolean(d?.ownGoal),
      });
    } else if (d?.yellowCard || d?.redCard) {
      const cardType: MatchCard['cardType'] = d?.redCard ? 'red' : 'yellow';
      if (d?.redCard) {
        if (teamSide === 'home') homeReds++;
        else awayReds++;
      }
      cards.push({
        teamSide,
        cardType,
        playerName: playerName || 'Tarjeta',
        playerId,
        minute: min.minute,
        minuteDisplay: min.display || String(d?.clock?.displayValue ?? ''),
      });
    }
  }

  return { goals, cards, homeReds, awayReds };
}

function mapEspnEventToUnifiedMatch(
  event: any,
  leagueHint?: EspnLeagueHint,
): UnifiedMatch {
  const espnId = String(event?.id ?? '');
  const comp = Array.isArray(event?.competitions) ? event.competitions[0] : {};
  const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];

  const homeComp =
    competitors.find((c: any) => c?.homeAway === 'home') ?? competitors[0] ?? {};
  const awayComp =
    competitors.find((c: any) => c?.homeAway === 'away') ?? competitors[1] ?? {};

  const home = mapEspnTeamRef(homeComp);
  const away = mapEspnTeamRef(awayComp);

  const uidLeagueId = extractUidLeagueId(event?.uid);
  const league = mapEspnLeagueRef({
    id: leagueHint?.id ?? uidLeagueId,
    name: leagueHint?.name ?? event?.season?.slug,
    shortName: leagueHint?.shortName,
    abbrev: leagueHint?.abbrev,
    slug: leagueHint?.slug,
    isTournament: leagueHint?.isTournament,
    logo: leagueHint?.logo,
    logoDark: leagueHint?.logoDark,
  });

  const hasShootout =
    home.penaltyScore !== undefined || away.penaltyScore !== undefined;
  const status = mapEspnStatus(comp?.status ?? event?.status, hasShootout);

  const dateIso = String(event?.date ?? comp?.date ?? '');
  const { dateLocalAr, timeLocalAr } = toArgentinaDateParts(dateIso);

  const { goals, cards, homeReds, awayReds } = extractEspnDetailsGoalsAndCards(
    comp,
    home.externalIds.espn,
    away.externalIds.espn,
  );
  home.redCards = homeReds;
  home.yellowCards = cards.filter(
    (c) => c.teamSide === 'home' && c.cardType === 'yellow',
  ).length;
  away.redCards = awayReds;
  away.yellowCards = cards.filter(
    (c) => c.teamSide === 'away' && c.cardType === 'yellow',
  ).length;

  const venueRaw = comp?.venue ?? event?.venue;
  const venue = venueRaw?.fullName
    ? {
        id: venueRaw?.id ? String(venueRaw.id) : undefined,
        name: String(venueRaw.fullName),
        city: venueRaw?.address?.city ? String(venueRaw.address.city) : undefined,
        country: venueRaw?.address?.country
          ? String(venueRaw.address.country)
          : undefined,
      }
    : undefined;

  const note =
    comp?.altGameNote ||
    comp?.notes?.[0]?.headline ||
    event?.season?.slug ||
    undefined;

  const urlSlug = `${home.slug}-vs-${away.slug}`;

  return {
    id: `espn:${espnId}`,
    canonicalKey: `${dateLocalAr}:${league.canonicalSlug}:${urlSlug}`,
    externalIds: { espn: espnId },
    sources: ['espn'],
    urlSlug,
    dateIso,
    dateLocalAr,
    timeLocalAr,
    stageRound: comp?.altGameNote
      ? String(comp.altGameNote)
      : event?.season?.slug
        ? String(event.season.slug)
        : undefined,
    league,
    status,
    home,
    away,
    goals,
    cards,
    venue,
    broadcasts: mapEspnBroadcasts(comp),
    odds: mapEspnOdds(comp?.odds),
    note: note ? String(note) : undefined,
  };
}

export async function fetchEspnScoreboard(
  espnDate: string,
  leagueSlug = 'all',
): Promise<{
  leagues: UnifiedLeagueRef[];
  matches: UnifiedMatch[];
}> {
  const sbPromise = fetchJson<any>(
    `${ESPN_SITE_API}/${leagueSlug}/scoreboard?lang=es&region=ar&dates=${espnDate}&limit=300`,
    { timeoutMs: 8500 },
  );

  const htmlPromise =
    leagueSlug === 'all'
      ? fetchText(`${ESPN_WEB_BASE}/futbol/resultados/_/fecha/${espnDate}`, {
          timeoutMs: 8500,
          retries: 1,
        })
      : Promise.resolve('');

  const [sbRes, htmlRes] = await Promise.allSettled([sbPromise, htmlPromise]);

  const sbData = sbRes.status === 'fulfilled' ? sbRes.value : null;
  const htmlText = htmlRes.status === 'fulfilled' ? htmlRes.value : '';

  const leagueByEventId = new Map<string, EspnLeagueHint>();
  const leagueById = new Map<string, EspnLeagueHint>();

  if (htmlText) {
    const fitt = extractEspnFittData<any>(htmlText);
    const gmsByLeague = fitt?.page?.content?.scoreboard?.gmsByLeague;
    if (Array.isArray(gmsByLeague)) {
      for (const grp of gmsByLeague) {
        const lg = grp?.league ?? grp;
        const hint: EspnLeagueHint = {
          id: lg?.id ? String(lg.id) : undefined,
          name: lg?.name ? String(lg.name) : undefined,
          abbrev: lg?.abbrev ? String(lg.abbrev) : undefined,
          slug: lg?.slug ? String(lg.slug) : undefined,
          isTournament: Boolean(lg?.isTournament),
        };
        if (hint.id) leagueById.set(hint.id, hint);
        const evts = Array.isArray(grp?.evts)
          ? grp.evts
          : Array.isArray(grp?.games)
            ? grp.games
            : [];
        for (const ev of evts) {
          if (ev?.id) {
            leagueByEventId.set(String(ev.id), hint);
          }
        }
      }
    }
  }

  const rawLeagues = Array.isArray(sbData?.leagues) ? sbData.leagues : [];
  for (const lg of rawLeagues) {
    const id = lg?.id ? String(lg.id) : undefined;
    if (!id) continue;
    const { defaultLogo, darkLogo } = getEspnLogoUrls(lg, id, 'league');
    const existing = leagueById.get(id);
    leagueById.set(id, {
      id,
      name: lg?.name ?? existing?.name,
      shortName: lg?.shortName ?? existing?.shortName,
      abbrev: lg?.abbreviation ?? existing?.abbrev,
      slug: lg?.slug ?? existing?.slug,
      isTournament: Boolean(lg?.isTournament ?? existing?.isTournament),
      logo: defaultLogo ?? existing?.logo,
      logoDark: darkLogo ?? existing?.logoDark,
    });
  }

  const rawEvents = Array.isArray(sbData?.events) ? sbData.events : [];
  const matches: UnifiedMatch[] = [];
  const leaguesMap = new Map<string, UnifiedLeagueRef>();

  for (const ev of rawEvents) {
    if (!ev?.id) continue;
    const uidLid = extractUidLeagueId(ev?.uid);
    const hint =
      leagueByEventId.get(String(ev.id)) ??
      (uidLid ? leagueById.get(uidLid) : undefined) ??
      (leagueSlug !== 'all' ? { slug: leagueSlug, id: uidLid } : { id: uidLid });
    const mapped = mapEspnEventToUnifiedMatch(ev, hint);
    matches.push(mapped);
    if (!leaguesMap.has(mapped.league.canonicalSlug)) {
      leaguesMap.set(mapped.league.canonicalSlug, mapped.league);
    }
  }

  return {
    leagues: Array.from(leaguesMap.values()),
    matches,
  };
}

function mapEspnEventType(rawType: any): MatchEventType {
  const t = String(rawType?.type ?? rawType?.id ?? '').toLowerCase();
  const txt = String(rawType?.text ?? '').toLowerCase();
  if (t.includes('own-goal') || txt.includes('en contra')) return 'own_goal';
  if (t.includes('penalty') && (txt.includes('ataj') || txt.includes('errad') || txt.includes('miss'))) {
    return 'penalty_missed';
  }
  if (t.includes('penalty') || txt.includes('penal')) return 'penalty_goal';
  if (t.includes('goal') || txt.includes('gol')) return 'goal';
  if (t.includes('yellow-card') || txt.includes('amarilla')) return 'yellow_card';
  if (t.includes('second-yellow') || txt.includes('doble amarilla')) return 'second_yellow';
  if (t.includes('red-card') || txt.includes('roja')) return 'red_card';
  if (t.includes('substitution') || txt.includes('cambio')) return 'substitution';
  if (t.includes('var')) return 'var';
  return 'other';
}

function mapEspnPlayerStatsArray(rawStats: unknown): PlayerMatchStats | undefined {
  if (!Array.isArray(rawStats) || rawStats.length === 0) return undefined;
  const out: PlayerMatchStats = {};
  for (const s of rawStats) {
    const key = String(s?.name ?? '');
    const val = toNum(s?.value);
    if (!key || val === null) continue;
    if (key === 'totalGoals') out.goals = val;
    else if (key === 'goalAssists') out.assists = val;
    else if (key === 'totalShots') out.shots = val;
    else if (key === 'shotsOnTarget') out.shotsOnTarget = val;
    else if (key === 'saves') out.saves = val;
    else if (key === 'goalsConceded') out.goalsConceded = val;
    else if (key === 'yellowCards') out.yellowCards = val;
    else if (key === 'redCards') out.redCards = val;
    else if (key === 'foulsCommitted') out.foulsCommitted = val;
    else if (key === 'foulsSuffered') out.foulsSuffered = val;
    else if (val !== 0) out[key] = val;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function fetchEspnMatchSummary(
  eventId: string,
): Promise<UnifiedMatchDetail> {
  const data = await fetchJson<any>(
    `${ESPN_SITE_API}/all/summary?event=${eventId}&lang=es&region=ar`,
    { timeoutMs: 8500 },
  );

  const headerComp = data?.header?.competitions?.[0];
  const headerLeague = data?.header?.league;
  if (!headerComp) {
    throw new Error(`ESPN summary empty for event ${eventId}`);
  }

  const fakeEvent = {
    id: eventId,
    uid: data?.header?.uid,
    date: headerComp?.date,
    season: data?.header?.season,
    competitions: [headerComp],
  };

  const { defaultLogo, darkLogo } = getEspnLogoUrls(
    headerLeague,
    headerLeague?.id ? String(headerLeague.id) : undefined,
    'league',
  );

  const match = mapEspnEventToUnifiedMatch(fakeEvent, {
    id: headerLeague?.id ? String(headerLeague.id) : undefined,
    name: headerLeague?.name,
    shortName: headerLeague?.shortName,
    abbrev: headerLeague?.abbreviation,
    slug: headerLeague?.slug,
    isTournament: Boolean(headerLeague?.isTournament),
    logo: defaultLogo,
    logoDark: darkLogo,
  });

  // Broadcasts de summary
  if (Array.isArray(data?.broadcasts) && data.broadcasts.length > 0) {
    match.broadcasts = mapEspnBroadcasts({ broadcasts: data.broadcasts });
  }

  // Venue y oficiales en gameInfo
  const gameInfo: Array<{ label: string; value: string }> = [];
  let referee: string | undefined;
  let attendance: number | null = toNum(data?.gameInfo?.attendance);

  if (data?.gameInfo?.venue?.fullName) {
    match.venue = {
      id: data.gameInfo.venue.id ? String(data.gameInfo.venue.id) : undefined,
      name: String(data.gameInfo.venue.fullName),
      city: data.gameInfo.venue.address?.city,
      country: data.gameInfo.venue.address?.country,
    };
    gameInfo.push({ label: 'Estadio', value: String(data.gameInfo.venue.fullName) });
  }
  if (attendance && attendance > 0) {
    gameInfo.push({ label: 'Espectadores', value: String(attendance) });
  }
  if (Array.isArray(data?.gameInfo?.officials)) {
    const ref =
      data.gameInfo.officials.find((o: any) =>
        String(o?.position?.displayName ?? '').toLowerCase().includes('refer'),
      ) ?? data.gameInfo.officials[0];
    if (ref?.fullName || ref?.displayName) {
      referee = String(ref.fullName ?? ref.displayName);
      gameInfo.push({ label: 'Árbitro', value: referee });
    }
  }

  // Estadísticas boxscore
  const statistics: MatchStatistic[] = [];
  const bsTeams = Array.isArray(data?.boxscore?.teams) ? data.boxscore.teams : [];
  const bsHome = bsTeams.find((t: any) => t?.homeAway === 'home') ?? bsTeams[0];
  const bsAway = bsTeams.find((t: any) => t?.homeAway === 'away') ?? bsTeams[1];

  if (bsHome?.statistics && bsAway?.statistics) {
    const awayMap = new Map<string, any>();
    for (const s of bsAway.statistics) {
      if (s?.name) awayMap.set(String(s.name), s);
    }
    for (const hStat of bsHome.statistics) {
      const key = String(hStat?.name ?? '');
      const aStat = awayMap.get(key);
      if (!key || !aStat) continue;
      const hv = String(hStat.displayValue ?? '0');
      const av = String(aStat.displayValue ?? '0');
      const hNum = toNum(hv.replace('%', ''));
      const aNum = toNum(av.replace('%', ''));
      const sum = hNum !== null && aNum !== null && hNum + aNum > 0 ? hNum + aNum : null;
      statistics.push({
        key,
        label: String(hStat.label ?? key),
        homeValue: hv,
        awayValue: av,
        homeNumeric: hNum,
        awayNumeric: aNum,
        homePct: sum ? Math.round((hNum! / sum) * 100) : null,
        awayPct: sum ? Math.round((aNum! / sum) * 100) : null,
      });
    }
  }
  match.hasStatistics = statistics.length > 0;

  // Alineaciones + stats individuales de jugadores
  let homeLineup: TeamLineup | undefined;
  let awayLineup: TeamLineup | undefined;
  if (Array.isArray(data?.rosters)) {
    for (const r of data.rosters) {
      const side: 'home' | 'away' = r?.homeAway === 'away' ? 'away' : 'home';
      const starters: LineupPlayer[] = [];
      const bench: LineupPlayer[] = [];

      for (const entry of Array.isArray(r?.roster) ? r.roster : []) {
        const ath = entry?.athlete ?? {};
        const player: LineupPlayer = {
          id: ath?.id ? `espn-${ath.id}` : undefined,
          name: String(ath?.displayName ?? ath?.fullName ?? 'Jugador'),
          shortName: ath?.shortName ? String(ath.shortName) : undefined,
          jerseyNumber: toNum(entry?.jersey),
          position: String(entry?.position?.displayName ?? entry?.position?.name ?? ''),
          formationPosition: entry?.formationPlace ? String(entry.formationPlace) : undefined,
          isCaptain: Boolean(entry?.captain),
          starter: Boolean(entry?.starter),
          subbedIn: Boolean(entry?.subbedIn),
          subbedOut: Boolean(entry?.subbedOut),
          stats: mapEspnPlayerStatsArray(entry?.stats),
        };
        if (player.starter) starters.push(player);
        else bench.push(player);
      }

      const lineupObj: TeamLineup = {
        side,
        teamId: side === 'home' ? match.home.id : match.away.id,
        teamName: side === 'home' ? match.home.name : match.away.name,
        status: starters.length > 0 ? 'Confirmado' : 'Disponible',
        formation: String(r?.formation ?? ''),
        supportsVisualLineups: false,
        starters,
        bench,
      };
      if (side === 'home') homeLineup = lineupObj;
      else awayLineup = lineupObj;
    }
  }
  match.hasLineups = Boolean(
    (homeLineup?.starters.length ?? 0) > 0 || (awayLineup?.starters.length ?? 0) > 0,
  );

  // Eventos clave y goles/tarjetas
  const events: MatchEvent[] = [];
  const goals: MatchGoal[] = [];
  const cards: MatchCard[] = [];

  if (Array.isArray(data?.keyEvents)) {
    for (const ev of data.keyEvents) {
      const teamId = ev?.team?.id ? String(ev.team.id) : '';
      const teamSide: 'home' | 'away' | 'neutral' =
        teamId && teamId === match.away.externalIds.espn
          ? 'away'
          : teamId && teamId === match.home.externalIds.espn
            ? 'home'
            : 'neutral';
      const evType = mapEspnEventType(ev?.type);
      const min = parseMinuteParts(ev?.clock?.displayValue);
      const participants = Array.isArray(ev?.participants) ? ev.participants : [];
      const p0 = participants[0]?.athlete;
      const p1 = participants[1]?.athlete;

      events.push({
        id: ev?.id ? String(ev.id) : undefined,
        isShootout: Boolean(ev?.shootout),
        type: evType,
        rawType: ev?.type?.type ?? ev?.type?.id,
        teamSide,
        teamId:
          teamSide === 'home'
            ? match.home.id
            : teamSide === 'away'
              ? match.away.id
              : undefined,
        teamName: ev?.team?.displayName ? String(ev.team.displayName) : undefined,
        minute: min.minute,
        minuteDisplay: min.display || String(ev?.clock?.displayValue ?? ''),
        playerName: p0?.displayName ? String(p0.displayName) : undefined,
        playerId: p0?.id ? `espn-${p0.id}` : undefined,
        secondaryPlayerName: p1?.displayName ? String(p1.displayName) : undefined,
        description: ev?.text ? String(ev.text) : undefined,
        source: 'espn',
      });

      if (teamSide !== 'neutral' && !ev?.shootout) {
        if (evType === 'goal' || evType === 'own_goal' || evType === 'penalty_goal') {
          goals.push({
            teamSide,
            playerName: String(p0?.displayName ?? 'Gol'),
            playerId: p0?.id ? `espn-${p0.id}` : undefined,
            assistName: p1?.displayName ? String(p1.displayName) : undefined,
            minute: min.minute,
            minuteDisplay: min.display || String(ev?.clock?.displayValue ?? ''),
            isPenalty: evType === 'penalty_goal',
            isOwnGoal: evType === 'own_goal',
          });
        } else if (
          evType === 'yellow_card' ||
          evType === 'red_card' ||
          evType === 'second_yellow'
        ) {
          cards.push({
            teamSide,
            cardType:
              evType === 'yellow_card'
                ? 'yellow'
                : evType === 'second_yellow'
                  ? 'second_yellow'
                  : 'red',
            playerName: String(p0?.displayName ?? 'Tarjeta'),
            playerId: p0?.id ? `espn-${p0.id}` : undefined,
            minute: min.minute,
            minuteDisplay: min.display || String(ev?.clock?.displayValue ?? ''),
          });
        }
      }
    }
  }

  if (goals.length > 0) match.goals = goals;
  if (cards.length > 0) {
    match.cards = cards;
    match.home.yellowCards = cards.filter(
      (c) => c.teamSide === 'home' && c.cardType === 'yellow',
    ).length;
    match.away.yellowCards = cards.filter(
      (c) => c.teamSide === 'away' && c.cardType === 'yellow',
    ).length;
    match.home.redCards = cards.filter(
      (c) => c.teamSide === 'home' && c.cardType !== 'yellow',
    ).length;
    match.away.redCards = cards.filter(
      (c) => c.teamSide === 'away' && c.cardType !== 'yellow',
    ).length;
  }

  // Comentario minuto a minuto
  const commentary: CommentaryItem[] = Array.isArray(data?.commentary)
    ? data.commentary
        .filter((c: any) => c?.text)
        .map((c: any) => {
          const min = parseMinuteParts(c?.time?.displayValue);
          return {
            id: c?.play?.id ? String(c.play.id) : undefined,
            minute: min.minute,
            minuteDisplay: min.display || String(c?.time?.displayValue ?? ''),
            period: toNum(c?.play?.period?.number),
            text: String(c.text),
            type: c?.play?.type?.text ? String(c.play.type.text) : undefined,
            teamName: c?.play?.team?.displayName
              ? String(c.play.team.displayName)
              : undefined,
            wallclock: c?.play?.wallclock ? String(c.play.wallclock) : undefined,
          };
        })
    : [];

  // Racha de últimos 5 partidos por equipo
  const parseLastFive = (entry: any): RecentFormMatch[] => {
    const evs = Array.isArray(entry?.events) ? entry.events : [];
    const teamId = entry?.team?.id ? String(entry.team.id) : '';
    return evs.map((e: any) => {
      const isHome = teamId && String(e?.homeTeamId) === teamId;
      const hs = toNum(e?.homeTeamScore);
      const as = toNum(e?.awayTeamScore);
      const resRaw = String(e?.gameResult ?? '').toUpperCase();
      const result: RecentFormMatch['result'] =
        resRaw === 'G' || resRaw === 'W'
          ? 'W'
          : resRaw === 'E' || resRaw === 'D'
            ? 'D'
            : resRaw === 'P' || resRaw === 'L'
              ? 'L'
              : 'U';

      return {
        id: e?.id ? `espn:${e.id}` : undefined,
        date: e?.gameDate ? String(e.gameDate) : undefined,
        opponentName: String(e?.opponent?.displayName ?? ''),
        opponentLogo: e?.opponent?.logo ? String(e.opponent.logo) : undefined,
        homeOrAway: isHome ? 'home' : 'away',
        scoreFor: isHome ? hs : as,
        scoreAgainst: isHome ? as : hs,
        result,
        leagueName: e?.leagueName ? String(e.leagueName) : undefined,
      };
    });
  };

  const l5Arr = Array.isArray(data?.lastFiveGames) ? data.lastFiveGames : [];
  const homeL5Entry = l5Arr.find(
    (x: any) => String(x?.team?.id) === match.home.externalIds.espn,
  );
  const awayL5Entry = l5Arr.find(
    (x: any) => String(x?.team?.id) === match.away.externalIds.espn,
  );
  const homeMatches = parseLastFive(homeL5Entry);
  const awayMatches = parseLastFive(awayL5Entry);

  let prediction: MatchPrediction | undefined;
  const pick0 = Array.isArray(data?.pickcenter) ? data.pickcenter[0] : undefined;
  if (pick0) {
    prediction = {
      picksText: pick0.details ? String(pick0.details) : undefined,
    };
  }

  const videos = Array.isArray(data?.videos)
    ? data.videos.map((v: any) => ({
        id: v?.id ? String(v.id) : undefined,
        title: String(v?.headline ?? v?.title ?? ''),
        description: v?.description ? String(v.description) : undefined,
        thumbnail: v?.thumbnail ? String(v.thumbnail) : undefined,
        url: v?.links?.web?.href ?? v?.links?.source?.href,
        duration: toNum(v?.duration) ?? undefined,
      }))
    : undefined;

  const rawArticles = Array.isArray(data?.news?.articles)
    ? data.news.articles
    : Array.isArray(data?.news)
      ? data.news
      : [];
  const news =
    rawArticles.length > 0
      ? rawArticles.map((n: any) => ({
          headline: String(n?.headline ?? ''),
          description: n?.description ? String(n.description) : undefined,
          url: n?.links?.web?.href ? String(n.links.web.href) : undefined,
          published: n?.published ? String(n.published) : undefined,
          image: n?.images?.[0]?.url ? String(n.images[0].url) : undefined,
        }))
      : undefined;

  return {
    match,
    gameInfo,
    referee,
    attendance,
    events,
    stageScores: [],
    statistics,
    lineups: {
      home: homeLineup,
      away: awayLineup,
    },
    missingPlayers: {
      home: [],
      away: [],
    },
    commentary,
    prediction,
    recentForm: {
      home: homeMatches
        .map((m) => m.result)
        .filter((r): r is 'W' | 'D' | 'L' => r !== 'U'),
      away: awayMatches
        .map((m) => m.result)
        .filter((r): r is 'W' | 'D' | 'L' => r !== 'U'),
      homeMatches,
      awayMatches,
    },
    videos: videos && videos.length > 0 ? videos : undefined,
    news,
  };
}

export async function fetchEspnStandings(
  leagueSlug: string,
): Promise<StandingGroup[]> {
  const data = await fetchJson<any>(
    `${ESPN_STANDINGS_API}/${leagueSlug}/standings?lang=es&region=ar`,
    { timeoutMs: 8500 },
  );

  const rawGroups = Array.isArray(data?.children)
    ? data.children
    : data?.standings
      ? [{ name: data.name ?? 'Posiciones', standings: data.standings }]
      : [];

  const groups: StandingGroup[] = [];

  for (const grp of rawGroups) {
    const entries = Array.isArray(grp?.standings?.entries)
      ? grp.standings.entries
      : [];
    if (entries.length === 0) continue;

    const legendMap = new Map<string, string>();
    const rows: StandingRow[] = entries.map((entry: any, idx: number) => {
      const team = entry?.team ?? {};
      const teamId = team?.id ? String(team.id) : '';
      const { defaultLogo } = getEspnLogoUrls(team, teamId, 'team');

      const statLookup = new Map<string, number>();
      for (const s of Array.isArray(entry?.stats) ? entry.stats : []) {
        const val = toNum(s?.value);
        if (s?.name && val !== null) {
          statLookup.set(String(s.name), val);
        }
      }

      const qColor = normalizeHex(entry?.note?.color);
      const qLabel = entry?.note?.description ? String(entry.note.description) : undefined;
      if (qColor && qLabel && !legendMap.has(qColor)) {
        legendMap.set(qColor, qLabel);
      }

      return {
        position: statLookup.get('rank') ?? idx + 1,
        team: {
          id: teamId ? `espn-${teamId}` : deterministicId('team', String(team?.displayName ?? idx)),
          externalIds: { espn: teamId || undefined },
          name: String(team?.displayName ?? team?.name ?? 'Equipo'),
          shortName: team?.shortDisplayName ? String(team.shortDisplayName).trim() : undefined,
          slug: slugify(String(team?.displayName ?? '')),
          logo: defaultLogo ?? '',
        },
        played: statLookup.get('gamesPlayed') ?? 0,
        won: statLookup.get('wins') ?? 0,
        drawn: statLookup.get('ties') ?? 0,
        lost: statLookup.get('losses') ?? 0,
        goalsFor: statLookup.get('pointsFor') ?? 0,
        goalsAgainst: statLookup.get('pointsAgainst') ?? 0,
        goalDifference: statLookup.get('pointDifferential') ?? 0,
        points: statLookup.get('points') ?? 0,
        qualificationColor: qColor,
        qualificationLabel: qLabel,
      };
    });

    const table: StandingTable = {
      name: String(grp?.name ?? data?.name ?? 'Posiciones'),
      type: 'positions',
      rows,
      legend:
        legendMap.size > 0
          ? Array.from(legendMap.entries()).map(([color, label]) => ({ color, label }))
          : undefined,
    };

    groups.push({
      name: String(grp?.name ?? 'General'),
      tables: [table],
    });
  }

  return groups;
}

export async function fetchEspnLeaguesCatalog(): Promise<UnifiedLeagueRef[]> {
  const data = await fetchJson<any>(ESPN_DROPDOWN_URL, { timeoutMs: 9000 });
  const items = Array.isArray(data?.leagues)
    ? data.leagues
    : Array.isArray(data?.items)
      ? data.items
      : [];

  return items.map((item: any) =>
    mapEspnLeagueRef({
      id: item?.id ? String(item.id) : undefined,
      name: item?.name ? String(item.name) : undefined,
      shortName: item?.shortName ? String(item.shortName) : undefined,
      abbrev: item?.abbreviation ? String(item.abbreviation) : undefined,
      slug: item?.slug ? String(item.slug) : undefined,
      logo: item?.logos?.[0]?.href,
      logoDark: item?.logos?.[1]?.href,
    }),
  );
}

export async function fetchEspnTeam(
  teamId: string,
  leagueSlug = 'arg.1',
): Promise<Partial<UnifiedTeamDetail>> {
  const mapping = findLeagueMapping(leagueSlug);
  const resolvedSlug = mapping?.espnSlug ?? leagueSlug;
  const data = await fetchJson<any>(
    `${ESPN_SITE_API}/${resolvedSlug}/teams/${teamId}?enable=roster,stats,schedule&lang=es&region=ar`,
    { timeoutMs: 8500 },
  );

  const rawTeam = data?.team;
  if (!rawTeam) {
    throw new Error(`ESPN team ${teamId} not found in ${resolvedSlug}`);
  }

  const teamRef = mapEspnTeamRef({
    team: rawTeam,
    records: rawTeam?.record?.items,
  });

  const info: Array<{ label: string; value: string }> = [];
  if (rawTeam?.standingSummary) {
    teamRef.standingSummary = String(rawTeam.standingSummary);
    info.push({ label: 'Posición', value: String(rawTeam.standingSummary) });
  }

  const athletes = Array.isArray(rawTeam?.athletes) ? rawTeam.athletes : [];
  const grouped = new Map<string, UnifiedTeamDetail['squad'][number]['players']>();
  for (const a of athletes) {
    const pos = String(a?.position?.displayName ?? a?.position?.name ?? 'Plantel');
    const arr = grouped.get(pos) ?? [];
    arr.push({
      id: a?.id ? `espn-${a.id}` : undefined,
      name: String(a?.displayName ?? a?.fullName ?? 'Jugador'),
      shortName: a?.shortName ? String(a.shortName) : undefined,
      jerseyNumber: toNum(a?.jersey),
      position: pos,
      age: toNum(a?.age),
      height: a?.displayHeight ? String(a.displayHeight) : undefined,
      weight: a?.displayWeight ? String(a.displayWeight) : undefined,
      isStaff: false,
      headshot: a?.headshot?.href ? String(a.headshot.href) : undefined,
    });
    grouped.set(pos, arr);
  }

  const scheduleEvents = Array.isArray(rawTeam?.nextEvent)
    ? rawTeam.nextEvent
    : [];
  const upcoming = scheduleEvents
    .filter((e: any) => e?.id)
    .map((e: any) =>
      mapEspnEventToUnifiedMatch(e, {
        slug: resolvedSlug,
        id: mapping?.espnId,
        name: mapping?.name,
      }),
    );

  return {
    team: teamRef,
    info,
    squad: Array.from(grouped.entries()).map(([groupName, players]) => ({
      groupName,
      players,
    })),
    matches: {
      recent: [],
      upcoming,
      all: upcoming,
    },
  };
}

export function findMappedEspnSlugsForScoreboard(slug?: string): string[] {
  if (!slug) return ['all'];
  const m = findLeagueMapping(slug);
  if (m?.espnSlug) return [m.espnSlug];
  if (slug.includes('.')) return [slug];
  const fallback = LEAGUE_MAPPINGS.find((x) => x.canonicalSlug === slug);
  return fallback?.espnSlug ? [fallback.espnSlug] : ['all'];
}
