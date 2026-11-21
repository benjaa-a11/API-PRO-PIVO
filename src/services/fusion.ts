import { LEAGUE_MAPPINGS, findLeagueMapping } from '../config/mappings.ts';
import { HttpError } from '../utils/http.ts';
import { isLeagueRefExcluded } from './league-filter-store.ts';
import {
  fetchPromiedosDay,
  fetchPromiedosLeague,
  fetchPromiedosLeagueRound,
  fetchPromiedosMatchDetail,
  fetchPromiedosMenu,
  fetchPromiedosTeam,
} from '../scrapers/promiedos.ts';
import type {
  DataSourceName,
  EnvBindings,
  LeagueCategory,
  LineupPlayer,
  MatchCard,
  MatchEvent,
  MatchGoal,
  MatchStatistic,
  ScoreboardDayPayload,
  StandingGroup,
  TeamLineup,
  TvBroadcast,
  UnifiedLeagueDetail,
  UnifiedLeagueRef,
  UnifiedMatch,
  UnifiedMatchDetail,
  UnifiedTeamDetail,
  UnifiedTeamRef,
} from '../types/schema.ts';
import { CacheManager, type CacheStatus, sharedCache } from '../utils/cache.ts';
import {
  areSameTeam,
  formatDateFormats,
  slugify,
  teamsMatchScore,
} from '../utils/normalize.ts';

export interface ServiceResult<T> {
  data: T;
  cache: CacheStatus;
  sources: DataSourceName[];
  warnings: string[];
  tookMs: number;
}

export interface MatchQueryFilters {
  league?: string;
  state?: string;
  team?: string;
  liveOnly?: boolean;
}

const STAT_KEY_CANONICAL: Record<string, string> = {
  possessionpct: 'posesion',
  'posesion-de-balon': 'posesion',
  posesion: 'posesion',
  totalshots: 'remates-totales',
  'total-remates': 'remates-totales',
  shotsontarget: 'remates-al-arco',
  'remates-al-arco': 'remates-al-arco',
  woncorners: 'tiros-de-esquina',
  corners: 'tiros-de-esquina',
  'tiros-de-esquina': 'tiros-de-esquina',
  foulscommitted: 'faltas',
  faltas: 'faltas',
  offsides: 'fuera-de-juego',
  'fuera-de-juego': 'fuera-de-juego',
  yellowcards: 'tarjetas-amarillas',
  'tarjetas-amarillas': 'tarjetas-amarillas',
  redcards: 'tarjetas-rojas',
  'tarjetas-rojas': 'tarjetas-rojas',
  saves: 'atajadas',
  atajadas: 'atajadas',
};

function parseTtl(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getLeaguePriority(league: UnifiedLeagueRef): number {
  const mapped =
    findLeagueMapping(league.canonicalSlug) ??
    (league.externalIds.promiedos ? findLeagueMapping(league.externalIds.promiedos) : undefined) ??
    (league.externalIds.espn ? findLeagueMapping(league.externalIds.espn) : undefined);

  if (mapped) return mapped.priority;
  if (league.countryName?.toLowerCase() === 'argentina') return 120;
  if (league.isInternational) return 200;
  return 500;
}

function flipTeamSide(side: 'home' | 'away'): 'home' | 'away' {
  return side === 'home' ? 'away' : 'home';
}

export function orientEspnMatch(espn: UnifiedMatch, swapped: boolean): UnifiedMatch {
  if (!swapped) return espn;
  return {
    ...espn,
    home: espn.away,
    away: espn.home,
    goals: espn.goals.map((g) => ({ ...g, teamSide: flipTeamSide(g.teamSide) })),
    cards: espn.cards.map((c) => ({ ...c, teamSide: flipTeamSide(c.teamSide) })),
  };
}

function mergeTeamRefs(pm: UnifiedTeamRef, espn: UnifiedTeamRef): UnifiedTeamRef {
  return {
    id: pm.id || espn.id,
    externalIds: {
      promiedos: pm.externalIds.promiedos,
      espn: espn.externalIds.espn,
    },
    name: pm.name || espn.name,
    shortName: pm.shortName || espn.shortName,
    abbreviation: espn.abbreviation ?? pm.abbreviation,
    slug: pm.slug || espn.slug,
    logo: pm.logos.promiedosLarge || pm.logos.promiedos || espn.logos.espn || pm.logo || espn.logo,
    logos: {
      promiedos: pm.logos.promiedos,
      promiedosLarge: pm.logos.promiedosLarge,
      espn: espn.logos.espn,
      espnDark: espn.logos.espnDark,
    },
    countryId: pm.countryId ?? espn.countryId,
    countryFlag: pm.countryFlag ?? espn.countryFlag,
    colors: {
      primary: pm.colors?.primary ?? espn.colors?.primary,
      secondary: espn.colors?.secondary ?? pm.colors?.secondary,
      text: pm.colors?.text ?? espn.colors?.text,
    },
    form: espn.form ?? pm.form,
    record: espn.record ?? pm.record,
    standingSummary: espn.standingSummary ?? pm.standingSummary,
    score:
      pm.score !== null
        ? pm.score
        : espn.score,
    penaltyScore: pm.penaltyScore ?? espn.penaltyScore,
    redCards: Math.max(pm.redCards, espn.redCards),
    yellowCards: pm.yellowCards ?? espn.yellowCards,
    winner: pm.winner ?? espn.winner,
  };
}

function mergeLeagueRefs(pm: UnifiedLeagueRef, espn: UnifiedLeagueRef): UnifiedLeagueRef {
  return {
    id: pm.canonicalSlug || espn.canonicalSlug,
    canonicalSlug: pm.canonicalSlug || espn.canonicalSlug,
    externalIds: {
      promiedos: pm.externalIds.promiedos ?? espn.externalIds.promiedos,
      espn: espn.externalIds.espn ?? pm.externalIds.espn,
    },
    name: pm.name || espn.name,
    shortName: espn.shortName ?? pm.shortName,
    slug: pm.slug || espn.slug,
    countryId: pm.countryId ?? espn.countryId,
    countryName: pm.countryName ?? espn.countryName,
    countryFlag: pm.countryFlag ?? espn.countryFlag,
    isInternational: pm.isInternational || espn.isInternational,
    logo: pm.logo || espn.logo,
    logos: {
      promiedos: pm.logos.promiedos,
      espn: espn.logos.espn,
      espnDark: espn.logos.espnDark,
    },
    promiedosUrl: pm.promiedosUrl,
    espnUrl: espn.espnUrl,
  };
}

function mergeBroadcasts(a: TvBroadcast[], b: TvBroadcast[]): TvBroadcast[] {
  const byKey = new Map<string, TvBroadcast>();
  for (const item of [...a, ...b]) {
    const key = (item.id || item.slug || item.name).trim().toLowerCase();
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, item);
      continue;
    }
    byKey.set(key, {
      ...prev,
      ...item,
      id: prev.id ?? item.id,
      promiedosId: prev.promiedosId ?? item.promiedosId,
      logo: prev.logo ?? item.logo,
      mapped: prev.mapped || item.mapped,
    });
  }
  return Array.from(byKey.values());
}

