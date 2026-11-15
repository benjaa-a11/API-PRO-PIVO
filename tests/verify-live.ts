import assert from 'node:assert/strict';
import worker from '../src/index.ts';
import { mergeMatchDetails, mergeMatches } from '../src/services/fusion.ts';
import type {
  EnvBindings,
  UnifiedMatch,
  UnifiedMatchDetail,
} from '../src/types/schema.ts';
import {
  areSameTeam,
  formatDateFormats,
  normalizeTeamName,
  parseMinuteParts,
  promiedosDateTimeToIso,
  teamsMatchScore,
} from '../src/utils/normalize.ts';

const TEST_ENV: EnvBindings = {
  ENVIRONMENT: 'test',
  API_VERSION: '1.0.0-test',
  DEFAULT_TIMEZONE: 'America/Argentina/Buenos_Aires',
};

function makeMockExecCtx() {
  const promises: Promise<unknown>[] = [];
  const ctx = {
    waitUntil(p: Promise<unknown>) {
      promises.push(p);
    },
    passThroughOnException() {},
  } as unknown as ExecutionContext;
  return { ctx, promises };
}

async function callApi(path: string): Promise<{ status: number; headers: Headers; body: any }> {
  const { ctx, promises } = makeMockExecCtx();
  const req = new Request(`https://api-pro-pivo.test${path}`);
  const res = await worker.fetch(req, TEST_ENV, ctx);
  await Promise.allSettled(promises);
  const ct = res.headers.get('content-type') ?? '';
  const body = ct.includes('application/json') ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, body };
}

