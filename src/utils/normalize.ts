import { TEAM_NAME_ALIASES } from '../config/mappings.ts';

export interface DateFormats {
  isoDate: string;
  pmDate: string;
  espnDate: string;
  displayDate: string;
  isValid: boolean;
}

export interface ParsedMinute {
  minute: number | null;
  baseMinute: number | null;
  addedMinute: number | null;
  display: string;
}

const GENERIC_CLUB_PREFIX_RE =
  /^(?:club\s+social\s+y\s+deportivo|club\s+atletico|club\s+deportivo|club\s+de\s+gimnasia\s+y\s+esgrima|c\.?\s*s\.?\s*y\.?\s*d\.?|c\.?\s*a\.?|csyd|csd|club)\s+/;

const TOKEN_STOPWORDS = new Set([
  'fc',
  'cf',
  'sc',
  'ac',
  'cd',
  'sd',
  'ud',
  'ca',
  'club',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'y',
  'e',
]);

const DISTINCTIVE_CONFLICT_TOKENS = new Set([
  'cordoba',
  'santiago',
  'rosario',
  'jujuy',
  'mendoza',
  'tucuman',
  'san',
  'juan',
  'santa',
  'fe',
  'plata',
  'escalada',
  'caseros',
  'madrid',
  'barcelona',
  'milan',
  'united',
  'city',
  'athletic',
  'femenino',
  'women',
  'w',
  'fem',
  'u23',
  'u21',
  'u20',
  'u19',
  'u17',
  'sub23',
  'sub20',
  'sub17',
  'reserva',
  'reserves',
  'ii',
  'b',
]);