function mergeGoals(a: MatchGoal[], b: MatchGoal[]): MatchGoal[] {
  const merged = [...a];
  for (const g of b) {
    const exists = merged.some(
      (m) =>
        m.teamSide === g.teamSide &&
        Math.abs((m.minute ?? 0) - (g.minute ?? 0)) <= 2 &&
        (areSameTeam(m.playerName, g.playerName) ||
          m.playerName.toLowerCase().includes(g.playerName.split(' ').pop()?.toLowerCase() ?? '')),
    );
    if (!exists) {
      merged.push(g);
    }
  }
  return merged.sort((x, y) => (x.minute ?? 999) - (y.minute ?? 999));
}

function mergeCards(a: MatchCard[], b: MatchCard[]): MatchCard[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const merged = [...a];
  for (const c of b) {
    const exists = merged.some(
      (m) =>
        m.teamSide === c.teamSide &&
        m.cardType === c.cardType &&
        Math.abs((m.minute ?? 0) - (c.minute ?? 0)) <= 2 &&
        areSameTeam(m.playerName, c.playerName),
    );
    if (!exists) {
      merged.push(c);
    }
  }
  return merged.sort((x, y) => (x.minute ?? 999) - (y.minute ?? 999));
}

function pickBestStatus(pm: UnifiedMatch, espn: UnifiedMatch) {
  if (pm.status.state === 'PRE' && (espn.status.isLive || espn.status.isFinished)) {
    return espn.status;
  }
  if (espn.status.state === 'PEN' && pm.status.state === 'FT') {
    return { ...pm.status, state: 'PEN' as const };
  }
  return {
    ...pm.status,
    minute: pm.status.minute ?? espn.status.minute,
    minuteDisplay: pm.status.minuteDisplay || espn.status.minuteDisplay,
    period: pm.status.period ?? espn.status.period,
  };
}

