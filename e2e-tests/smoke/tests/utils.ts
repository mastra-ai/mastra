import { inject } from 'vitest';

/**
 * Get the base URL from the global setup.
 */
export function getBaseUrl(): string {
  return inject('baseUrl');
}

/**
 * Make a JSON API request to the Mastra server.
 */
export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}${path}`;
  return fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
}

/**
 * Make a JSON API request and parse the response.
 */
export async function fetchJson<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ status: number; data: T }> {
  const res = await fetchApi(path, options);
  const data = await res.json();
  return { status: res.status, data: data as T };
}

/**
 * Start a workflow and return the result.
 * Generates a client-side runId for consistent tracking.
 */
export async function startWorkflow(
  workflowId: string,
  body: Record<string, unknown> = {},
  runId?: string,
): Promise<{ runId: string; status: number; data: any }> {
  const id = runId ?? crypto.randomUUID();
  const res = await fetchApi(`/api/workflows/${workflowId}/start-async?runId=${id}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { runId: id, status: res.status, data };
}

/**
 * Resume a suspended workflow run.
 */
export async function resumeWorkflow(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; data: any }> {
  const res = await fetchApi(`/api/workflows/${workflowId}/resume-async?runId=${runId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

/**
 * Get a workflow run by ID.
 */
export async function getWorkflowRun(
  workflowId: string,
  runId: string,
): Promise<{ status: number; data: any }> {
  return fetchJson(`/api/workflows/${workflowId}/runs/${runId}`);
}

/**
 * Stream a workflow execution and collect all chunks.
 * Mastra uses \x1E (record separator) delimited JSON, Content-Type: text/plain.
 */
export async function streamWorkflow(
  workflowId: string,
  body: Record<string, unknown> = {},
  runId?: string,
): Promise<{ runId: string; chunks: any[] }> {
  const id = runId ?? crypto.randomUUID();
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/workflows/${workflowId}/stream?runId=${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const chunks = parseStreamChunks(text);

  return { runId: id, chunks };
}

/**
 * Stream a workflow resume and collect all chunks.
 */
export async function streamResumeWorkflow(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ chunks: any[] }> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/workflows/${workflowId}/resume-stream?runId=${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const chunks = parseStreamChunks(text);

  return { chunks };
}

/**
 * Start a workflow using the sync /start endpoint (fire-and-forget).
 * Requires a pre-created run via /create-run.
 */
export async function startWorkflowSync(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; data: any }> {
  const res = await fetchApi(`/api/workflows/${workflowId}/start?runId=${runId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

/**
 * Resume a workflow using the sync /resume endpoint (fire-and-forget).
 */
export async function resumeWorkflowSync(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ status: number; data: any }> {
  const res = await fetchApi(`/api/workflows/${workflowId}/resume?runId=${runId}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

/**
 * Stream a time-travel execution via /time-travel-stream.
 */
export async function streamTimeTravelWorkflow(
  workflowId: string,
  runId: string,
  body: Record<string, unknown> = {},
): Promise<{ chunks: any[] }> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/workflows/${workflowId}/time-travel-stream?runId=${runId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const chunks = parseStreamChunks(text);

  return { chunks };
}

/**
 * Poll a workflow run until it reaches one of the target statuses.
 */
export async function pollWorkflowRun(
  workflowId: string,
  runId: string,
  targetStatuses: string[],
  maxAttempts = 30,
  intervalMs = 500,
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await fetchJson<any>(`/api/workflows/${workflowId}/runs/${runId}`);
    if (targetStatuses.includes(data.status)) {
      return data;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Run ${runId} did not reach status [${targetStatuses.join(',')}] within ${maxAttempts * intervalMs}ms`);
}

/**
 * Parse \x1E-delimited stream chunks.
 * Throws on malformed JSON rather than silently returning raw strings.
 */
function parseStreamChunks(text: string): any[] {
  return text
    .split('\x1E')
    .filter(s => s.trim().length > 0)
    .map(s => JSON.parse(s));
}
