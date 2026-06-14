const NYC_OPEN_DATA_BASE = 'https://data.cityofnewyork.us/resource';
const USA_SPENDING_BASE = 'https://api.usaspending.gov/api/v2';
const SAM_GOV_BASE = 'https://api.sam.gov/entity-information/v3/entities';

/**
 * Query NYC Open Data (Socrata) datasets via SoQL.
 * No authentication required.
 */
export async function soqlQuery(datasetId: string, params: Record<string, string>): Promise<unknown[]> {
  const url = new URL(`${NYC_OPEN_DATA_BASE}/${datasetId}.json`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`NYC Open Data error (${datasetId}): ${res.status} ${res.statusText} — ${body}`);
  }

  return (await res.json()) as unknown[];
}

/**
 * POST to USAspending.gov API.
 * No authentication required.
 */
export async function usaSpendingPost(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const url = `${USA_SPENDING_BASE}/${endpoint}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`USAspending API error (${endpoint}): ${res.status} ${res.statusText} — ${text}`);
  }

  return res.json();
}

/**
 * GET from USAspending.gov API.
 * No authentication required.
 */
export async function usaSpendingGet(endpoint: string): Promise<unknown> {
  const url = `${USA_SPENDING_BASE}/${endpoint}`;

  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`USAspending API error (${endpoint}): ${res.status} ${res.statusText} — ${text}`);
  }

  return res.json();
}

function getSamApiKey(): string {
  const key = process.env.SAM_GOV_API_KEY;
  if (!key) throw new Error('SAM_GOV_API_KEY environment variable is not set');
  return key;
}

/**
 * Query SAM.gov Entity Information API v3.
 * Requires SAM_GOV_API_KEY environment variable.
 */
export async function samQuery(params: Record<string, string>): Promise<unknown> {
  const url = new URL(SAM_GOV_BASE);
  url.searchParams.set('api_key', getSamApiKey());
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SAM.gov API error: ${res.status} ${res.statusText} — ${text}`);
  }

  return res.json();
}

/**
 * Build a SoQL $where clause from filter conditions.
 * Handles string escaping (doubles single quotes).
 */
export function buildWhereClause(conditions: Array<string | undefined>): string {
  return conditions.filter(Boolean).join(' AND ');
}

/**
 * Escape a string value for use in SoQL $where clauses.
 */
export function soqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}