function fuseTwoMatches(pm: UnifiedMatch, rawEspn: UnifiedMatch, swapped: boolean): UnifiedMatch {
  const espn = orientEspnMatch(rawEspn, swapped);
  const home = mergeTeamRefs(pm.home, espn.home);
  const away = mergeTeamRefs(pm.away, espn.away);
  const status = pickBestStatus(pm, espn);

  // Si ESPN está en vivo y Promiedos todavía mostraba null, actualizar marcador
  if (status.isLive && espn.home.score !== null && home.score === null) {
    home.score = espn.home.score;
  }
  if (status.isLive && espn.away.score !== null && away.score === null) {
    away.score = espn.away.score;
  }

  return {
    id: pm.id,
    canonicalKey: pm.canonicalKey,
    externalIds: {
      promiedos: pm.externalIds.promiedos,
      espn: espn.externalIds.espn,
    },
    sources: ['promiedos', 'espn'],
    urlSlug: pm.urlSlug,
    dateIso: pm.dateIso || espn.dateIso,
    dateLocalAr: pm.dateLocalAr || espn.dateLocalAr,
    timeLocalAr: pm.timeLocalAr || espn.timeLocalAr,
    stageRound: pm.stageRound ?? espn.stageRound,
    league: mergeLeagueRefs(pm.league, espn.league),
    status,
    home,
    away,
    goals: mergeGoals(pm.goals, espn.goals),
    cards: mergeCards(pm.cards, espn.cards),
    venue: pm.venue ?? espn.venue,
    broadcasts: mergeBroadcasts(pm.broadcasts, espn.broadcasts),
    odds: pm.odds ?? espn.odds,
    hasLineups: pm.hasLineups ?? espn.hasLineups,
    hasStatistics: pm.hasStatistics ?? espn.hasStatistics,
    note: pm.note ?? espn.note,
  };
}

function hoursBetweenIso(a?: string, b?: string): number | null {
  if (!a || !b) return null;
  const t1 = Date.parse(a);
  const t2 = Date.parse(b);
  if (Number.isNaN(t1) || Number.isNaN(t2)) return null;
  return Math.abs(t1 - t2) / 3600000;
}

export function mergeMatches(
  pmMatches: UnifiedMatch[],
  espnMatches: UnifiedMatch[],
): UnifiedMatch[] {
  const usedEspn = new Set<number>();
  const fused: UnifiedMatch[] = [];
  const unmatchedPmIdx: number[] = [];

  // Pase 1: Match fuerte por ambos equipos (prioridad Promiedos como base)
  for (const pm of pmMatches) {
    let bestIdx = -1;
    let bestSwapped = false;
    let bestScore = 0;

    for (let i = 0; i < espnMatches.length; i++) {
      if (usedEspn.has(i)) continue;
      const espn = espnMatches[i];

      // Comprobar que sean fechas cercanas (dentro de 20h) si ambas existen
      const diffHours = hoursBetweenIso(pm.dateIso, espn.dateIso);
      if (diffHours !== null && diffHours > 20) continue;

      const directH = teamsMatchScore(pm.home.name, espn.home.name);
      const directA = teamsMatchScore(pm.away.name, espn.away.name);
      const directValid = directH >= 0.74 && directA >= 0.74;
      const directAvg = directValid ? (directH + directA) / 2 : 0;

      const swapH = teamsMatchScore(pm.home.name, espn.away.name);
      const swapA = teamsMatchScore(pm.away.name, espn.home.name);
      const swapValid = swapH >= 0.74 && swapA >= 0.74;
      const swapAvg = swapValid ? (swapH + swapA) / 2 : 0;

      const leagueBonus =
        pm.league.canonicalSlug === espn.league.canonicalSlug ? 0.05 : 0;

      if (directValid && directAvg + leagueBonus > bestScore) {
        bestScore = directAvg + leagueBonus;
        bestIdx = i;
        bestSwapped = false;
      }
      if (swapValid && swapAvg + leagueBonus - 0.005 > bestScore) {
        bestScore = swapAvg + leagueBonus - 0.005;
        bestIdx = i;
        bestSwapped = true;
      }
    }

    if (bestIdx !== -1) {
      usedEspn.add(bestIdx);
      fused.push(fuseTwoMatches(pm, espnMatches[bestIdx], bestSwapped));
    } else {
      unmatchedPmIdx.push(fused.length);
      fused.push(pm);
    }
  }

  // Pase 2: Cruce determinista por Misma Liga + Misma Hora (<=2.5h) + 1 Equipo Exacto (>=0.85)
  // Evita duplicados cuando un rival tiene alias diferente (ej. "Belgrano" vs "Belgrano (Córdoba)", "1. FC Köln" vs "FC Cologne")
  for (const fusedPos of unmatchedPmIdx) {
    const pm = fused[fusedPos];
    let bestIdx = -1;
    let bestSwapped = false;
    let bestScore = 0;

    for (let i = 0; i < espnMatches.length; i++) {
      if (usedEspn.has(i)) continue;
      const espn = espnMatches[i];
      if (pm.league.canonicalSlug !== espn.league.canonicalSlug) continue;

      const diffHours = hoursBetweenIso(pm.dateIso, espn.dateIso);
      const sameTime =
        (diffHours !== null && diffHours <= 2.5) ||
        (Boolean(pm.timeLocalAr) && pm.timeLocalAr === espn.timeLocalAr && pm.dateLocalAr === espn.dateLocalAr);
      if (!sameTime) continue;

      const directH = teamsMatchScore(pm.home.name, espn.home.name);
      const directA = teamsMatchScore(pm.away.name, espn.away.name);
      const directOneExact = (directH >= 0.85 && directA >= 0) || (directA >= 0.85 && directH >= 0);

      const swapH = teamsMatchScore(pm.home.name, espn.away.name);
      const swapA = teamsMatchScore(pm.away.name, espn.home.name);
      const swapOneExact = (swapH >= 0.85 && swapA >= 0) || (swapA >= 0.85 && swapH >= 0);

      const directScore = directOneExact ? Math.max(directH, directA) + Math.min(directH, directA) * 0.5 : 0;
      const swapScore = swapOneExact ? Math.max(swapH, swapA) + Math.min(swapH, swapA) * 0.5 - 0.02 : 0;

      if (directScore > bestScore) {
        bestScore = directScore;
        bestIdx = i;
        bestSwapped = false;
      }
      if (swapScore > bestScore) {
        bestScore = swapScore;
        bestIdx = i;
        bestSwapped = true;
      }
    }

    if (bestIdx !== -1) {
      usedEspn.add(bestIdx);
      fused[fusedPos] = fuseTwoMatches(pm, espnMatches[bestIdx], bestSwapped);
    }
  }

  // Agregar partidos exclusivos de ESPN que NO duplican ninguno ya fusionado
  for (let i = 0; i < espnMatches.length; i++) {
    if (usedEspn.has(i)) continue;
    const espn = espnMatches[i];
    const isDuplicate = fused.some((existing) => {
      if (existing.canonicalKey === espn.canonicalKey) return true;
      const diffHours = hoursBetweenIso(existing.dateIso, espn.dateIso);
      if (diffHours !== null && diffHours > 4) return false;
      const dH = teamsMatchScore(existing.home.name, espn.home.name);
      const dA = teamsMatchScore(existing.away.name, espn.away.name);
      if (dH >= 0.74 && dA >= 0.74) return true;
      if (
        existing.league.canonicalSlug === espn.league.canonicalSlug &&
        (dH >= 0.88 || dA >= 0.88)
      ) {
        return true;
      }
      return false;
    });
    if (!isDuplicate) {
      fused.push(espn);
    }
  }

  return fused;
}