export function stripAccents(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`´]/g, "'");
}

export function slugify(input: string): string {
  return stripAccents(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveAliasSafely(key: string): string {
  const visited = new Set<string>();
  let current = key;

  while (TEAM_NAME_ALIASES[current] && !visited.has(current)) {
    visited.add(current);
    const next = TEAM_NAME_ALIASES[current];
    // Evita bucles simétricos tipo 'atletico tucuman' <-> 'atl tucuman'
    if (TEAM_NAME_ALIASES[next] === current && next.length < current.length) {
      break;
    }
    current = next;
  }

  return current;
}

export function normalizeTeamName(rawName: string): string {
  if (!rawName) return '';

  let cleaned = stripAccents(rawName)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  // Alias directo (por ejemplo con paréntesis o apóstrofe)
  if (TEAM_NAME_ALIASES[cleaned]) {
    cleaned = resolveAliasSafely(cleaned);
  }

  // Quitar puntos, apóstrofes y normalizar guiones
  cleaned = cleaned
    .replace(/\./g, '')
    .replace(/'/g, '')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  if (TEAM_NAME_ALIASES[cleaned]) {
    cleaned = resolveAliasSafely(cleaned);
  }

  // Quitar prefijos institucionales genéricos sin mutilar nombres propios
  const strippedPrefix = cleaned.replace(GENERIC_CLUB_PREFIX_RE, '').trim();
  if (strippedPrefix.length >= 3 && strippedPrefix !== 'club') {
    cleaned = strippedPrefix;
  }

  // Expansión uniforme de abreviaturas comunes en Argentina y Sudamérica
  cleaned = cleaned
    .replace(/\batl\b/g, 'atletico')
    .replace(/\bdep\b/g, 'deportivo')
    .replace(/\balte\b/g, 'almirante')
    .replace(/\bgral\b/g, 'general')
    .replace(/\bdef\b/g, 'defensa')
    .replace(/\bindep\b/g, 'independiente')
    .replace(/\s+/g, ' ')
    .trim();

  if (TEAM_NAME_ALIASES[cleaned]) {
    cleaned = resolveAliasSafely(cleaned);
  }

  // Quitar sufijos tipo "FC" / "CF" al final si queda un nombre válido
  cleaned = cleaned.replace(/\s+(?:fc|cf|sc|ac)$/i, '').trim();

  return cleaned;
}

function significantTokens(normalized: string): string[] {
  return normalized
    .replace(/[()/-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !TOKEN_STOPWORDS.has(t));
}

function hasCategoryMismatch(tokensA: string[], tokensB: string[]): boolean {
  const markers = new Set([
    'femenino',
    'women',
    'fem',
    'u23',
    'u21',
    'u20',
    'u19',
    'u17',
    'sub23',
    'sub20',
    'sub17',
    'reserva',
    'reserves',
    'ii',
    'b',
  ]);
  const aMarkers = tokensA.filter((t) => markers.has(t));
  const bMarkers = tokensB.filter((t) => markers.has(t));
  if (aMarkers.length !== bMarkers.length) return true;
  return aMarkers.some((m) => !bMarkers.includes(m));
}

export function teamsMatchScore(nameA: string, nameB: string): number {
  const a = normalizeTeamName(nameA);
  const b = normalizeTeamName(nameB);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const compactA = a.replace(/[\s-]/g, '');
  const compactB = b.replace(/[\s-]/g, '');
  if (compactA === compactB) return 0.98;

  const tokensA = significantTokens(a);
  const tokensB = significantTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  if (hasCategoryMismatch(tokensA, tokensB)) return 0;

  // Evitar falsos positivos como "Central Córdoba (S)" vs "Central Córdoba (R)"
  const conflictA = tokensA.filter((t) => DISTINCTIVE_CONFLICT_TOKENS.has(t));
  const conflictB = tokensB.filter((t) => DISTINCTIVE_CONFLICT_TOKENS.has(t));
  if (
    conflictA.length > 0 &&
    conflictB.length > 0 &&
    conflictA.some((t) => !conflictB.includes(t)) &&
    conflictB.some((t) => !conflictA.includes(t))
  ) {
    return 0.1;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const t of setA) {
    if (setB.has(t)) overlap++;
  }

  if (overlap === 0) {
    // Último recurso: un nombre contiene al otro con longitud suficiente y sin ambigüedad
    if (
      Math.min(compactA.length, compactB.length) >= 6 &&
      (compactA.includes(compactB) || compactB.includes(compactA)) &&
      Math.max(tokensA.length, tokensB.length) <= 2
    ) {
      return 0.82;
    }
    return 0;
  }

  const minLen = Math.min(setA.size, setB.size);
  const maxLen = Math.max(setA.size, setB.size);

  // Todos los tokens del nombre corto coinciden (ej. "Estudiantes" vs "Estudiantes de La Plata" requiere cuidado)
  if (overlap === minLen && minLen === maxLen) {
    return 0.96;
  }

  const dice = (2 * overlap) / (setA.size + setB.size);
  const containment = overlap / minLen;

  if (containment === 1 && minLen >= 2) {
    return Math.max(dice, 0.88);
  }

  if (containment === 1 && minLen === 1 && tokensA[0].length >= 6 && maxLen === 2) {
    // Ejemplo: "palmeiras" vs "se palmeiras", pero evitar "nacional" vs "atletico nacional"
    const otherTokens = setA.size > setB.size ? tokensA : tokensB;
    const extraToken = otherTokens.find((t) => t !== (setA.size === 1 ? tokensA[0] : tokensB[0])) ?? '';
    if (extraToken.length <= 3) return 0.86;
  }

  return Number(dice.toFixed(3));
}

export function areSameTeam(nameA: string, nameB: string): boolean {
  return teamsMatchScore(nameA, nameB) >= 0.8;
}

function formatUtcDateParts(utcDate: Date): DateFormats {
  const year = String(utcDate.getUTCFullYear());
  const month = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utcDate.getUTCDate()).padStart(2, '0');
  return {
    isoDate: `${year}-${month}-${day}`,
    pmDate: `${day}-${month}-${year}`,
    espnDate: `${year}${month}${day}`,
    displayDate: `${day}/${month}/${year}`,
    isValid: true,
  };
}

function getTodayUtcInTimezone(timezone: string): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const iso = formatter.format(new Date()); // YYYY-MM-DD
  const [y, m, d] = iso.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateFormats(
  input?: string | null,
  timezone = 'America/Argentina/Buenos_Aires',
): DateFormats {
  const raw = (input ?? '').trim().toLowerCase();

  if (!raw || raw === 'today' || raw === 'hoy') {
    return formatUtcDateParts(getTodayUtcInTimezone(timezone));
  }
  if (raw === 'yesterday' || raw === 'ayer') {
    const d = getTodayUtcInTimezone(timezone);
    d.setUTCDate(d.getUTCDate() - 1);
    return formatUtcDateParts(d);
  }
  if (raw === 'tomorrow' || raw === 'manana' || raw === 'mañana') {
    const d = getTodayUtcInTimezone(timezone);
    d.setUTCDate(d.getUTCDate() + 1);
    return formatUtcDateParts(d);
  }

  let y = 0;
  let m = 0;
  let day = 0;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const pmMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw);
  const espnMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(raw);
  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);

  if (isoMatch) {
    y = Number.parseInt(isoMatch[1], 10);
    m = Number.parseInt(isoMatch[2], 10);
    day = Number.parseInt(isoMatch[3], 10);
  } else if (pmMatch) {
    day = Number.parseInt(pmMatch[1], 10);
    m = Number.parseInt(pmMatch[2], 10);
    y = Number.parseInt(pmMatch[3], 10);
  } else if (espnMatch) {
    y = Number.parseInt(espnMatch[1], 10);
    m = Number.parseInt(espnMatch[2], 10);
    day = Number.parseInt(espnMatch[3], 10);
  } else if (slashMatch) {
    day = Number.parseInt(slashMatch[1], 10);
    m = Number.parseInt(slashMatch[2], 10);
    y = Number.parseInt(slashMatch[3], 10);
  } else {
    const fallback = formatUtcDateParts(getTodayUtcInTimezone(timezone));
    return { ...fallback, isValid: false };
  }

  const check = new Date(Date.UTC(y, m - 1, day));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== day
  ) {
    const fallback = formatUtcDateParts(getTodayUtcInTimezone(timezone));
    return { ...fallback, isValid: false };
  }

  return formatUtcDateParts(check);
}

export function parseMinuteParts(raw?: string | number | null): ParsedMinute {
  if (raw === null || raw === undefined) {
    return { minute: null, baseMinute: null, addedMinute: null, display: '' };
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const m = Math.max(0, Math.round(raw));
    return { minute: m, baseMinute: m, addedMinute: null, display: `${m}'` };
  }

  const str = String(raw).trim();
  if (!str) {
    return { minute: null, baseMinute: null, addedMinute: null, display: '' };
  }

  // Formatos: "45'+2'", "45+2'", "45+2", "67'", "90 + 4"
  const addedMatch = /(\d+)\s*'?\s*\+\s*(\d+)/.exec(str);
  if (addedMatch) {
    const base = Number.parseInt(addedMatch[1], 10);
    const added = Number.parseInt(addedMatch[2], 10);
    return {
      minute: base + added,
      baseMinute: base,
      addedMinute: added,
      display: `${base}+${added}'`,
    };
  }

  const simpleMatch = /^(\d+)\s*'?$/.exec(str);
  if (simpleMatch) {
    const base = Number.parseInt(simpleMatch[1], 10);
    return {
      minute: base,
      baseMinute: base,
      addedMinute: null,
      display: `${base}'`,
    };
  }

  return { minute: null, baseMinute: null, addedMinute: null, display: str };
}

export function parseMinute(raw?: string | number | null): number | null {
  return parseMinuteParts(raw).minute;
}

export function promiedosDateTimeToIso(
  startTime?: string | null,
  utcOffsetHours = -3,
): string {
  if (!startTime) return '';
  const trimmed = startTime.trim();
  if (!trimmed) return '';

  // Si ya es ISO
  if (trimmed.includes('T') && (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed))) {
    const d = new Date(trimmed);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  // Formato Promiedos: "DD-MM-YYYY HH:mm" o "DD-MM-YYYY"
  const match = /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(trimmed);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    const hour = match[4] ? Number.parseInt(match[4], 10) : 0;
    const min = match[5] ? Number.parseInt(match[5], 10) : 0;
    const utcMs = Date.UTC(year, month - 1, day, hour - utcOffsetHours, min, 0, 0);
    return new Date(utcMs).toISOString();
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function deterministicId(prefix: string, seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(36);
  const part2 = (h2 >>> 0).toString(36);
  const cleanPrefix = slugify(prefix) || 'id';
  return `${cleanPrefix}-${part1}${part2}`;
}
