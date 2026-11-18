/**
 * Esquemas unificados de la API PRO-PIVO (Cloudflare Workers).
 * Diseñados para ser consumidos directamente por apps Flutter / Mobile / Web
 * combinando Promiedos + ESPN Argentina con trazabilidad total de IDs y logos.
 */

export type DataSourceName = 'promiedos' | 'espn';

export interface EnvBindings {
  ENVIRONMENT?: string;
  API_VERSION?: string;
  DEFAULT_TIMEZONE?: string;
  CACHE_LIVE_TTL?: string;
  CACHE_DAY_TTL?: string;
  CACHE_DETAIL_LIVE_TTL?: string;
  CACHE_DETAIL_FT_TTL?: string;
  CACHE_LEAGUE_TTL?: string;
  CACHE_TEAM_TTL?: string;
  CACHE_CATALOG_TTL?: string;
  ADMIN_TOKEN?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_API_KEY?: string;
  FOOTBALL_KV?: KVNamespace;
}

export interface ExternalIds {
  promiedos?: string;
  espn?: string;
}

export interface ApiMeta {
  version: string;
  generatedAt: string;
  timezone: string;
  cache: 'HIT' | 'MISS' | 'STALE';
  sources: DataSourceName[];
  warnings?: string[];
  tookMs?: number;
}

export interface ApiResponse<T> {
  ok: boolean;
  data: T;
  meta: ApiMeta;
}

export type MatchState =
  | 'PRE'
  | 'LIVE'
  | 'HT'
  | 'FT'
  | 'ET'
  | 'PEN'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED';

export interface MatchStatus {
  state: MatchState;
  code: string;
  label: string;
  shortLabel: string;
  minute: number | null;
  minuteDisplay: string;
  period: number | null;
  isLive: boolean;
  isFinished: boolean;
}

export interface TeamColors {
  primary?: string;
  secondary?: string;
  text?: string;
}

export interface UnifiedTeamRef {
  id: string;
  externalIds: ExternalIds;
  name: string;
  shortName: string;
  abbreviation?: string;
  slug: string;
  logo: string;
  logos: {
    promiedos?: string;
    promiedosLarge?: string;
    espn?: string;
    espnDark?: string;
    custom?: string;
  };
  countryId?: string;
  countryFlag?: string;
  colors?: TeamColors;
  form?: string;
  record?: string;
  standingSummary?: string;
  score: number | null;
  penaltyScore?: number | null;
  redCards: number;
  yellowCards?: number;
  winner?: boolean | null;
}

export type MatchEventType =
  | 'goal'
  | 'own_goal'
  | 'penalty_goal'
  | 'penalty_missed'
  | 'penalty_shootout_goal'
  | 'penalty_shootout_missed'
  | 'yellow_card'
  | 'red_card'
  | 'second_yellow'
  | 'substitution'
  | 'var'
  | 'woodwork'
  | 'other';

export interface MatchGoal {
  teamSide: 'home' | 'away';
  playerName: string;
  playerShortName?: string;
  playerId?: string;
  assistName?: string;
  minute: number | null;
  minuteDisplay: string;
  isPenalty: boolean;
  isOwnGoal: boolean;
}

export interface MatchCard {
  teamSide: 'home' | 'away';
  cardType: 'yellow' | 'red' | 'second_yellow';
  playerName: string;
  playerId?: string;
  jerseyNumber?: number | null;
  minute: number | null;
  minuteDisplay: string;
}

export interface MatchEvent {
  id?: string;
  stage?: string;
  isShootout?: boolean;
  type: MatchEventType;
  rawType?: string | number;
  teamSide: 'home' | 'away' | 'neutral';
  teamId?: string;
  teamName?: string;
  minute: number | null;
  minuteDisplay: string;
  playerName?: string;
  playerId?: string;
  playerJersey?: number | null;
  secondaryPlayerName?: string; // Asistencia o jugador que sale en un cambio
  description?: string;
  source: DataSourceName;
}

export interface TvBroadcast {
  id: string | null;
  name: string;
  slug?: string;
  promiedosId?: string;
  logo?: string;
  country?: string;
  category?: 'tv' | 'streaming' | 'ppv';
  mapped: boolean;
}

export interface MatchOddsOption {
  outcome: '1' | 'X' | '2' | string;
  value: number;
  trend?: number;
  label?: string;
}