function mergeLineupTeam(
  pmLineup?: TeamLineup,
  espnLineup?: TeamLineup,
): TeamLineup | undefined {
  if (!pmLineup && !espnLineup) return undefined;
  if (!pmLineup) return espnLineup;
  if (!espnLineup) return pmLineup;

  const enrichPlayers = (
    pmList: LineupPlayer[],
    espnList: LineupPlayer[],
  ): LineupPlayer[] => {
    return pmList.map((p) => {
      const match =
        espnList.find(
          (ep) =>
            (p.jerseyNumber !== null &&
              ep.jerseyNumber !== null &&
              p.jerseyNumber === ep.jerseyNumber) ||
            areSameTeam(p.name, ep.name),
        ) ??
        espnList.find((ep) => {
          const lastPm = p.name.split(' ').pop()?.toLowerCase() ?? '';
          const lastEp = ep.name.split(' ').pop()?.toLowerCase() ?? '';
          return lastPm.length >= 4 && lastPm === lastEp;
        });

      if (!match) return p;
      return {
        ...p,
        id: match.id ?? p.id,
        subbedIn: match.subbedIn ?? p.subbedIn,
        subbedOut: match.subbedOut ?? p.subbedOut,
        stats: match.stats ?? p.stats,
      };
    });
  };

  return {
    ...pmLineup,
    formation: pmLineup.formation || espnLineup.formation,
    starters:
      pmLineup.starters.length > 0
        ? enrichPlayers(pmLineup.starters, [
            ...espnLineup.starters,
            ...espnLineup.bench,
          ])
        : espnLineup.starters,
    bench:
      pmLineup.bench.length > 0
        ? enrichPlayers(pmLineup.bench, [
            ...espnLineup.bench,
            ...espnLineup.starters,
          ])
        : espnLineup.bench,
  };
}

function mergeStatistics(
  pmStats: MatchStatistic[],
  espnStats: MatchStatistic[],
): MatchStatistic[] {
  const byCanonical = new Map<string, MatchStatistic>();
  const canon = (key: string) =>
    STAT_KEY_CANONICAL[slugify(key).replace(/-/g, '')] ??
    STAT_KEY_CANONICAL[slugify(key)] ??
    slugify(key);

  for (const s of pmStats) {
    byCanonical.set(canon(s.key || s.label), s);
  }
  for (const s of espnStats) {
    const k = canon(s.key || s.label);
    if (!byCanonical.has(k)) {
      byCanonical.set(k, s);
    }
  }
  return Array.from(byCanonical.values());
}

