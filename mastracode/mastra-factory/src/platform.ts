import {
  MASTRA_PLATFORM_API_URL,
  authHeaders,
  extractApiErrorDetail,
  platformFetch,
} from 'mastra/internal/auth';

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
}: {
  token: string;
  orgId: string;
  name: string;
}): Promise<PlatformProject> {
  const res = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/server/projects`, {
    method: 'POST',
    headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
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
  regionId?: string;
}): Promise<AttachedDatabase> {
  const res = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases`,
    {
      method: 'POST',
      headers: { ...authHeaders(token, orgId), 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'neon', name, ...(regionId ? { regionId } : {}) }),
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
}: {
  token: string;
  orgId: string;
  projectId: string;
  databaseId: string;
}): Promise<AttachedDatabase> {
  const res = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/server/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`,
    { headers: authHeaders(token, orgId) },
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
  while (true) {
    signal?.throwIfAborted();
    const row = await getDatabaseStatus({ token, orgId, projectId, databaseId });
    if (row.status === 'ready') return row;
    if (row.status === 'failed') {
      throw new PlatformApiError(500, `Neon provisioning failed${row.error ? ` — ${row.error}` : ''}`);
    }
    if (Date.now() >= deadline) {
      throw new PlatformApiError(
        504,
        `Neon database is still ${row.status} after ${Math.round(timeoutMs / 1000)}s. Check the dashboard or retry \`mastra login\` + re-run.`,
      );
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

export { PlatformApiError };
