import { MASTRA_CLOUD_API_URL, authHeaders } from '../auth/client.js';

export interface Project {
  id: string;
  name: string;
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
  const resp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/projects`, {
    headers: authHeaders(token, orgId),
  });

  if (!resp.ok) {
    throw new Error(`Failed to fetch projects: ${resp.status}`);
  }

  const data = (await resp.json()) as { projects: Project[] };
  return data.projects;
}

export async function createProject(token: string, orgId: string, name: string): Promise<Project> {
  const resp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/projects`, {
    method: 'POST',
    headers: {
      ...authHeaders(token, orgId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Failed to create project: ${resp.status} — ${text}`);
  }

  const data = (await resp.json()) as { project: Project };
  return data.project;
}

export async function uploadDeploy(
  token: string,
  orgId: string,
  projectId: string,
  zipBuffer: Buffer,
  meta?: { gitBranch?: string; projectName?: string; envVars?: Record<string, string> },
): Promise<{ id: string; status: string }> {
  const headers: Record<string, string> = {
    ...authHeaders(token, orgId),
    'Content-Type': 'application/json',
    'x-project-id': projectId,
  };
  if (meta?.gitBranch) headers['x-git-branch'] = meta.gitBranch;
  if (meta?.projectName) headers['x-project-name'] = meta.projectName;

  // Step 1: Create the deploy with optional envVars
  const createResp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/deploys`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ envVars: meta?.envVars }),
  });
  if (!createResp.ok) {
    const text = await createResp.text();
    throw new Error(`Deploy failed: ${createResp.status} ${createResp.statusText} — ${text}`);
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
  const completeResp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deploy.id}/upload-complete`, {
    method: 'POST',
    headers: authHeaders(token, orgId),
  });
  if (!completeResp.ok) {
    const text = await completeResp.text();
    throw new Error(`Upload confirmation failed: ${completeResp.status} — ${text}`);
  }

  return deploy;
}

async function streamDeployLogs(deployId: string, token: string, orgId: string, signal: AbortSignal): Promise<void> {
  // Small delay to let the deploy pipeline start before requesting logs
  await new Promise(r => setTimeout(r, 2000));

  const url = `${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deployId}/logs/stream`;

  const resp = await fetch(url, {
    headers: authHeaders(token, orgId),
    signal,
  });

  if (!resp.ok || !resp.body) return;

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim();
        if (data) {
          process.stdout.write(`${data}\n`);
        }
      }
    }
  }
}

export async function pollDeploy(
  deployId: string,
  token: string,
  orgId: string,
  maxWaitMs = 180000,
): Promise<DeployStatus> {
  const start = Date.now();
  let lastStatus = '';

  // Start streaming logs in the background via SSE
  const logAbort = new AbortController();
  streamDeployLogs(deployId, token, orgId, logAbort.signal).catch(() => {});

  try {
    while (Date.now() - start < maxWaitMs) {
      const resp = await fetch(`${MASTRA_CLOUD_API_URL}/v1/studio/deploys/${deployId}`, {
        headers: authHeaders(token, orgId),
      });

      if (!resp.ok) {
        throw new Error(`Poll failed: ${resp.status}`);
      }

      const { deploy } = (await resp.json()) as { deploy: DeployStatus };

      if (deploy.status !== lastStatus) {
        lastStatus = deploy.status;
      }

      if (deploy.status === 'running' || deploy.status === 'failed') {
        return deploy;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error('Deploy timed out');
  } finally {
    logAbort.abort();
  }
}