function flipEspnDetail(detail: UnifiedMatchDetail): UnifiedMatchDetail {
  const flippedMatch = orientEspnMatch(detail.match, true);
  return {
    ...detail,
    match: flippedMatch,
    events: detail.events.map((ev) => ({
      ...ev,
      teamSide:
        ev.teamSide === 'home'
          ? 'away'
          : ev.teamSide === 'away'
            ? 'home'
            : 'neutral',
    })),
    statistics: detail.statistics.map((st) => ({
      ...st,
      homeValue: st.awayValue,
      awayValue: st.homeValue,
      homeNumeric: st.awayNumeric,
      awayNumeric: st.homeNumeric,
      homePct: st.awayPct,
      awayPct: st.homePct,
    })),
    lineups: {
      home: detail.lineups.away
        ? { ...detail.lineups.away, side: 'home' }
        : undefined,
      away: detail.lineups.home
        ? { ...detail.lineups.home, side: 'away' }
        : undefined,
    },
    recentForm: {
      home: detail.recentForm.away,
      away: detail.recentForm.home,
      homeMatches: detail.recentForm.awayMatches,
      awayMatches: detail.recentForm.homeMatches,
    },
  };
}

export function mergeMatchDetails(
  pmDetail?: UnifiedMatchDetail,
  rawEspnDetail?: UnifiedMatchDetail,
): UnifiedMatchDetail {
  if (!pmDetail && !rawEspnDetail) {
    throw new Error('No match detail available from either source');
  }
  if (!pmDetail) return rawEspnDetail!;
  if (!rawEspnDetail) return pmDetail;

  const isSwapped =
    areSameTeam(pmDetail.match.home.name, rawEspnDetail.match.away.name) &&
    areSameTeam(pmDetail.match.away.name, rawEspnDetail.match.home.name);

  const espn = isSwapped ? flipEspnDetail(rawEspnDetail) : rawEspnDetail;
  const fusedMatch = fuseTwoMatches(pmDetail.match, espn.match, false);

  const mergedEvents: MatchEvent[] = [...pmDetail.events];
  for (const ev of espn.events) {
    const exists = mergedEvents.some(
      (m) =>
        m.type === ev.type &&
        m.teamSide === ev.teamSide &&
        Math.abs((m.minute ?? 0) - (ev.minute ?? 0)) <= 2,
    );
    if (!exists) {
      mergedEvents.push(ev);
    }
  }
  mergedEvents.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));

  const gameInfo = [...pmDetail.gameInfo];
  for (const gi of espn.gameInfo) {
    if (
      !gameInfo.some((x) => x.label.toLowerCase() === gi.label.toLowerCase())
    ) {
      gameInfo.push(gi);
    }
  }

  return {
    match: fusedMatch,
    gameInfo,
    referee: pmDetail.referee ?? espn.referee,
    attendance: espn.attendance ?? pmDetail.attendance,
    events: mergedEvents,
    stageScores:
      pmDetail.stageScores.length > 0 ? pmDetail.stageScores : espn.stageScores,
    statistics: mergeStatistics(pmDetail.statistics, espn.statistics),
    lineups: {
      home: mergeLineupTeam(pmDetail.lineups.home, espn.lineups.home),
      away: mergeLineupTeam(pmDetail.lineups.away, espn.lineups.away),
    },
    missingPlayers: pmDetail.missingPlayers,
    commentary: espn.commentary.length > 0 ? espn.commentary : pmDetail.commentary,
    prediction:
      pmDetail.prediction || espn.prediction
        ? {
            ...espn.prediction,
            ...pmDetail.prediction,
          }
        : undefined,
    headToHead: pmDetail.headToHead ?? espn.headToHead,
    recentForm: {
      home:
        pmDetail.recentForm.home.length > 0
          ? pmDetail.recentForm.home
          : espn.recentForm.home,
      away:
        pmDetail.recentForm.away.length > 0
          ? pmDetail.recentForm.away
          : espn.recentForm.away,
      homeMatches: espn.recentForm.homeMatches,
      awayMatches: espn.recentForm.awayMatches,
    },
    videos: espn.videos,
    news: espn.news,
  };
}

function buildScoreboardPayload(
  isoDate: string,
  allMatches: UnifiedMatch[],
): ScoreboardDayPayload {
  const byLeague = new Map<
    string,
    { league: UnifiedLeagueRef; matches: UnifiedMatch[] }
  >();

  for (const m of allMatches) {
    const key = m.league.canonicalSlug || m.league.id;
    const entry = byLeague.get(key) ?? { league: m.league, matches: [] };
    entry.matches.push(m);
    byLeague.set(key, entry);
  }

  const leagues = Array.from(byLeague.values())
    .map((g) => {
      g.matches.sort((a, b) => a.dateIso.localeCompare(b.dateIso));
      return {
        league: g.league,
        liveCount: g.matches.filter((m) => m.status.isLive).length,
        matchesCount: g.matches.length,
        matches: g.matches,
      };
    })
    .sort((a, b) => {
      const pa = getLeaguePriority(a.league);
      const pb = getLeaguePriority(b.league);
      if (pa !== pb) return pa - pb;
      if (a.liveCount !== b.liveCount) return b.liveCount - a.liveCount;
      return a.league.name.localeCompare(b.league.name);
    });

  const sortedMatches = leagues.flatMap((l) => l.matches);
  const liveMatches = sortedMatches.filter((m) => m.status.isLive).length;
  const finishedMatches = sortedMatches.filter((m) => m.status.isFinished).length;
  const upcomingMatches = sortedMatches.filter(
    (m) => m.status.state === 'PRE',
  ).length;

  return {
    date: isoDate,
    summary: {
      totalMatches: sortedMatches.length,
      liveMatches,
      finishedMatches,
      upcomingMatches,
      leaguesCount: leagues.length,
    },
    leagues,
    matches: sortedMatches,
  };
}

