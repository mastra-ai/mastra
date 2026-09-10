import type { LangfuseObservation, LangfuseObservationsPage, LangfuseProject } from './types.js';

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

type Fetch = typeof globalThis.fetch;
type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface LangfuseClientOptions {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
}

export interface LangfuseClientDependencies {
  fetch?: Fetch;
  sleep?: Sleep;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  onRetry?: () => void;
}

export interface LangfuseObservationQuery {
  fields: string;
  limit: number;
  cursor?: string;
  traceId?: string;
  fromStartTime?: string;
  toStartTime?: string;
  expandMetadata?: string;
  signal?: AbortSignal;
}

export class LangfuseReaderError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'LangfuseReaderError';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

export class LangfuseResponseTooLargeError extends LangfuseReaderError {
  constructor() {
    super(`Langfuse response exceeds the ${MAX_RESPONSE_BYTES}-byte API limit.`);
    this.name = 'LangfuseResponseTooLargeError';
  }
}

export class LangfuseClient {
  readonly baseUrl: string;

  private readonly authorization: string;
  private readonly fetch: Fetch;
  private readonly sleep: Sleep;
  private readonly maxAttempts: number;
  private readonly requestTimeoutMs: number;
  private readonly onRetry?: () => void;

  constructor(options: LangfuseClientOptions, dependencies: LangfuseClientDependencies = {}) {
    const publicKey = requireCredential(options.publicKey, 'Langfuse public key');
    const secretKey = requireCredential(options.secretKey, 'Langfuse secret key');

    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.authorization = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;
    this.fetch = dependencies.fetch ?? globalThis.fetch;
    this.sleep = dependencies.sleep ?? sleep;
    this.maxAttempts = dependencies.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.onRetry = dependencies.onRetry;

    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new Error('Langfuse max attempts must be a positive integer.');
    }
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('Langfuse request timeout must be greater than zero.');
    }
  }

  async identifyProject(signal?: AbortSignal): Promise<LangfuseProject> {
    const value = await this.requestJson(new URL('/api/public/projects', this.baseUrl), signal);
    return parseProject(value);
  }

  async getObservationsPage(query: LangfuseObservationQuery): Promise<LangfuseObservationsPage> {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 1000) {
      throw new Error('Langfuse observation page size must be between 1 and 1000.');
    }

    const url = new URL('/api/public/v2/observations', this.baseUrl);
    url.searchParams.set('fields', query.fields);
    url.searchParams.set('limit', String(query.limit));
    setQuery(url, 'cursor', query.cursor);
    setQuery(url, 'traceId', query.traceId);
    setQuery(url, 'fromStartTime', query.fromStartTime);
    setQuery(url, 'toStartTime', query.toStartTime);
    setQuery(url, 'expandMetadata', query.expandMetadata);

    try {
      return parseObservationsPage(await this.requestJson(url, query.signal));
    } catch (error) {
      if (error instanceof LangfuseReaderError && error.status === 404) {
        throw new LangfuseReaderError(
          'Langfuse Observations API v2 was not found. Use Langfuse Cloud or self-hosted Langfuse v4 or later.',
          { status: 404, cause: error },
        );
      }
      throw error;
    }
  }

  private async requestJson(url: URL, signal?: AbortSignal): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      signal?.throwIfAborted();

      let response: Response;
      try {
        const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
        response = await this.fetch(url, {
          headers: { Authorization: this.authorization, Accept: 'application/json' },
          redirect: 'manual',
          signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
        });
      } catch (error) {
        if (signal?.aborted) throw signal.reason ?? error;
        lastError = error;
        if (attempt + 1 < this.maxAttempts) {
          await this.waitBeforeRetry(backoffMilliseconds(attempt), signal);
          continue;
        }
        throw new LangfuseReaderError('Could not reach Langfuse after the retry limit was exhausted.', {
          retryable: true,
          cause: error,
        });
      }

      if (response.status >= 300 && response.status < 400) {
        await discardResponseBody(response);
        throw new LangfuseReaderError('Langfuse redirected an authenticated request. Redirects are not followed.', {
          status: response.status,
        });
      }

      if (response.ok) {
        return parseJson(await readResponseText(response));
      }

      if (response.status === 401 || response.status === 403) {
        await discardResponseBody(response);
        throw new LangfuseReaderError(`Langfuse rejected the project credentials (HTTP ${response.status}).`, {
          status: response.status,
        });
      }

      if (response.status === 404) {
        await discardResponseBody(response);
        throw new LangfuseReaderError('Langfuse API endpoint was not found.', { status: 404 });
      }

      if (isRetryableStatus(response.status)) {
        if (attempt + 1 < this.maxAttempts) {
          const delay =
            response.status === 429
              ? parseRetryAfter(response.headers.get('retry-after'), backoffMilliseconds(attempt))
              : backoffMilliseconds(attempt);
          await discardResponseBody(response);
          await this.waitBeforeRetry(delay, signal);
          continue;
        }
        await discardResponseBody(response);
        throw new LangfuseReaderError(`Langfuse request failed repeatedly with HTTP ${response.status}.`, {
          status: response.status,
          retryable: true,
        });
      }

      await discardResponseBody(response);
      throw new LangfuseReaderError(`Langfuse request failed with HTTP ${response.status}.`, {
        status: response.status,
      });
    }

    throw new LangfuseReaderError('Langfuse request failed.', { retryable: true, cause: lastError });
  }

  private async waitBeforeRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
    this.onRetry?.();
    await this.sleep(milliseconds, signal);
  }
}

