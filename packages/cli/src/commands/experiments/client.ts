import { ApiCliError } from '../api/errors.js';
import { platformFetch } from '../auth/client.js';
import { parsePlatformExperimentResponse } from './responses.js';
import type { PlatformExperimentResponseKind, PlatformExperimentResponseByKind } from './responses.js';
import type { PlatformExperimentTarget } from './target.js';

interface PlatformExperimentRequest<K extends PlatformExperimentResponseKind> {
  target: PlatformExperimentTarget;
  path: string;
  method?: 'GET' | 'POST';
  input?: Record<string, unknown>;
  timeoutMs: number;
  responseKind: K;
}

export async function requestPlatformExperiment<K extends PlatformExperimentResponseKind>({
  target,
  path,
  method = 'GET',
  input,
  timeoutMs,
  responseKind,
}: PlatformExperimentRequest<K>): Promise<PlatformExperimentResponseByKind[K]> {
  const url = new URL(`${target.baseUrl}/projects/${encodeURIComponent(target.projectId)}/experiments${path}`);
  const headers = { ...target.headers };
  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(timeoutMs) };

  if (method === 'GET') {
    for (const [key, value] of Object.entries(input ?? {})) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  } else if (input) {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify(input);
  }

  try {
    const response = await platformFetch(url, init);
    const body = await parseResponse(response);
    if (!response.ok) {
      throw new ApiCliError('HTTP_ERROR', platformErrorMessage(response.status, body), {
        status: response.status,
        body,
      });
    }
    return parsePlatformExperimentResponse(responseKind, body, {
      method,
      path,
      status: response.status,
    });
  } catch (error) {
    if (error instanceof ApiCliError) throw error;
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiCliError('REQUEST_TIMEOUT', `Platform experiment request timed out after ${timeoutMs}ms`, {
        timeoutMs,
      });
    }
    throw new ApiCliError('SERVER_UNREACHABLE', 'Could not reach the Mastra Platform control plane', {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function pollPlatformExperiment({
  target,
  experimentId,
  intervalMs,
  pollTimeoutMs,
  requestTimeoutMs,
}: {
  target: PlatformExperimentTarget;
  experimentId: string;
  intervalMs: number;
  pollTimeoutMs: number;
  requestTimeoutMs: number;
}): Promise<unknown> {
  const deadline = Date.now() + pollTimeoutMs;
  while (true) {
    const result = await requestPlatformExperiment({
      target,
      path: `/${encodeURIComponent(experimentId)}`,
      timeoutMs: requestTimeoutMs,
      responseKind: 'experiment-detail',
    });
    const status = readStatus(result);
    if (status && isTerminalStatus(status)) return result;
    if (Date.now() >= deadline) {
      throw new ApiCliError('REQUEST_TIMEOUT', `Experiment ${experimentId} did not finish within ${pollTimeoutMs}ms`, {
        experimentId,
        status,
        pollTimeoutMs,
      });
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

function readStatus(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const status = (value as Record<string, unknown>).status;
  return typeof status === 'string' ? status : undefined;
}

function isTerminalStatus(status: string): boolean {
  return ['completed', 'completed-with-errors', 'failed', 'cancelled', 'timed-out'].includes(status);
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function platformErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const error = (body as Record<string, unknown>).error;
    const message = (body as Record<string, unknown>).message;
    if (typeof error === 'string' && typeof message === 'string') return `${error}: ${message}`;
    if (typeof message === 'string') return message;
  }
  return `Platform experiment request failed with status ${status}`;
}