function applyMatchFilters(
  payload: ScoreboardDayPayload,
  filters: MatchQueryFilters,
): ScoreboardDayPayload {
  const leagueFilter = filters.league?.trim().toLowerCase();
  const stateFilter = filters.state?.trim().toUpperCase();
  const teamFilter = filters.team?.trim().toLowerCase();
  const liveOnly = Boolean(filters.liveOnly);

  if (!leagueFilter && !stateFilter && !teamFilter && !liveOnly) {
    return payload;
  }

  const mappedLeague = leagueFilter ? findLeagueMapping(leagueFilter) : undefined;

  const filtered = payload.matches.filter((m) => {
    if (liveOnly && !m.status.isLive) return false;
    if (stateFilter && m.status.state !== stateFilter) return false;
    if (leagueFilter) {
      const targetSlug = mappedLeague?.canonicalSlug ?? leagueFilter;
      const matchesLeague =
        m.league.canonicalSlug.toLowerCase() === targetSlug ||
        m.league.slug.toLowerCase() === leagueFilter ||
        m.league.externalIds.promiedos?.toLowerCase() === leagueFilter ||
        m.league.externalIds.espn?.toLowerCase() === leagueFilter ||
        m.league.name.toLowerCase().includes(leagueFilter);
      if (!matchesLeague) return false;
    }
    if (teamFilter) {
      const hitHome =
        m.home.name.toLowerCase().includes(teamFilter) ||
        m.home.slug.includes(teamFilter) ||
        areSameTeam(m.home.name, teamFilter);
      const hitAway =
        m.away.name.toLowerCase().includes(teamFilter) ||
        m.away.slug.includes(teamFilter) ||
        areSameTeam(m.away.name, teamFilter);
      if (!hitHome && !hitAway) return false;
    }
    return true;
  });

  return buildScoreboardPayload(payload.date, filtered);
}

export class FootballService {
  private readonly cache: CacheManager;

  constructor(cache: CacheManager = sharedCache) {
    this.cache = cache;
  }