function runUnitInvariants(): void {
  console.log('--- Running Unit Invariants ---');

  // 1. Normalización de clubes y conflictos
  assert.equal(areSameTeam('Boca Juniors', 'Boca Jrs.'), true);
  assert.equal(areSameTeam('Club Atlético River Plate', 'River'), true);
  assert.equal(areSameTeam("Newell's Old Boys", "Newell's"), true);
  assert.equal(areSameTeam('Atlético Tucumán', 'Atl. Tucuman'), true);
  assert.equal(areSameTeam('Man Utd', 'Manchester United'), true);
  assert.equal(normalizeTeamName('Atlético Tucumán'), normalizeTeamName('Atl Tucuman'));

  // Categorías / ciudades distintas nunca deben cruzarse
  assert.equal(areSameTeam('Boca Juniors', 'Boca Juniors Femenino'), false);
  assert.equal(areSameTeam('Central Córdoba (SdE)', 'Central Córdoba (R)'), false);
  assert.ok(teamsMatchScore('Arsenal', 'Arsenal') === 1);

  // 2. Fechas y minutos
  const df = formatDateFormats('2026-11-14', 'America/Argentina/Buenos_Aires');
  assert.equal(df.isValid, true);
  assert.equal(df.isoDate, '2026-11-14');
  assert.equal(df.pmDate, '14-11-2026');
  assert.equal(df.espnDate, '20261114');
  assert.equal(formatDateFormats('bad-date').isValid, false);

  assert.equal(promiedosDateTimeToIso('14-11-2026 19:00'), '2026-11-14T22:00:00.000Z');
  assert.deepEqual(parseMinuteParts("45'+1"), {
    minute: 46,
    baseMinute: 45,
    addedMinute: 1,
    display: "45+1'",
  });

  // 3. Invariante de fusión en sede neutral con local/visitante invertido entre Promiedos y ESPN
  const pmMatch: UnifiedMatch = {
    id: 'pm:test1',
    canonicalKey: '2026-11-14:copa-argentina:banfield-vs-boca-juniors',
    externalIds: { promiedos: 'test1' },
    sources: ['promiedos'],
    urlSlug: 'banfield-vs-boca-juniors',
    dateIso: '2026-11-14T22:00:00.000Z',
    dateLocalAr: '2026-11-14',
    timeLocalAr: '19:00',
    league: {
      id: 'copa-argentina',
      canonicalSlug: 'copa-argentina',
      externalIds: { promiedos: 'gea' },
      name: 'Copa Argentina',
      slug: 'copa-argentina',
      isInternational: false,
      logo: 'https://api.promiedos.com.ar/images/league/gea/1',
      logos: {},
    },
    status: {
      state: 'FT',
      code: '3',
      label: 'Finalizado',
      shortLabel: 'Final',
      minute: 90,
      minuteDisplay: 'Final',
      period: 2,
      isLive: false,
      isFinished: true,
    },
    home: {
      id: 'pm-ihi',
      externalIds: { promiedos: 'ihi' },
      name: 'Banfield',
      shortName: 'Banfield',
      slug: 'banfield',
      logo: 'pm-ban',
      logos: { promiedosLarge: 'pm-ban' },
      score: 0,
      redCards: 0,
    },
    away: {
      id: 'pm-igg',
      externalIds: { promiedos: 'igg' },
      name: 'Boca Juniors',
      shortName: 'Boca Jrs.',
      slug: 'boca-juniors',
      logo: 'pm-cabj',
      logos: { promiedosLarge: 'pm-cabj' },
      score: 1,
      redCards: 0,
    },
    goals: [
      {
        teamSide: 'away',
        playerName: 'Santiago Ascacibar',
        minute: 46,
        minuteDisplay: "45+1'",
        isPenalty: false,
        isOwnGoal: false,
      },
    ],
    cards: [],
    broadcasts: [],
  };

  // ESPN tiene Boca como "home" y Banfield como "away"
  const espnSwappedMatch: UnifiedMatch = {
    ...pmMatch,
    id: 'espn:999',
    externalIds: { espn: '999' },
    sources: ['espn'],
    home: {
      id: 'espn-5',
      externalIds: { espn: '5' },
      name: 'Boca Juniors',
      shortName: 'Boca',
      slug: 'boca-juniors',
      logo: 'espn-cabj',
      logos: { espn: 'espn-cabj' },
      score: 1,
      redCards: 0,
    },
    away: {
      id: 'espn-235',
      externalIds: { espn: '235' },
      name: 'Banfield',
      shortName: 'Banfield',
      slug: 'banfield',
      logo: 'espn-ban',
      logos: { espn: 'espn-ban' },
      score: 0,
      redCards: 0,
    },
    goals: [
      {
        teamSide: 'home',
        playerName: 'Santiago Ascacibar',
        minute: 46,
        minuteDisplay: "45+1'",
        isPenalty: false,
        isOwnGoal: false,
      },
    ],
    cards: [
      {
        teamSide: 'away',
        cardType: 'yellow',
        playerName: 'Adrián Balboa',
        minute: 43,
        minuteDisplay: "43'",
      },
      {
        teamSide: 'home',
        cardType: 'yellow',
        playerName: 'Malcom Braida',
        minute: 45,
        minuteDisplay: "45'",
      },
    ],
  };

  const mergedList = mergeMatches([pmMatch], [espnSwappedMatch]);
  assert.equal(mergedList.length, 1);
  const fused = mergedList[0];
  assert.deepEqual(fused.sources, ['promiedos', 'espn']);
  assert.equal(fused.home.name, 'Banfield');
  assert.equal(fused.away.name, 'Boca Juniors');
  assert.equal(fused.home.externalIds.espn, '235');
  assert.equal(fused.away.externalIds.espn, '5');
  assert.equal(fused.cards.find((c) => c.playerName === 'Adrián Balboa')?.teamSide, 'home');
  assert.equal(fused.cards.find((c) => c.playerName === 'Malcom Braida')?.teamSide, 'away');

  // Verificar fusión de detalles invertidos
  const pmDet: UnifiedMatchDetail = {
    match: pmMatch,
    gameInfo: [],
    events: [],
    stageScores: [],
    statistics: [{ key: 'remates', label: 'Remates', homeValue: '5', awayValue: '8' }],
    lineups: {
      home: {
        side: 'home',
        teamName: 'Banfield',
        status: 'Confirmado',
        formation: '4-3-3',
        supportsVisualLineups: true,
        starters: [{ name: 'Diego Rodríguez', jerseyNumber: 50, position: 'ARQ', isCaptain: true, starter: true }],
        bench: [],
      },
      away: {
        side: 'away',
        teamName: 'Boca Juniors',
        status: 'Confirmado',
        formation: '4-4-2',
        supportsVisualLineups: true,
        starters: [{ name: 'Santiago Ascacibar', jerseyNumber: 25, position: 'MED', isCaptain: false, starter: true }],
        bench: [],
      },
    },
    missingPlayers: { home: [], away: [] },
    commentary: [],
    recentForm: { home: ['W'], away: ['L'] },
  };

  const espnDet: UnifiedMatchDetail = {
    match: espnSwappedMatch,
    gameInfo: [{ label: 'Espectadores', value: '30000' }],
    events: [],
    stageScores: [],
    statistics: [
      { key: 'remates', label: 'Remates', homeValue: '8', awayValue: '5' },
      { key: 'possessionPct', label: 'Posesión', homeValue: '62', awayValue: '38' },
    ],
    lineups: {
      home: {
        side: 'home',
        teamName: 'Boca Juniors',
        status: 'Confirmado',
        formation: '4-4-2',
        supportsVisualLineups: false,
        starters: [{ id: 'espn-233734', name: 'Santiago Ascacibar', jerseyNumber: 25, position: 'MED', isCaptain: false, starter: true, stats: { goals: 1 } }],
        bench: [],
      },
      away: {
        side: 'away',
        teamName: 'Banfield',
        status: 'Confirmado',
        formation: '4-3-3',
        supportsVisualLineups: false,
        starters: [{ id: 'espn-200275', name: 'Diego Rodríguez', jerseyNumber: 50, position: 'ARQ', isCaptain: true, starter: true, stats: { saves: 3 } }],
        bench: [],
      },
    },
    missingPlayers: { home: [], away: [] },
    commentary: [{ minute: 46, minuteDisplay: "45+1'", text: 'Gol de Ascacibar' }],
    recentForm: { home: ['W', 'W'], away: ['D'] },
  };

  const mergedDetail = mergeMatchDetails(pmDet, espnDet);
  assert.equal(mergedDetail.statistics.find((s) => s.key === 'possessionPct')?.homeValue, '38');
  assert.equal(mergedDetail.statistics.find((s) => s.key === 'possessionPct')?.awayValue, '62');
  assert.equal(mergedDetail.lineups.home?.starters[0].stats?.saves, 3);
  assert.equal(mergedDetail.lineups.away?.starters[0].stats?.goals, 1);

  console.log('Unit invariants PASSED.');
}

