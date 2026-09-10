import { createBarLogWriter } from '../../utils/clack-bar.js';
import { bestEffortCancel, confirmUploadWithRetry } from '../../utils/deploy-upload.js';
import { withPollingRetries } from '../../utils/polling.js';
import {
  authHeaders,
  createApiClient,
  extractApiErrorDetail,
  MASTRA_PLATFORM_API_URL,
  platformFetch,
  throwApiError,
} from '../auth/client.js';
import { getToken } from '../auth/credentials.js';
import type { DeployDiagnosis, DeployDiagnosisLookup } from '../deploy-suggestions.js';
import type { paths } from '../platform-api.js';

type ServerProjectsResponse = paths['/v1/server/projects']['get'] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;
export type ServerProject = ServerProjectsResponse extends { projects: (infer P)[] } ? P : never;

type ServerDeployResponse = paths['/v1/server/deploys/{id}']['get'] extends {
  responses: { 200: { content: { 'application/json': infer T } } };
}
  ? T
  : never;
export type ServerDeployStatus = ServerDeployResponse;

export async function fetchServerProjects(token: string, orgId: string): Promise<ServerProject[]> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/server/projects');

  if (error) {
    throwApiError('Failed to fetch server projects', response.status);
  }

  return data.projects;
}

export async function createServerProject(token: string, orgId: string, name: string): Promise<ServerProject> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.POST('/v1/server/projects', {
    body: { name },
  });

  if (error) {
    throwApiError(`Failed to create server project — ${error.detail ?? 'unknown error'}`, response.status);
  }

  return data.project;
}

export async function fetchServerDeployStatus(
  deployId: string,
  token: string,
  orgId?: string,
): Promise<ServerDeployStatus> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/server/deploys/{id}', {
    params: { path: { id: deployId } },
  });

  if (error) {
    throwApiError('Failed to fetch server deploy status', response.status);
  }

  return data;
}

export async function fetchServerDeployDiagnosis(
  deployId: string,
  token: string,
  orgId?: string,
): Promise<DeployDiagnosisLookup> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/server/deploys/${deployId}/diagnosis`, {
    headers: authHeaders(token, orgId),
  });

  if (resp.status === 204) {
    return { state: 'healthy' };
  }

  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const error = (await resp.json()) as { detail?: string };
      detail = error.detail;
    } catch {
      detail = undefined;
    }
    throwApiError('Failed to fetch server deploy diagnosis', resp.status, detail);
  }

  const data = (await resp.json()) as { diagnosis: DeployDiagnosis | null };
  if (!data.diagnosis) {
    return { state: 'missing' };
  }

  return { state: 'ready', diagnosis: data.diagnosis };
}

export async function startServerDeployDiagnosis(deployId: string, token: string, orgId?: string): Promise<void> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/server/deploys/${deployId}/diagnosis`, {
    method: 'POST',
    headers: authHeaders(token, orgId),
  });

  if (resp.status === 201 || resp.status === 304) {
    return;
  }

  let detail: string | undefined;
  try {
    const error = (await resp.json()) as { detail?: string };
    detail = error.detail;
  } catch {
    detail = undefined;
  }

  throwApiError('Failed to start server deploy diagnosis', resp.status, detail);
}

export async function uploadServerDeploy(
  token: string,
  orgId: string,
  projectId: string,
  zipBuffer: Buffer,
  meta?: { projectName?: string; envVars?: Record<string, string>; disablePlatformObservability?: boolean },
): Promise<{ id: string; status: string }> {
  const client = createApiClient(token, orgId);

  // Step 1: Create the deploy — returns upload URL
  const { data, error, response } = await client.POST('/v1/server/deploys', {
    body: {
      projectId,
      projectName: meta?.projectName,
      envVars: meta?.envVars,
      ...(meta?.disablePlatformObservability !== undefined
        ? { disablePlatformObservability: meta.disablePlatformObservability }
        : {}),
    },
  });

  if (error) {
    throwApiError('Deploy failed', response.status, extractApiErrorDetail(error));
  }

  const { id, status, uploadUrl } = data;

  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  const cancel = (c: ReturnType<typeof createApiClient>) =>
    bestEffortCancel({
      postCancel: c2 => c2.POST('/v1/server/deploys/{id}/cancel', { params: { path: { id } } }),
      client: c,
      deployId: id,
    });

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
    await cancel(client);
    throw uploadError;
  }

  // Step 3: Notify API that upload is complete → triggers build pipeline
  await confirmUploadWithRetry({
    postUploadComplete: c => c.POST('/v1/server/deploys/{id}/upload-complete', { params: { path: { id } } }),
    cancelDeploy: cancel,
    client,
    orgId,
  });

  return { id, status };
}

