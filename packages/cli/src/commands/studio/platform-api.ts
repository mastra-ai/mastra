import { bestEffortCancel, confirmUploadWithRetry } from '../../utils/deploy-upload.js';
import { withPollingRetries } from '../../utils/polling.js';
import { authHeaders, createApiClient, MASTRA_PLATFORM_API_URL, platformFetch, throwApiError } from '../auth/client.js';
import { getToken } from '../auth/credentials.js';
import type { DeployDiagnosis, DeployDiagnosisLookup } from '../deploy-suggestions.js';

export interface Project {
  id: string;
  name: string;
  slug: string | null;
  organizationId: string;
  latestDeployId: string | null;
  latestDeployStatus: string | null;
  latestDeployCreatedAt?: string | null;
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

export async function fetchDeployDiagnosis(
  deployId: string,
  token: string,
  orgId?: string,
): Promise<DeployDiagnosisLookup> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/studio/deploys/${deployId}/diagnosis`, {
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
    throwApiError('Failed to fetch deploy diagnosis', resp.status, detail);
  }

  const data = (await resp.json()) as { diagnosis: DeployDiagnosis | null };
  if (!data.diagnosis) {
    return { state: 'missing' };
  }

  return { state: 'ready', diagnosis: data.diagnosis };
}

export async function startDeployDiagnosis(deployId: string, token: string, orgId?: string): Promise<void> {
  const resp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/studio/deploys/${deployId}/diagnosis`, {
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

  throwApiError('Failed to start deploy diagnosis', resp.status, detail);
}

export async function uploadDeploy(
  token: string,
  orgId: string,
  projectId: string,
  zipBuffer: Buffer,
  meta?: {
    gitBranch?: string;
    projectName?: string;
    envVars?: Record<string, string>;
    mastraVersion?: string;
    disablePlatformObservability?: boolean;
  },
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
    body: {
      envVars: meta?.envVars,
      ...(meta?.disablePlatformObservability !== undefined
        ? { disablePlatformObservability: meta.disablePlatformObservability }
        : {}),
    },
  });

  if (error) {
    throwApiError('Deploy failed', response.status, error.detail);
  }

  const { id, status, uploadUrl } = data.deploy;

  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  const cancel = (c: ReturnType<typeof createApiClient>) =>
    bestEffortCancel({
      postCancel: c2 => c2.POST('/v1/studio/deploys/{id}/cancel', { params: { path: { id } } }),
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
    postUploadComplete: c => c.POST('/v1/studio/deploys/{id}/upload-complete', { params: { path: { id } } }),
    cancelDeploy: cancel,
    client,
    orgId,
  });

  return { id, status };
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
  let currentToken = token;

  // Start streaming logs in the background via SSE
  const logAbort = new AbortController();
  streamDeployLogs(deployId, currentToken, orgId, logAbort.signal).catch(() => {});

  let client = createApiClient(currentToken, orgId);

  try {
    while (Date.now() - start < maxWaitMs) {
      const result = await withPollingRetries(() =>
        client.GET('/v1/studio/deploys/{id}', {
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
