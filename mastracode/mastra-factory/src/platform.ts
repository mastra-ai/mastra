import { MASTRA_PLATFORM_API_URL, authHeaders, extractApiErrorDetail, platformFetch } from 'mastra/internal/auth';

export type ProjectRegion = 'eu' | 'us';

export interface PlatformProject {
  id: string;
  slug: string;
  name: string;
}

export interface AttachedDatabase {
  id: string;
  status: 'provisioning' | 'ready' | 'failed' | string;
  error: string | null;
}

export interface ConnectionEnvVar {
  name: string;
  value: string;
  secret: boolean;
}

export interface DatabaseConnection {
  envVars: ConnectionEnvVar[];
}

interface CreateProjectResponse {
  project: PlatformProject;
}

interface CreateTokenResponse {
  token: { id: string; name: string };
  secret: string;
}

interface AttachDatabaseResponse {
  database: AttachedDatabase;
}

/**
 * Common failure path: read `detail`/`message` out of the JSON body if the
 * response wasn't JSON-parseable, fall back to the raw text.
 */
async function extractError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return `${res.status} ${res.statusText}`;
  try {
    const parsed = JSON.parse(text) as unknown;
    const detail = extractApiErrorDetail(parsed);
    if (detail) return detail;
  } catch {
    // fall through to raw text
  }
  return text.slice(0, 500);
}

class PlatformApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'PlatformApiError';
    this.status = status;
  }
}

/** POST /v1/server/projects — create a server project (Railway-provisioned). */
export async function createServerProject({
  token,
  orgId,
  name,
  region,
}: {
  token: string;
  orgId: string;
  name: string;
  region: ProjectRegion;
}): Promise<PlatformProject> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/server/projects`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, region, factoryEnabled: true }),
  });
  if (!res.ok) {
    throw new PlatformApiError(res.status, `Failed to create project — ${await extractError(res)}`);
  }
  const body = (await res.json()) as CreateProjectResponse;
  return body.project;
}

/**
 * POST /v1/auth/tokens — mint an `sk_` WorkOS org API key.
 * Returns the plaintext secret; the platform never returns it again.
 */
export async function mintOrgApiKey({
  token,
  orgId,
  keyName,
}: {
  token: string;
  orgId: string;
  keyName: string;
}): Promise<string> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/auth/tokens`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: keyName }),
  });
  if (!res.ok) {
    throw new PlatformApiError(res.status, `Failed to create API key — ${await extractError(res)}`);
  }
  const body = (await res.json()) as CreateTokenResponse;
  return body.secret;
}

/**
 * POST /v1/server/projects/:id/databases — attach a Neon Postgres database.
 * Returns immediately with `status: 'provisioning'`; poll for `ready`.
 *
 * Note: this route requires `requireRole('admin')`. Non-admin org members
 * will get a 403.
 */
export async function attachNeonDatabase({
  token,
  orgId,
  projectId,
  name,
  regionId,
}: {
  token: string;
  orgId: string;
  projectId: string;
  name: string;
  regionId: string;
}): Promise<AttachedDatabase> {
  const res = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases`,
    {
      method: 'POST',
      headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'neon', name, regionId }),
    },
  );
  if (!res.ok) {
    if (res.status === 403) {
      throw new PlatformApiError(
        403,
        `Attaching a database requires the admin role in your organization. Ask an org admin to run \`create-factory\`, or attach a database from the dashboard.`,
      );
    }
    throw new PlatformApiError(res.status, `Failed to attach Neon database — ${await extractError(res)}`);
  }
  const body = (await res.json()) as AttachDatabaseResponse;
  return body.database;
}

/** GET /v1/server/projects/:id/databases/:dbId — status poll target. */
export async function getDatabaseStatus({
  token,
  orgId,
  projectId,
  databaseId,
  signal,
}: {
  token: string;
  orgId: string;
  projectId: string;
  databaseId: string;
  signal?: AbortSignal;
}): Promise<AttachedDatabase> {
  const res = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`,
    { headers: authHeaders(token, orgId), signal },
  );
  if (!res.ok) {
    throw new PlatformApiError(res.status, `Failed to read database status — ${await extractError(res)}`);
  }
  const body = (await res.json()) as { database: AttachedDatabase };
  return body.database;
}

/** GET /v1/server/projects/:id/databases/:dbId/connection — only 200s when `ready`. */
export async function getDatabaseConnection({
  token,
  orgId,
  projectId,
  databaseId,
}: {
  token: string;
  orgId: string;
  projectId: string;
  databaseId: string;
}): Promise<DatabaseConnection> {
  const res = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/connection`,
    { headers: authHeaders(token, orgId) },
  );
  if (!res.ok) {
    throw new PlatformApiError(res.status, `Failed to fetch connection string — ${await extractError(res)}`);
  }
  return (await res.json()) as DatabaseConnection;
}

/**
 * Poll `getDatabaseStatus` until the database is `ready`.
 *
 * Each poll is bounded by the *remaining* overall budget via a per-request
 * `AbortSignal`, so a hung `platformFetch` can't blow past `timeoutMs`. When
 * an outer `signal` is supplied it composes with the per-request timeout —
 * whichever fires first aborts the in-flight request.
 *
 * @param intervalMs how often to poll (default 2s)
 * @param timeoutMs total budget (default 60s)
 */
export async function waitForDatabaseReady({
  token,
  orgId,
  projectId,
  databaseId,
  intervalMs = 2_000,
  timeoutMs = 60_000,
  signal,
}: {
  token: string;
  orgId: string;
  projectId: string;
  databaseId: string;
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<AttachedDatabase> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 'provisioning';
  const timeoutError = () =>
    new PlatformApiError(
      504,
      `Neon database is still ${lastStatus} after ${Math.round(timeoutMs / 1000)}s. Check the dashboard or retry \`mastra login\` + re-run.`,
    );
  while (true) {
    signal?.throwIfAborted();
    // Bound each poll by whatever remains of the overall budget so a stuck
    // fetch can't exceed `timeoutMs`.
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw timeoutError();
    const perRequestSignal = composeSignals(signal, AbortSignal.timeout(remaining));
    let row: AttachedDatabase;
    try {
      row = await getDatabaseStatus({ token, orgId, projectId, databaseId, signal: perRequestSignal });
    } catch (err) {
      // Reshape the per-request timeout as the same 504 the deadline branch
      // raises; other errors (network, 5xx) bubble up unchanged.
      if (err instanceof DOMException && err.name === 'TimeoutError') throw timeoutError();
      throw err;
    }
    lastStatus = row.status;
    if (row.status === 'ready') return row;
    if (row.status === 'failed') {
      throw new PlatformApiError(500, `Neon provisioning failed${row.error ? ` — ${row.error}` : ''}`);
    }
    if (Date.now() >= deadline) throw timeoutError();
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

/**
 * Compose an outer AbortSignal with a per-request timeout signal. Uses
 * `AbortSignal.any` where available (Node ≥20.3); falls back to a manual
 * proxy for older runtimes.
 */
function composeSignals(outer: AbortSignal | undefined, inner: AbortSignal): AbortSignal {
  if (!outer) return inner;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([outer, inner]);
  }
  const controller = new AbortController();
  const abort = (reason: unknown) => controller.abort(reason);
  if (outer.aborted) abort(outer.reason);
  else outer.addEventListener('abort', () => abort(outer.reason), { once: true });
  if (inner.aborted) abort(inner.reason);
  else inner.addEventListener('abort', () => abort(inner.reason), { once: true });
  return controller.signal;
}

export { PlatformApiError };