export interface PollDeployOptions {
  /** Print every log line instead of the rolling tail shown on a TTY. */
  showAllLogs?: boolean;
}

export async function pollServerDeploy(
  deployId: string,
  token: string,
  orgId: string,
  maxWaitMs = 600000, // 10 minutes — server builds take longer
  options: PollDeployOptions = {},
): Promise<ServerDeployStatus> {
  const start = Date.now();
  let lastStatus = '';
  let currentToken = token;

  let client = createApiClient(currentToken, orgId);

  // Poll for build + deploy logs in the background
  const logAbort = new AbortController();
  const logsTask = pollServerLogs(deployId, currentToken, orgId, logAbort.signal, options).catch(() => {});

  try {
    while (Date.now() - start < maxWaitMs) {
      const result = await withPollingRetries(() =>
        client.GET('/v1/server/deploys/{id}', {
          params: { path: { id: deployId } },
        }),
      );

      const { data, error, response } = result;

      if (error) {
        if (response.status === 401) {
          currentToken = await getToken();
          client = createApiClient(currentToken, orgId);
          continue;
        }
        throwApiError('Poll failed', response.status);
      }

      if (data.status !== lastStatus) {
        lastStatus = data.status;
      }

      const terminal = ['running', 'failed', 'crashed', 'cancelled', 'stopped'];
      if (terminal.includes(data.status)) {
        return data;
      }

      await new Promise(r => setTimeout(r, 5000));
    }

    throw new Error('Deploy timed out');
  } finally {
    // Stop polling, let the log task fetch the final lines and flush them
    // so nothing prints after the outcome message.
    logAbort.abort();
    await logsTask;
  }
}

/* ------------------------------------------------------------------ */
/*  Environment variables                                              */
/* ------------------------------------------------------------------ */

export async function getServerProjectEnv(
  token: string,
  orgId: string,
  projectId: string,
): Promise<Record<string, string>> {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/server/projects/{id}/env', {
    params: { path: { id: projectId } },
  });

  if (error) {
    throwApiError('Failed to fetch environment variables', response.status);
  }

  return data.envVars;
}

export async function updateServerProjectEnv(
  token: string,
  orgId: string,
  projectId: string,
  envVars: Record<string, string>,
): Promise<void> {
  const client = createApiClient(token, orgId);
  const { error, response } = await client.PUT('/v1/server/projects/{id}/env', {
    params: { path: { id: projectId } },
    body: { envVars },
  });

  if (error) {
    throwApiError('Failed to update environment variables', response.status);
  }
}

export async function fetchServerProjectDetail(token: string, orgId: string, projectId: string) {
  const client = createApiClient(token, orgId);
  const { data, error, response } = await client.GET('/v1/server/projects/{id}', {
    params: { path: { id: projectId } },
  });

  if (error) {
    throwApiError('Failed to fetch server project', response.status);
  }

  return data;
}

export async function pauseServerProject(token: string, orgId: string, projectId: string): Promise<void> {
  const client = createApiClient(token, orgId);
  const { error, response } = await client.POST('/v1/server/projects/{id}/pause', {
    params: { path: { id: projectId } },
  });

  if (error) {
    if (response.status === 409) {
      const detail = extractApiErrorDetail(error);
      throwApiError('Failed to pause server', response.status, detail ?? 'Pause failed: the server is not running.');
    }
    const detail = extractApiErrorDetail(error);
    throwApiError('Failed to pause server', response.status, detail);
  }
}

/**
 * Triggers a platform restart and returns the deploy id to pass to {@link pollServerDeploy}.
 * Uses `id` from the restart response when present; otherwise polls project details until `latestDeployId`
 * changes, or until the current `latestDeployId` shows an active deploy status (in-place restart without a new id).
 */
