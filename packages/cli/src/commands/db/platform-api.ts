import { withPollingRetries } from '../../utils/polling.js';
import { authHeaders, extractApiErrorDetail, platformFetch, throwApiError } from '../auth/client.js';

export type DatabaseKind = 'turso' | 'neon' | 'mongodb';
export type DatabaseStatus = 'provisioning' | 'ready' | 'failed' | 'deleting' | 'deleted';

export interface ProjectDatabase {
  id: string;
  platformProjectId: string;
  organizationId: string;
  /** Null = project-scoped (shared by all environments). */
  environmentId: string | null;
  kind: DatabaseKind;
  name: string;
  status: DatabaseStatus;
  region: string | null;
  providerResourceId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DatabaseConnectionEnvVar {
  name: string;
  value: string;
  secret: boolean;
}

export interface DatabaseConnection {
  envVars: DatabaseConnectionEnvVar[];
  snippets: { language: string; title: string; code: string }[];
  docsUrl: string;
}

/**
 * Env var names each provider injects at deploy time (names only — values are
 * managed by the platform). Mirrors `deriveEnvVars` in the platform's
 * project-databases service.
 */
export const DB_ENV_VAR_NAMES: Record<DatabaseKind, string[]> = {
  turso: ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'],
  neon: ['DATABASE_URL'],
  mongodb: [],
};

const ADMIN_REQUIRED_MESSAGE = 'You need the admin role in this organization to manage databases.';

function getApiUrl(): string {
  return process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';
}

async function readErrorDetail(resp: Response): Promise<string | undefined> {
  try {
    return extractApiErrorDetail(await resp.json());
  } catch {
    return undefined;
  }
}

async function handleFailure(resp: Response, message: string): Promise<never> {
  if (resp.status === 403) {
    throw new Error(ADMIN_REQUIRED_MESSAGE);
  }
  throwApiError(message, resp.status, await readErrorDetail(resp));
}

export async function fetchDatabases(token: string, orgId: string, projectId: string): Promise<ProjectDatabase[]> {
  const resp = await platformFetch(`${getApiUrl()}/v1/server/projects/${projectId}/databases`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    await handleFailure(resp, 'Failed to fetch databases');
  }

  const data = (await resp.json()) as { databases: ProjectDatabase[] };
  return data.databases;
}

export async function attachDatabase(
  token: string,
  orgId: string,
  projectId: string,
  input: { kind: DatabaseKind; name: string; regionId?: string; environmentId?: string },
): Promise<ProjectDatabase> {
  const resp = await platformFetch(`${getApiUrl()}/v1/server/projects/${projectId}/databases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token, orgId) },
    body: JSON.stringify(input),
  });

  if (!resp.ok) {
    await handleFailure(resp, 'Failed to create database');
  }

  const data = (await resp.json()) as { database: ProjectDatabase };
  return data.database;
}

export async function fetchDatabase(
  token: string,
  orgId: string,
  projectId: string,
  dbId: string,
): Promise<ProjectDatabase> {
  const resp = await platformFetch(`${getApiUrl()}/v1/server/projects/${projectId}/databases/${dbId}`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    await handleFailure(resp, 'Failed to fetch database');
  }

  const data = (await resp.json()) as { database: ProjectDatabase };
  return data.database;
}

export async function deleteDatabase(token: string, orgId: string, projectId: string, dbId: string): Promise<void> {
  const resp = await platformFetch(`${getApiUrl()}/v1/server/projects/${projectId}/databases/${dbId}`, {
    method: 'DELETE',
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    await handleFailure(resp, 'Failed to delete database');
  }
}

export async function fetchDatabaseConnection(
  token: string,
  orgId: string,
  projectId: string,
  dbId: string,
): Promise<DatabaseConnection> {
  const resp = await platformFetch(`${getApiUrl()}/v1/server/projects/${projectId}/databases/${dbId}/connection`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    await handleFailure(resp, 'Failed to fetch connection instructions');
  }

  return (await resp.json()) as DatabaseConnection;
}

/**
 * Poll a database row until it leaves `provisioning`.
 *
 * - Resolves with the row once `status === 'ready'`.
 * - Throws when provisioning fails (`status === 'failed'`), surfacing the
 *   provider error — never swallowed.
 * - Throws on timeout with a pointer to `mastra env db show` for later inspection.
 */
export async function pollDatabaseUntilReady(
  token: string,
  orgId: string,
  projectId: string,
  dbId: string,
  opts?: { maxWaitMs?: number; intervalMs?: number; onStatus?: (status: DatabaseStatus) => void },
): Promise<ProjectDatabase> {
  const maxWaitMs = opts?.maxWaitMs ?? 5 * 60 * 1000;
  const intervalMs = opts?.intervalMs ?? 3000;
  const start = Date.now();
  let lastStatus: DatabaseStatus | '' = '';

  while (true) {
    const db = await withPollingRetries(() => fetchDatabase(token, orgId, projectId, dbId));

    if (db.status !== lastStatus) {
      lastStatus = db.status;
      opts?.onStatus?.(db.status);
    }

    if (db.status === 'ready') {
      return db;
    }

    if (db.status === 'failed') {
      throw new Error(`Database provisioning failed${db.error ? `: ${db.error}` : ' (no error detail from provider)'}`);
    }

    if (db.status === 'deleting' || db.status === 'deleted') {
      throw new Error(
        `Database was ${db.status === 'deleted' ? 'deleted' : 'scheduled for deletion'} while provisioning`,
      );
    }

    if (Date.now() - start >= maxWaitMs) {
      throw new Error(
        `Timed out waiting for database to become ready (last status: ${db.status}). ` +
          `Check again with: mastra env db show ${dbId}`,
      );
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}