  async getScoreboardByDate(
    dateInput: string | undefined,
    filters: MatchQueryFilters = {},
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<ServiceResult<ScoreboardDayPayload>> {
    const start = Date.now();
    const tz = env?.DEFAULT_TIMEZONE ?? 'America/Argentina/Buenos_Aires';
    const dates = formatDateFormats(dateInput, tz);
    if (!dates.isValid) {
      throw new Error(
        `Invalid date format "${dateInput}". Use today, yesterday, tomorrow, YYYY-MM-DD, DD-MM-YYYY, or YYYYMMDD.`,
      );
    }

    const today = formatDateFormats('today', tz);
    const isToday = dates.isoDate === today.isoDate;
    const isPast = dates.isoDate < today.isoDate;

    const ttl = isToday
      ? parseTtl(env?.CACHE_LIVE_TTL, 25)
      : isPast
        ? 1800
        : parseTtl(env?.CACHE_DAY_TTL, 180);

    const warnings: string[] = [];
    const activeSources = new Set<DataSourceName>();

    const cached = await this.cache.getOrFetch(
      `day:${dates.isoDate}`,
      ttl,
      async () => {
        const pmDay = await fetchPromiedosDay(dates.pmDate);
        activeSources.add('promiedos');
        return buildScoreboardPayload(dates.isoDate, pmDay.matches);
      },
      { staleTtlSeconds: isToday ? 180 : 1800, waitUntil, bypassCache },
      env,
    );

    if (cached.warning) warnings.push(cached.warning);
    if (activeSources.size === 0) activeSources.add('promiedos');

    const filtered = applyMatchFilters(cached.value, filters);

    return {
      data: filtered,
      cache: cached.cache,
      sources: Array.from(activeSources),
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async getLiveMatches(
    filters: MatchQueryFilters = {},
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<ServiceResult<ScoreboardDayPayload>> {
    return this.getScoreboardByDate(
      'today',
      { ...filters, liveOnly: true },
      env,
      waitUntil,
      bypassCache,
    );
  }

  private parseMatchIdentifier(rawId: string): { pmId?: string; espnId?: string } {
    const clean = rawId.trim();
    if (clean.startsWith('pm:') || clean.startsWith('pm-')) return { pmId: clean.slice(3) };
    if (clean.startsWith('espn:') || clean.startsWith('espn-')) return { espnId: clean.slice(5) };
    if (/^\d+$/.test(clean)) return { espnId: clean };
    if (/^[a-z0-9]+$/i.test(clean)) return { pmId: clean };
    return { pmId: clean };
  }

  async getMatchDetail(
    rawId: string,
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<ServiceResult<UnifiedMatchDetail>> {
    const start = Date.now();
    const { pmId } = this.parseMatchIdentifier(rawId);
    const warnings: string[] = [];

    if (!pmId) {
      throw new HttpError(400, `ID de partido Promiedos inválido: "${rawId}"`);
    }

    const cacheKey = `match:pm:${pmId}`;
    const ttl = parseTtl(env?.CACHE_DETAIL_LIVE_TTL, 20);

    const cached = await this.cache.getOrFetch(
      cacheKey,
      ttl,
      async () => fetchPromiedosMatchDetail(pmId),
      { staleTtlSeconds: 300, waitUntil, bypassCache },
      env,
    );

    if (cached.warning) warnings.push(cached.warning);

    return {
      data: cached.value,
      cache: cached.cache,
      sources: ['promiedos'],
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async getLeaguesCatalog(
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<
    ServiceResult<{
      featured: typeof LEAGUE_MAPPINGS;
      categories: LeagueCategory[];
      espnCount: number;
    }>
  > {
    const start = Date.now();
    const ttl = parseTtl(env?.CACHE_CATALOG_TTL, 21600);
    const warnings: string[] = [];

    const cached = await this.cache.getOrFetch(
      'catalog:leagues',
      ttl,
      async () => {
        let categories = (await fetchPromiedosMenu().catch(() => [] as LeagueCategory[])).filter(
          (c) => c.leagues.length > 0,
        );
        if (categories.length === 0) {
          const byCountry = new Map<string, UnifiedLeagueRef[]>();
          for (const m of LEAGUE_MAPPINGS) {
            if (!m.promiedosId) continue;
            const list = byCountry.get(m.countryName) ?? [];
            const logo = `https://api.promiedos.com.ar/images/league/${m.promiedosId}/4`;
            list.push({
              id: m.canonicalSlug,
              canonicalSlug: m.canonicalSlug,
              externalIds: { promiedos: m.promiedosId },
              name: m.name,
              slug: m.promiedosSlug ?? m.canonicalSlug,
              countryId: m.countryId,
              countryName: m.countryName,
              countryFlag: `https://api.promiedos.com.ar/images/country/${m.countryId}/4`,
              isInternational: m.isInternational,
              logo,
              logos: { promiedos: logo },
              promiedosUrl: `https://www.promiedos.com.ar/league/${m.promiedosSlug ?? m.canonicalSlug}/${m.promiedosId}`,
            });
            byCountry.set(m.countryName, list);
          }
          categories = Array.from(byCountry.entries()).map(([name, leagues]) => ({
            name,
            leagues,
          }));
        }
        return {
          featured: LEAGUE_MAPPINGS,
          categories,
          espnCount: 0,
        };
      },
      { staleTtlSeconds: 43200, waitUntil, bypassCache },
      env,
    );

    if (cached.warning) warnings.push(cached.warning);

    return {
      data: cached.value,
      cache: cached.cache,
      sources: ['promiedos'],
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async getLeagueDetail(
    identifier: string,
    roundKey?: string,
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<ServiceResult<UnifiedLeagueDetail>> {
    const start = Date.now();
    const mapping = findLeagueMapping(identifier);
    if (
      isLeagueRefExcluded({
        id: identifier,
        canonicalSlug: mapping?.canonicalSlug ?? identifier,
        name: mapping?.name,
        externalIds: { promiedos: mapping?.promiedosId, espn: mapping?.espnSlug },
      })
    ) {
      throw new HttpError(404, `Liga '${identifier}' excluida de la extracción en tu API.`);
    }
    const pmId =
      mapping?.promiedosId ??
      (identifier.startsWith('pm:') ? identifier.slice(3) : undefined) ??
      (/^[a-z]{1,6}$/i.test(identifier) && !identifier.includes('.') && !identifier.includes('-')
        ? identifier
        : undefined);

    if (!pmId) {
      throw new HttpError(404, `Liga Promiedos no encontrada para "${identifier}"`);
    }

    const ttl = parseTtl(env?.CACHE_LEAGUE_TTL, 300);
    const warnings: string[] = [];

    const cacheKey = `league:${mapping?.canonicalSlug ?? identifier}:${roundKey ?? 'default'}`;

    const cached = await this.cache.getOrFetch(
      cacheKey,
      ttl,
      async () => {
        const pmDetail = await fetchPromiedosLeague(pmId, mapping?.promiedosSlug);
        if (roundKey) {
          const roundMatches = await fetchPromiedosLeagueRound(
            pmId,
            roundKey,
            pmDetail.league,
          );
          pmDetail.matches = roundMatches;
          pmDetail.selectedRound = roundKey;
        }
        return pmDetail;
      },
      { staleTtlSeconds: 1800, waitUntil, bypassCache },
      env,
    );

    if (cached.warning) warnings.push(cached.warning);

    return {
      data: cached.value,
      cache: cached.cache,
      sources: ['promiedos'],
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async getTeamDetail(
    rawId: string,
    _leagueHint?: string,
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
    bypassCache = false,
  ): Promise<ServiceResult<UnifiedTeamDetail>> {
    const start = Date.now();
    const clean = rawId.trim();
    const warnings: string[] = [];

    const pmTeamId =
      clean.startsWith('pm:') || clean.startsWith('pm-') ? clean.slice(3) : clean;

    const ttl = parseTtl(env?.CACHE_TEAM_TTL, 1800);

    const cached = await this.cache.getOrFetch(
      `team:pm:${pmTeamId}`,
      ttl,
      async () => fetchPromiedosTeam(pmTeamId),
      { staleTtlSeconds: 7200, waitUntil, bypassCache },
      env,
    );

    if (cached.warning) warnings.push(cached.warning);

    return {
      data: cached.value,
      cache: cached.cache,
      sources: ['promiedos'],
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async search(
    query: string,
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
  ): Promise<
    ServiceResult<{
      query: string;
      leagues: UnifiedLeagueRef[];
      teams: UnifiedTeamRef[];
      matches: UnifiedMatch[];
    }>
  > {
    const start = Date.now();
    const q = query.trim().toLowerCase();
    const warnings: string[] = [];

    if (!q) {
      return {
        data: { query: '', leagues: [], teams: [], matches: [] },
        cache: 'HIT',
        sources: [],
        warnings,
        tookMs: 0,
      };
    }

    const [catalogRes, todayRes, lpfRes] = await Promise.allSettled([
      this.getLeaguesCatalog(env, waitUntil),
      this.getScoreboardByDate('today', {}, env, waitUntil),
      this.getLeagueDetail('liga-profesional', undefined, env, waitUntil),
    ]);

    const leagueHits = new Map<string, UnifiedLeagueRef>();
    if (catalogRes.status === 'fulfilled') {
      for (const cat of catalogRes.value.data.categories) {
        for (const l of cat.leagues) {
          if (
            l.name.toLowerCase().includes(q) ||
            l.canonicalSlug.includes(q) ||
            (l.countryName?.toLowerCase().includes(q) ?? false)
          ) {
            leagueHits.set(l.canonicalSlug, l);
          }
        }
      }
    }

    const matchHits: UnifiedMatch[] = [];
    const teamHits = new Map<string, UnifiedTeamRef>();

    if (todayRes.status === 'fulfilled') {
      for (const m of todayRes.value.data.matches) {
        const homeHit =
          m.home.name.toLowerCase().includes(q) ||
          m.home.shortName.toLowerCase().includes(q) ||
          areSameTeam(m.home.name, q);
        const awayHit =
          m.away.name.toLowerCase().includes(q) ||
          m.away.shortName.toLowerCase().includes(q) ||
          areSameTeam(m.away.name, q);

        if (homeHit) teamHits.set(m.home.id, m.home);
        if (awayHit) teamHits.set(m.away.id, m.away.logo ? m.away : m.away);
        if (homeHit || awayHit || m.league.name.toLowerCase().includes(q)) {
          matchHits.push(m);
        }
      }
    }

    if (lpfRes.status === 'fulfilled') {
      for (const grp of lpfRes.value.data.standingsGroups) {
        for (const tbl of grp.tables) {
          for (const row of tbl.rows) {
            const t = row.team;
            if (
              !teamHits.has(t.id) &&
              (t.name.toLowerCase().includes(q) ||
                (t.shortName?.toLowerCase().includes(q) ?? false) ||
                areSameTeam(t.name, q))
            ) {
              teamHits.set(t.id, {
                id: t.id,
                externalIds: t.externalIds,
                name: t.name,
                shortName: t.shortName ?? t.name,
                slug: t.slug ?? slugify(t.name),
                logo: t.logo,
                logos: { promiedosLarge: t.logo },
                colors: t.colors,
                score: null,
                redCards: 0,
              });
            }
          }
        }
      }
    }

    return {
      data: {
        query: query.trim(),
        leagues: Array.from(leagueHits.values()).slice(0, 25),
        teams: Array.from(teamHits.values()).slice(0, 25),
        matches: matchHits.slice(0, 40),
      },
      cache: 'HIT',
      sources: ['promiedos', 'espn'],
      warnings,
      tookMs: Date.now() - start,
    };
  }

  async warmCache(
    env?: EnvBindings,
    waitUntil?: (p: Promise<unknown>) => void,
  ): Promise<void> {
    await Promise.allSettled([
      this.getScoreboardByDate('today', {}, env, waitUntil, true),
      this.getLeaguesCatalog(env, waitUntil),
    ]);
  }
}

export const footballService = new FootballService();
