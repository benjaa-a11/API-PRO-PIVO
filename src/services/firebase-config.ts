import type { EnvBindings } from '../types/schema.ts';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAPwnLItCbEjvJzyeFiOFaWjNVs8mJkOLs',
  authDomain: 'studio-5409721801-d81e5.firebaseapp.com',
  projectId: 'studio-5409721801-d81e5',
  storageBucket: 'studio-5409721801-d81e5.firebasestorage.app',
  messagingSenderId: '542563961448',
  appId: '1:542563961448:web:c60f6861e313e8dfc549dd',
} as const;

export type FirestoreConfigDocId = 'tv_channels' | 'excluded_leagues' | 'custom_logos';

interface FirestoreValue {
  nullValue?: null;
  booleanValue?: boolean;
  integerValue?: string;
  doubleValue?: number;
  timestampValue?: string;
  stringValue?: string;
  arrayValue?: { values?: FirestoreValue[] };
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

interface FirestoreDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  updateTime?: string;
}

export function getFirebaseProjectInfo(env?: EnvBindings): {
  projectId: string;
  apiKey: string;
} {
  return {
    projectId: env?.FIREBASE_PROJECT_ID?.trim() || DEFAULT_FIREBASE_CONFIG.projectId,
    apiKey: env?.FIREBASE_API_KEY?.trim() || DEFAULT_FIREBASE_CONFIG.apiKey,
  };
}

function buildDocUrl(docId: FirestoreConfigDocId, env?: EnvBindings): string {
  const { projectId, apiKey } = getFirebaseProjectInfo(env);
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/api_config/${encodeURIComponent(docId)}?key=${encodeURIComponent(apiKey)}`;
}

function toFirestoreValue(val: unknown): FirestoreValue {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function fromFirestoreValue(fv: FirestoreValue | undefined): unknown {
  if (!fv || 'nullValue' in fv) return null;
  if ('booleanValue' in fv) return fv.booleanValue;
  if ('integerValue' in fv) return Number(fv.integerValue);
  if ('doubleValue' in fv) return fv.doubleValue;
  if ('timestampValue' in fv) return fv.timestampValue;
  if ('stringValue' in fv) return fv.stringValue;
  if ('arrayValue' in fv) {
    return (fv.arrayValue?.values ?? []).map((v) => fromFirestoreValue(v));
  }
  if ('mapValue' in fv) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fv.mapValue?.fields ?? {})) {
      out[k] = fromFirestoreValue(v);
    }
    return out;
  }
  return null;
}

export async function firestoreReadConfigMap<T>(
  docId: FirestoreConfigDocId,
  env?: EnvBindings,
): Promise<Record<string, T> | null> {
  try {
    const res = await fetch(buildDocUrl(docId, env), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`Firestore GET ${docId} failed (${res.status})`);
      return null;
    }
    const doc = (await res.json()) as FirestoreDocument;
    const items = fromFirestoreValue(doc.fields?.items);
    if (items && typeof items === 'object' && !Array.isArray(items)) {
      return items as Record<string, T>;
    }
    return {};
  } catch (err) {
    console.warn(`Firestore GET ${docId} error:`, err);
    return null;
  }
}

export async function firestoreWriteConfigMap<T>(
  docId: FirestoreConfigDocId,
  items: Record<string, T>,
  env?: EnvBindings,
): Promise<boolean> {
  try {
    const fields: Record<string, FirestoreValue> = {
      items: toFirestoreValue(items),
      count: { integerValue: String(Object.keys(items).length) },
      updatedAt: { timestampValue: new Date().toISOString() },
    };
    const res = await fetch(buildDocUrl(docId, env), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`Firestore PATCH ${docId} failed (${res.status}): ${txt.slice(0, 200)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`Firestore PATCH ${docId} error:`, err);
    return false;
  }
}
