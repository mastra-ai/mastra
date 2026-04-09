import { authHeaders, createApiClient, MASTRA_PLATFORM_API_URL, platformFetch, throwApiError } from '../auth/client.js';

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
  const headers: Record<string, string> = {
    ...authHeaders(token, orgId),
    'Content-Type': 'application/json',
    'x-project-id': projectId,
  };
  if (meta?.gitBranch) headers['x-git-branch'] = meta.gitBranch;
  if (meta?.projectName) headers['x-project-name'] = meta.projectName;
  if (meta?.mastraVersion) headers['x-mastra-version'] = meta.mastraVersion;

  // Step 1: Create the deploy with optional envVars
  const createResp = await platformFetch(`${MASTRA_PLATFORM_API_URL}/v1/studio/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ envVars: meta?.envVars }),
  });
  if (!createResp.ok) {
    const body = (await createResp.json().catch(() => ({}))) as { detail?: string };
    throwApiError('Deploy failed', createResp.status, body.detail);
  }
  const { deploy } = (await createResp.json()) as {
    deploy: { id: string; status: string; uploadUrl: string };
  };

  if (deploy.uploadUrl.startsWith('file://')) {
    // Local FS artifact store — write zip directly to disk
    const { writeFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    await writeFile(fileURLToPath(deploy.uploadUrl), Buffer.from(zipBuffer));
  } else {
    // GCS flow — upload zip directly to GCS via signed URL
    const uploadResp = await fetch(deploy.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/zip' },
      body: new Uint8Array(zipBuffer),
    });
    if (!uploadResp.ok) {
      throw new Error(`Artifact upload failed: ${uploadResp.status} ${uploadResp.statusText}`);
    }
  }

  // Notify API that upload is complete → triggers deploy pipeline
  const completeResp = await platformFetch(
    `${MASTRA_PLATFORM_API_URL}/v1/studio/deploys/${deploy.id}/upload-complete`,
    {
      method: 'POST',
      headers: authHeaders(token, orgId),
    },
  );
  if (!completeResp.ok) {
    const body = (await completeResp.json().catch(() => ({}))) as { detail?: string };
    throwApiError('Upload confirmation failed', completeResp.status, body.detail);
  }

  return deploy;
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
      const { data, error, response } = await client.GET('/v1/studio/deploys/{id}', {
        params: { path: { id: deployId } },
      });

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
