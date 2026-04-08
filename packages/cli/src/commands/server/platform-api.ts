import { createApiClient, throwApiError } from '../auth/client.js';
import { getToken } from '../auth/credentials.js';
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

export async function uploadServerDeploy(
  token: string,
  orgId: string,
  projectId: string,
  zipBuffer: Buffer,
  meta?: { projectName?: string; envVars?: Record<string, string> },
): Promise<{ id: string; status: string }> {
  const client = createApiClient(token, orgId);

  // Step 1: Create the deploy — returns upload URL
  const { data, error, response } = await client.POST('/v1/server/deploys', {
    body: { projectId, projectName: meta?.projectName, envVars: meta?.envVars },
  });

  if (error) {
    throwApiError('Deploy failed', response.status);
  }

  const { id, uploadUrl } = data;

  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  // Step 2: Upload artifact to the signed URL
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

  // Step 3: Notify API that upload is complete → triggers build pipeline
  const { error: completeError, response: completeResponse } = await client.POST(
    '/v1/server/deploys/{id}/upload-complete',
    { params: { path: { id } } },
  );

  if (completeError) {
    throwApiError('Upload confirmation failed', completeResponse.status);
  }

  return { id, status: 'queued' };
}

export async function pollServerDeploy(
  deployId: string,
  token: string,
  orgId: string,
  maxWaitMs = 600000, // 10 minutes — server builds take longer
): Promise<ServerDeployStatus> {
  const start = Date.now();
  let lastStatus = '';
  let currentToken = token;

  let client = createApiClient(currentToken, orgId);

  // Poll for build + deploy logs in the background
  const logAbort = new AbortController();
  pollServerLogs(deployId, currentToken, orgId, logAbort.signal).catch(() => {});

  try {
    while (Date.now() - start < maxWaitMs) {
      const { data, error, response } = await client.GET('/v1/server/deploys/{id}', {
        params: { path: { id: deployId } },
      });

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
    logAbort.abort();
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

/**
 * Poll the server deploy logs endpoint and print new log lines.
 * Server deploys don't have SSE streaming — we poll the JSON endpoint.
 */
async function pollServerLogs(deployId: string, token: string, orgId: string, signal: AbortSignal): Promise<void> {
  await new Promise(r => setTimeout(r, 3000));

  let printedBuild = 0;
  let printedDeploy = 0;
  let currentToken = token;
  let client = createApiClient(currentToken, orgId);

  while (!signal.aborted) {
    try {
      const { data, response } = await client.GET('/v1/server/deploys/{id}/logs', {
        params: { path: { id: deployId } },
      });

      if (response.status === 401) {
        currentToken = await getToken();
        client = createApiClient(currentToken, orgId);
        continue;
      }

      if (data) {
        const newBuild = data.buildLogs.slice(printedBuild);
        for (const line of newBuild) {
          process.stdout.write(`${line}\n`);
        }
        printedBuild = data.buildLogs.length;

        const newDeploy = data.deployLogs.slice(printedDeploy);
        for (const line of newDeploy) {
          process.stdout.write(`${line}\n`);
        }
        printedDeploy = data.deployLogs.length;
      }
    } catch {
      // Ignore errors during log polling — deploy status polling is the source of truth
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}