export async function restartServerProject(token: string, orgId: string, projectId: string): Promise<string> {
  const client = createApiClient(token, orgId);

  const before = await fetchServerProjectDetail(token, orgId, projectId);
  const previousLatestDeployId = before.project.latestDeployId;

  const { data, error, response } = await client.POST('/v1/server/projects/{id}/restart', {
    params: { path: { id: projectId } },
  });

  if (error) {
    const detail = extractApiErrorDetail(error);
    if (response.status === 409) {
      throwApiError(
        'Failed to restart server',
        response.status,
        detail ??
          'Restart failed: a deployment for this project is currently active. Run `mastra server pause` to pause the server before restarting.',
      );
    }
    throwApiError('Failed to restart server', response.status, detail);
  }

  if (data?.id) {
    return data.id;
  }

  const deployIndicatesAcceptedRestart = (status: string | undefined) =>
    Boolean(status && !['failed', 'crashed', 'cancelled', 'stopped'].includes(status));

  let currentToken = token;
  let pollClient = createApiClient(currentToken, orgId);
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const {
      data: snap,
      error: snapError,
      response: snapResponse,
    } = await pollClient.GET('/v1/server/projects/{id}', { params: { path: { id: projectId } } });

    if (snapError) {
      if (snapResponse.status === 401) {
        currentToken = await getToken();
        pollClient = createApiClient(currentToken, orgId);
        continue;
      }
      throwApiError('Failed to fetch server project', snapResponse.status, extractApiErrorDetail(snapError));
    }

    const latest = snap.project.latestDeployId;
    if (latest && latest !== previousLatestDeployId) {
      return latest;
    }
    if (latest) {
      const {
        data: st,
        error: statusError,
        response: statusResponse,
      } = await pollClient.GET('/v1/server/deploys/{id}', { params: { path: { id: latest } } });

      if (statusError) {
        if (statusResponse.status === 401) {
          currentToken = await getToken();
          pollClient = createApiClient(currentToken, orgId);
          continue;
        }
        if (statusResponse.status !== 404) {
          throwApiError(
            'Failed to fetch server deploy status',
            statusResponse.status,
            extractApiErrorDetail(statusError),
          );
        }
      } else if (deployIndicatesAcceptedRestart(st?.status)) {
        return latest;
      }
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  throw new Error(
    'Restart was accepted but no deploy ID could be resolved. Check the Mastra platform for deployment status.',
  );
}

/** Sleep that returns early when the signal aborts. */
function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const SERVER_LOG_POLL_INTERVAL_MS = 2000;
const FINAL_LOG_FETCH_TIMEOUT_MS = 3000;

/**
 * Poll the server deploy logs endpoint and print new log lines.
 * Server deploys don't have SSE streaming — we poll the JSON endpoint.
 * After the signal aborts (deploy reached a terminal state) the logs are
 * fetched once more so the closing lines are not lost.
 */
async function pollServerLogs(
  deployId: string,
  token: string,
  orgId: string,
  signal: AbortSignal,
  options: PollDeployOptions = {},
): Promise<void> {
  await abortableDelay(3000, signal);

  const logWriter = createBarLogWriter({ showAll: options.showAllLogs });
  let printedBuild = 0;
  let printedDeploy = 0;
  let currentToken = token;
  let client = createApiClient(currentToken, orgId);
  let finalFetchDone = false;

  while (!finalFetchDone) {
    if (signal.aborted) finalFetchDone = true;
    try {
      const { data, response } = await client.GET('/v1/server/deploys/{id}/logs', {
        params: { path: { id: deployId } },
        // The closing fetch runs after the deploy finished; do not let a slow
        // response hold up the outcome message.
        ...(finalFetchDone ? { signal: AbortSignal.timeout(FINAL_LOG_FETCH_TIMEOUT_MS) } : {}),
      });

      if (response.status === 401) {
        currentToken = await getToken();
        client = createApiClient(currentToken, orgId);
        continue;
      }

      if (data) {
        logWriter.write(...data.buildLogs.slice(printedBuild));
        printedBuild = data.buildLogs.length;

        logWriter.write(...data.deployLogs.slice(printedDeploy));
        printedDeploy = data.deployLogs.length;
      }
    } catch {
      // Ignore errors during log polling — deploy status polling is the source of truth
    }

    if (!finalFetchDone) await abortableDelay(SERVER_LOG_POLL_INTERVAL_MS, signal);
  }

  logWriter.flush();
}
