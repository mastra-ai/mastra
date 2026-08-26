import { platformFetch } from '../../auth/client.js';
import { ApiCliError } from '../errors.js';
import type { PlatformExperimentTarget } from './target.js';

interface PlatformExperimentRequest {
  target: PlatformExperimentTarget;
  path: string;
  method?: 'GET' | 'POST';
  input?: Record<string, unknown>;
  timeoutMs: number;
}

export async function requestPlatformExperiment({
  target,
  path,
  method = 'GET',
  input,
  timeoutMs,
}: PlatformExperimentRequest): Promise<unknown> {
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
    return body;
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
  return ['completed', 'succeeded', 'failed', 'resume_failed', 'canceled', 'cancelled'].includes(status);
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