async function runLiveE2E(): Promise<void> {
  console.log('\n--- Running Live Integration Tests ---');

  const dash = await callApi('/');
  assert.equal(dash.status, 200);
  assert.ok(String(dash.body).includes('Pivote Fútbol'));
  assert.ok(String(dash.body).includes('id="sidebar"'));
  console.log('GET / -> 200 OK (Dashboard HTML)');

  const openapi = await callApi('/openapi.json');
  assert.equal(openapi.status, 200);
  assert.equal(openapi.body.openapi, '3.1.0');
  console.log('GET /openapi.json -> 200 OK');

  const health = await callApi('/api/v1/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.ok(health.body.mappedLeaguesCount >= 40);
  console.log(`GET /api/v1/health -> 200 OK (mappings: ${health.body.mappedLeaguesCount})`);

  const mappings = await callApi('/api/v1/mappings');
  assert.equal(mappings.status, 200);
  assert.ok(Array.isArray(mappings.body.data) && mappings.body.data.length >= 40);
  console.log(`GET /api/v1/mappings -> 200 OK (${mappings.body.data.length} leagues)`);

  const todayRes = await callApi('/api/v1/matches?date=today');
  assert.equal(todayRes.status, 200);
  assert.equal(todayRes.body.ok, true);
  assert.ok(todayRes.body.data.summary.totalMatches > 0, 'Expected matches today');
  console.log(
    `GET /api/v1/matches?date=today -> 200 OK (matches=${todayRes.body.data.summary.totalMatches}, live=${todayRes.body.data.summary.liveMatches}, leagues=${todayRes.body.data.summary.leaguesCount}, sources=${todayRes.body.meta.sources.join('+')}, took=${todayRes.body.meta.tookMs}ms)`,
  );

  // Confirmar caché HIT en segundo request
  const todayHit = await callApi('/api/v1/matches?date=today');
  assert.equal(todayHit.status, 200);
  assert.equal(todayHit.headers.get('X-Cache'), 'HIT');
  console.log(`GET /api/v1/matches?date=today (2nd call) -> X-Cache: ${todayHit.headers.get('X-Cache')} (${todayHit.body.meta.tookMs}ms)`);

  const liveRes = await callApi('/api/v1/live');
  assert.equal(liveRes.status, 200);
  assert.equal(liveRes.body.ok, true);
  console.log(`GET /api/v1/live -> 200 OK (liveMatches=${liveRes.body.data.summary.liveMatches})`);

  // Tomar un partido (idealmente fusionado Promiedos+ESPN o cualquiera de hoy) y verificar detalle
  const sampleMatch =
    todayRes.body.data.matches.find((m: UnifiedMatch) => m.sources.length === 2) ??
    todayRes.body.data.matches.find((m: UnifiedMatch) => Boolean(m.externalIds.promiedos)) ??
    todayRes.body.data.matches[0];

  assert.ok(sampleMatch, 'Need at least 1 match to test /api/v1/matches/:id');
  const detailRes = await callApi(`/api/v1/matches/${encodeURIComponent(sampleMatch.id)}`);
  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.ok, true);
  assert.ok(detailRes.body.data.match.home.name);
  assert.ok(detailRes.body.data.match.away.name);
  console.log(
    `GET /api/v1/matches/${sampleMatch.id} -> 200 OK (${detailRes.body.data.match.home.name} vs ${detailRes.body.data.match.away.name}, sources=${detailRes.body.meta.sources.join('+')}, stats=${detailRes.body.data.statistics.length}, events=${detailRes.body.data.events.length})`,
  );

  const catalogRes = await callApi('/api/v1/leagues');
  assert.equal(catalogRes.status, 200);
  assert.ok(catalogRes.body.data.categories.length > 0);
  console.log(
    `GET /api/v1/leagues -> 200 OK (categories=${catalogRes.body.data.categories.length}, espnCount=${catalogRes.body.data.espnCount})`,
  );

  // Prueba clave: Liga Profesional (usa fallback HTML __NEXT_DATA__ en Promiedos cuando API 500 + standings ESPN)
  const lpfRes = await callApi('/api/v1/leagues/liga-profesional');
  assert.equal(lpfRes.status, 200);
  assert.ok(lpfRes.body.data.standingsGroups.length > 0, 'LPF must have standings tables');
  assert.ok(lpfRes.body.data.standingsGroups[0].tables[0].rows.length > 0);
  console.log(
    `GET /api/v1/leagues/liga-profesional -> 200 OK (groups=${lpfRes.body.data.standingsGroups.length}, top=${lpfRes.body.data.standingsGroups[0].tables[0].rows[0].team.name}, matches=${lpfRes.body.data.matches.length})`,
  );

  const plRes = await callApi('/api/v1/leagues/premier-league');
  assert.equal(plRes.status, 200);
  assert.ok(plRes.body.data.standingsGroups.length > 0);
  console.log(
    `GET /api/v1/leagues/premier-league -> 200 OK (top=${plRes.body.data.standingsGroups[0].tables[0].rows[0].team.name})`,
  );

  const teamRes = await callApi('/api/v1/teams/pm-igg');
  assert.equal(teamRes.status, 200);
  assert.equal(teamRes.body.data.team.name, 'Boca Juniors');
  assert.ok(teamRes.body.data.squad.length > 0);
  console.log(
    `GET /api/v1/teams/pm-igg -> 200 OK (team=${teamRes.body.data.team.name}, stadium=${teamRes.body.data.stadium?.name}, squadGroups=${teamRes.body.data.squad.length}, espnId=${teamRes.body.data.team.externalIds.espn ?? 'n/a'})`,
  );

  const searchRes = await callApi('/api/v1/search?q=Boca');
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.body.data.teams.length > 0 || searchRes.body.data.matches.length > 0);
  console.log(
    `GET /api/v1/search?q=Boca -> 200 OK (teams=${searchRes.body.data.teams.length}, leagues=${searchRes.body.data.leagues.length}, matches=${searchRes.body.data.matches.length})`,
  );

  const badDate = await callApi('/api/v1/matches?date=not-a-date');
  assert.equal(badDate.status, 400);
  assert.equal(badDate.body.ok, false);
  console.log('GET /api/v1/matches?date=not-a-date -> 400 Bad Request OK');

  const notFound = await callApi('/api/v1/nonexistent');
  assert.equal(notFound.status, 404);
  assert.equal(notFound.body.ok, false);
  console.log('GET /api/v1/nonexistent -> 404 Not Found OK');

  // Test Cron scheduled handler
  const { ctx, promises } = makeMockExecCtx();
  await worker.scheduled({ cron: '* * * * *', scheduledTime: Date.now(), noRetry() {} }, TEST_ENV, ctx);
  await Promise.all(promises);
  console.log('worker.scheduled() cron warm -> OK');
}

async function main() {
  runUnitInvariants();
  await runLiveE2E();
  console.log('\nALL VERIFICATION CHECKS PASSED (0 FAILURES).');
  process.exit(0);
}

main().catch((err) => {
  console.error('\nVERIFICATION FAILED:', err);
  process.exit(1);
});
