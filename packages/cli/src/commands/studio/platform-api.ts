import { isRetryablePollingError, withPollingRetries } from '../../utils/polling.js';
import { authHeaders, createApiClient, MASTRA_PLATFORM_API_URL, platformFetch, throwApiError } from '../auth/client.js';
import { getToken } from '../auth/credentials.js';

export interface Project {
  id: string;
  name: string;
  slug: string | null;
  organizationId: string;
  latestDeployId: string | null;
  latestDeployStatus: string | null;
  instanceUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DeployStatus {
  id: string;
  status: string;
  instanceUrl: string | null;
  error: string | null;
}

export async function fetchProjects(token: string, orgId: string): Promise<Project[]> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/studio/projects');

  if (error) {
    throwApiError('Failed to fetch projects', response.status, error.detail);
  }

  return data.projects;
}

export async function createProject(token: string, orgId: string, name: string): Promise<Project> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.POST('/v1/studio/projects', {
    body: { name },
  });

  if (error) {
    throwApiError('Failed to create project', response.status, error.detail);
  }

  return data.project;
}

export interface DeployInfo {
  id: string;
  status: string;
  instanceUrl: string | null;
  error: string | null;
  projectName?: string | null;
  createdAt?: string | null;
}

export async function fetchDeployStatus(deployId: string, token: string, orgId?: string): Promise<DeployInfo> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/studio/deploys/{id}', {
    params: { path: { id: deployId } },
  });

  if (error) {
    throwApiError('Failed to fetch deploy status', response.status, error.detail);
  }

  return data.deploy;
}

export async function uploadDeploy(
  token: string,
  orgId: string,
  projectId: string,
  zipBuffer: Buffer,
  meta?: { gitBranch?: string; projectName?: string; envVars?: Record<string, string>; mastraVersion?: string },
): Promise<{ id: string; status: string }> {
  const client = createApiClient(token, orgId);

  // Step 1: Create the deploy — returns upload URL
  const { data, error, response } = await client.POST('/v1/studio/deploys', {
    params: {
      header: {
        'x-project-id': projectId,
        'x-project-name': meta?.projectName,
        'x-git-branch': meta?.gitBranch,
        'x-mastra-version': meta?.mastraVersion,
      },
    },
    body: { envVars: meta?.envVars },
  });

  if (error) {
    throwApiError('Deploy failed', response.status, error.detail);
  }

  const { id, uploadUrl } = data.deploy;

  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  // Best-effort cancel helper — used to clean up orphaned deploys on failure
  async function cancelDeploy(deployClient: ReturnType<typeof createApiClient>) {
    try {
      console.warn(`Cancelling deploy ${id}...`);
      const { error: cancelError, response: cancelResponse } = await deployClient.POST(
        '/v1/studio/deploys/{id}/cancel',
        {
          params: { path: { id } },
        },
      );
      if (cancelError) {
        console.warn(
          `Warning: failed to cancel deploy ${id} (${cancelResponse.status}). It may remain in a queued state.`,
        );
      }
    } catch {
      console.warn(`Warning: failed to cancel deploy ${id}. It may remain in a queued state.`);
    }
  }

  // Step 2: Upload artifact to the signed URL
  try {
    if (uploadUrl.startsWith('file://')) {
      const { writeFile } = await import('node:fs/promises');
      const { fileURLToPath } = await import('node:url');
      await writeFile(fileURLToPath(uploadUrl), Buffer.from(zipBuffer));
    } else {
      const uploadResp = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/zip' },
        body: new Uint8Array(zipBuffer),
      });
      if (!uploadResp.ok) {
        throw new Error(`Artifact upload failed: ${uploadResp.status} ${uploadResp.statusText}`);
      }
    }
  } catch (uploadError) {
    await cancelDeploy(client);
    throw uploadError;
  }

  // Step 3: Notify API that upload is complete → triggers build pipeline
  // Retry up to 3 times (4 total attempts) with exponential backoff for transient failures.
  const maxRetries = 3;
  let lastError: Error | undefined;
  let currentClient = client;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let completeError: unknown;
    let status: number | undefined;

    try {
      const result = await currentClient.POST('/v1/studio/deploys/{id}/upload-complete', {
        params: { path: { id } },
      });
      if (!result.error) {
        return { id, status: 'queued' };
      }
      completeError = result.error;
      status = result.response.status;
    } catch (networkError) {
      // Network-level failure (ECONNRESET, ETIMEDOUT, fetch failed, etc.)
      completeError = networkError;
    }

    // Determine if we should retry
    const isRetryableStatus = status !== undefined && (status >= 500 || status === 401);
    const isRetryableNetwork = isRetryablePollingError(completeError);
    const isRetryable = isRetryableStatus || isRetryableNetwork;

    if (!isRetryable || attempt === maxRetries) {
      const detail = status ? `${status}` : completeError instanceof Error ? completeError.message : 'unknown error';
      lastError = new Error(`Upload confirmation failed: ${detail}`);
      break;
    }

    const delay = 1000 * Math.pow(2, attempt);
    const detail = status ? `${status}` : completeError instanceof Error ? completeError.message : 'network error';
    console.warn(
      `Upload confirmation failed (${detail}), retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxRetries})`,
    );

    // On 401, refresh the token before retrying
    if (status === 401) {
      try {
        const freshToken = await getToken();
        currentClient = createApiClient(freshToken, orgId);
      } catch (refreshError) {
        lastError = refreshError instanceof Error ? refreshError : new Error('Failed to refresh authentication token');
        break;
      }
    }

    // Exponential backoff: 1s, 2s, 4s
    await new Promise(r => setTimeout(r, delay));
  }

  // All retries exhausted — cancel the orphaned deploy and throw
  await cancelDeploy(currentClient);
  throw lastError ?? new Error('Upload confirmation failed');
}