export interface MatchOdds {
  provider?: string;
  homeWinProbability?: number;
  drawProbability?: number;
  awayWinProbability?: number;
  moneyline?: {
    home?: number;
    draw?: number;
    away?: number;
  };
  options: MatchOddsOption[];
}

export interface VenueRef {
  id?: string;
  name: string;
  city?: string;
  country?: string;
  capacity?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface UnifiedLeagueRef {
  id: string;
  canonicalSlug: string;
  externalIds: ExternalIds;
  name: string;
  shortName?: string;
  slug: string;
  countryId?: string;
  countryName?: string;
  countryFlag?: string;
  isInternational: boolean;
  logo: string;
  logos: {
    promiedos?: string;
    espn?: string;
    espnDark?: string;
    custom?: string;
  };
  promiedosUrl?: string;
  espnUrl?: string;
}

export interface UnifiedMatch {
  id: string;
  canonicalKey: string;
  externalIds: ExternalIds;
  sources: DataSourceName[];
  urlSlug: string;
  dateIso: string;
  dateLocalAr: string;
  timeLocalAr: string;
  stageRound?: string;
  league: UnifiedLeagueRef;
  status: MatchStatus;
  home: UnifiedTeamRef;
  away: UnifiedTeamRef;
  goals: MatchGoal[];
  cards: MatchCard[];
  venue?: VenueRef;
  broadcasts: TvBroadcast[];
  odds?: MatchOdds;
  hasLineups?: boolean;
  hasStatistics?: boolean;
  note?: string;
}

export interface MatchStatistic {
  key: string;
  label: string;
  homeValue: string;
  awayValue: string;
  homeNumeric?: number | null;
  awayNumeric?: number | null;
  homePct?: number | null;
  awayPct?: number | null;
}

export interface PitchCoordinates {
  x: number;
  y: number;
}

export interface PlayerMatchStats {
  goals?: number;
  assists?: number;
  shots?: number;
  shotsOnTarget?: number;
  saves?: number;
  goalsConceded?: number;
  yellowCards?: number;
  redCards?: number;
  foulsCommitted?: number;
  foulsSuffered?: number;
  minutesPlayed?: number;
  [key: string]: number | string | undefined;
}

export interface LineupPlayer {
  id?: string;
  name: string;
  shortName?: string;
  jerseyNumber: number | null;
  position: string;
  formationPosition?: string;
  isCaptain: boolean;
  starter: boolean;
  subbedIn?: boolean;
  subbedOut?: boolean;
  countryId?: string;
  countryFlag?: string;
  age?: number | null;
  height?: string;
  pitchLocation?: PitchCoordinates;
  stats?: PlayerMatchStats;
}

export interface TeamLineup {
  side: 'home' | 'away';
  teamId?: string;
  teamName: string;
  status: string;
  formation: string;
  supportsVisualLineups: boolean;
  coach?: {
    name: string;
    shortName?: string;
    age?: number | null;
    countryId?: string;
  };
  starters: LineupPlayer[];
  bench: LineupPlayer[];
}

export interface MissingPlayer {
  name: string;
  shortName?: string;
  jerseyNumber?: number | null;
  position?: string;
  countryId?: string;
  age?: number | null;
  reason: string;
  statusText?: string;
  willPlay?: boolean;
}

export interface CommentaryItem {
  id?: string;
  minute: number | null;
  minuteDisplay: string;
  period?: number | null;
  text: string;
  type?: string;
  teamName?: string;
  wallclock?: string;
}

export interface MatchPrediction {
  votesHomePct?: number;
  votesDrawPct?: number;
  votesAwayPct?: number;
  winProbabilityHome?: number;
  winProbabilityDraw?: number;
  winProbabilityAway?: number;
  picksText?: string;
}

export interface HeadToHeadSummary {
  homeWins: number;
  draws: number;
  awayWins: number;
  recentMatches: Array<{
    id?: string;
    date?: string;
    leagueName?: string;
    homeName: string;
    awayName: string;
    homeScore: number | null;
    awayScore: number | null;
  }>;
}

export interface RecentFormMatch {
  id?: string;
  date?: string;
  opponentName: string;
  opponentLogo?: string;
  homeOrAway?: 'home' | 'away';
  scoreFor: number | null;
  scoreAgainst: number | null;
  result: 'W' | 'D' | 'L' | 'U';
  leagueName?: string;
}

export interface UnifiedMatchDetail {
  match: UnifiedMatch;
  gameInfo: Array<{ label: string; value: string }>;
  referee?: string;
  attendance?: number | null;
  events: MatchEvent[];
  stageScores: Array<{
    stage: string;
    homeScore: number | null;
    awayScore: number | null;
    isPenalties?: boolean;
  }>;
  statistics: MatchStatistic[];
  lineups: {
    home?: TeamLineup;
    away?: TeamLineup;
  };
  missingPlayers: {
    home: MissingPlayer[];
    away: MissingPlayer[];
  };
  commentary: CommentaryItem[];
  prediction?: MatchPrediction;
  headToHead?: HeadToHeadSummary;
  recentForm: {
    home: Array<'W' | 'D' | 'L'>;
    away: Array<'W' | 'D' | 'L'>;
    homeMatches?: RecentFormMatch[];
    awayMatches?: RecentFormMatch[];
  };
  videos?: Array<{
    id?: string;
    title: string;
    description?: string;
    thumbnail?: string;
    url?: string;
    duration?: number;
  }>;
  news?: Array<{
    headline: string;
    description?: string;
    url?: string;
    published?: string;
    image?: string;
  }>;
}

export interface StandingRow {
  position: number;
  team: {
    id: string;
    externalIds: ExternalIds;
    name: string;
    shortName?: string;
    slug?: string;
    logo: string;
    colors?: TeamColors;
  };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  average?: number | null;
  form?: Array<'W' | 'D' | 'L'>;
  qualificationColor?: string;
  qualificationLabel?: string;
  rawValues?: Record<string, string | number>;
}

export interface StandingTable {
  id?: string;
  name: string;
  type: 'positions' | 'promedios' | 'annual' | 'other';
  rows: StandingRow[];
  legend?: Array<{ color: string; label: string }>;
}

export interface StandingGroup {
  name: string;
  tables: StandingTable[];
}

export interface BracketStage {
  name: string;
  shortName?: string | null;
  matches: Array<{
    id?: string;
    name?: string;
    status?: string;
    teams: Array<{
      id?: string;
      name: string;
      shortName?: string;
      logo?: string;
      score?: number | null;
      aggregateScore?: number | null;
      winner?: boolean;
    }>;
  }>;
}

export interface LeaderCategory {
  name: string;
  leaders: Array<{
    rank: number;
    playerName: string;
    teamName?: string;
    teamLogo?: string;
    value: string | number;
    played?: number;
  }>;
}

export interface UnifiedLeagueDetail {
  league: UnifiedLeagueRef;
  season?: string;
  standingsGroups: StandingGroup[];
  brackets: BracketStage[];
  rounds: Array<{ name: string; key: string; selected?: boolean }>;
  selectedRound?: string;
  matches: UnifiedMatch[];
  playerLeaders: LeaderCategory[];
}

export interface LeagueCategory {
  name: string;
  icon?: string;
  leagues: UnifiedLeagueRef[];
}

export interface SquadMember {
  id?: string;
  name: string;
  shortName?: string;
  jerseyNumber: number | null;
  position: string;
  formationPosition?: string;
  age?: number | null;
  birthdate?: string;
  height?: string;
  weight?: string;
  countryId?: string;
  countryFlag?: string;
  isStaff: boolean;
  headshot?: string;
  stats?: Record<string, string | number>;
}

export interface UnifiedTeamDetail {
  team: UnifiedTeamRef;
  mainLeague?: UnifiedLeagueRef;
  info: Array<{ label: string; value: string }>;
  stadium?: VenueRef & {
    info?: Array<{ label: string; value: string }>;
  };
  squad: Array<{
    groupName: string;
    players: SquadMember[];
  }>;
  matches: {
    recent: UnifiedMatch[];
    upcoming: UnifiedMatch[];
    all: UnifiedMatch[];
  };
  playerStatsFilters?: Array<{
    key: string;
    name: string;
    selected?: boolean;
    tables: LeaderCategory[];
  }>;
}

export interface ScoreboardDayPayload {
  date: string;
  summary: {
    totalMatches: number;
    liveMatches: number;
    finishedMatches: number;
    upcomingMatches: number;
    leaguesCount: number;
  };
  leagues: Array<{
    league: UnifiedLeagueRef;
    liveCount: number;
    matchesCount: number;
    matches: UnifiedMatch[];
  }>;
  matches: UnifiedMatch[];
}