function requireCredential(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
  return value.trim();
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error('LANGFUSE_BASE_URL must be a valid URL.', { cause });
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('LANGFUSE_BASE_URL cannot contain credentials, query parameters, or a fragment.');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('LANGFUSE_BASE_URL must not contain a path.');
  }

  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
    throw new Error('LANGFUSE_BASE_URL must use HTTPS, except when testing against localhost.');
  }

  return url.origin;
}

function setQuery(url: URL, key: string, value: string | undefined): void {
  if (value !== undefined) url.searchParams.set(key, value);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoffMilliseconds(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** attempt);
}

function parseRetryAfter(value: string | null, fallback: number): number {
  if (value === null) return fallback;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallback;
}

async function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      reject(signal?.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
    };
    const timeout = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cleanup must not replace the request error that the caller needs.
  }
}

async function readResponseText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    await discardResponseBody(response);
    throw new LangfuseResponseTooLargeError();
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new LangfuseResponseTooLargeError();
    }
    text += decoder.decode(chunk.value, { stream: true });
  }

  return text + decoder.decode();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (cause) {
    throw new LangfuseReaderError('Langfuse returned invalid JSON.', { cause });
  }
}

function parseProject(value: unknown): LangfuseProject {
  const response = requireRecord(value, 'project response');
  if (!Array.isArray(response.data) || response.data.length !== 1) {
    throw new LangfuseReaderError('Langfuse credentials must identify exactly one source project.');
  }

  const project = requireRecord(response.data[0], 'project');
  return {
    id: requireString(project.id, 'project id'),
    name: project.name === null || project.name === undefined ? null : requireString(project.name, 'project name'),
  };
}

function parseObservationsPage(value: unknown): LangfuseObservationsPage {
  const response = requireRecord(value, 'observations response');
  const meta = requireRecord(response.meta, 'observations response metadata');
  if (!Array.isArray(response.data)) {
    throw new LangfuseReaderError('Langfuse observations response must contain a data array.');
  }

  const cursor = meta.cursor;
  if (cursor !== null && cursor !== undefined && (typeof cursor !== 'string' || cursor.length === 0)) {
    throw new LangfuseReaderError('Langfuse observations response contains an invalid cursor.');
  }

  return {
    data: response.data.map(parseObservation),
    cursor: cursor ?? null,
  };
}

function parseObservation(value: unknown): LangfuseObservation {
  const observation = requireRecord(value, 'observation');
  return {
    ...observation,
    id: requireString(observation.id, 'observation id'),
    traceId: requireNullableString(observation.traceId, 'observation trace id'),
    startTime: requireString(observation.startTime, 'observation start time'),
    endTime: requireNullableString(observation.endTime, 'observation end time'),
    projectId: requireString(observation.projectId, 'observation project id'),
    parentObservationId: requireNullableString(observation.parentObservationId, 'parent observation id'),
    type: requireString(observation.type, 'observation type'),
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LangfuseReaderError(`Langfuse returned an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new LangfuseReaderError(`Langfuse returned an invalid ${label}.`);
  }
  return value;
}

function requireNullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return requireString(value, label);
}