async function streamDeployLogs(deployId: string, token: string, orgId: string, signal: AbortSignal): Promise<void> {
  // Small delay to let the deploy pipeline start before requesting logs
  await new Promise(r => setTimeout(r, 2000));

  const url = `${MASTRA_PLATFORM_API_URL}/v1/studio/deploys/${deployId}/logs/stream`;

  const resp = await platformFetch(url, {
    headers: authHeaders(token, orgId),
    signal,
  });

  if (!resp.ok || !resp.body) return;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let skipNextUrlMeta = false;

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (!data) continue;
        // Filter internal server startup logs — the public URL is shown by the CLI after deploy
        if (data.includes('Mastra API running') || data.includes('Studio available')) {
          skipNextUrlMeta = true;
          continue;
        }
        // Skip the pino-pretty "url:" continuation line that follows a filtered startup log
        if (skipNextUrlMeta) {
          skipNextUrlMeta = false;
          if (/^(\x1b\[\d+m)*url(\x1b\[\d+m)*:/.test(data)) continue;
        }
        process.stdout.write(`${data}\n`);
      }
    }
  }
}

export async function pollDeploy(
  deployId: string,
  token: string,
  orgId: string,
  maxWaitMs = 600000,
): Promise<DeployStatus> {
  const start = Date.now();
  let lastStatus = '';

  // Start streaming logs in the background via SSE
  const logAbort = new AbortController();
  streamDeployLogs(deployId, token, orgId, logAbort.signal).catch(() => {});

  const client = createApiClient(token, orgId);

  try {
    while (Date.now() - start < maxWaitMs) {
      const result = await withPollingRetries(() =>
        client.GET('/v1/studio/deploys/{id}', {
          params: { path: { id: deployId } },
        }),
      );

      const { data, error, response } = result;

      if (error) {
        throwApiError('Poll failed', response.status, error.detail);
      }

      const { deploy } = data;

      if (deploy.status !== lastStatus) {
        lastStatus = deploy.status;
      }

      if (deploy.status === 'running' || deploy.status === 'failed' || deploy.status === 'stopped') {
        return deploy;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error('Deploy timed out');
  } finally {
    logAbort.abort();
  }
}
