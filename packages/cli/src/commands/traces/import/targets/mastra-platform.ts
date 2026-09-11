import { serializePreparedTraceBatch } from '../prepared-traces.js';
import type { TraceImportTarget, TraceImportTargetUploadOptions } from '../target.js';
import type { PreparedTraceBatch } from '../types.js';

const DEFAULT_ENDPOINT = 'https://observability.mastra.ai';
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const OBSERVABILITY_CAPABILITIES_HEADER = 'x-mastra-observability-capabilities';
const QUOTA_PAUSE_CAPABILITY = 'quota-pause-v1';

type Fetch = typeof globalThis.fetch;
type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export interface MastraPlatformTraceTargetOptions {
  accessToken: string;
  projectId: string;
  /** A collector origin or a full URL ending in `/spans/publish`. */
  endpoint?: string;
}

export interface MastraPlatformTraceTargetDependencies {
  fetch?: Fetch;
  sleep?: Sleep;
  maxAttempts?: number;
  requestTimeoutMs?: number;
}

export class MastraPlatformUploadError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'MastraPlatformUploadError';
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

/** Uploads normalized trace batches to the project-scoped Mastra collector. */
export class MastraPlatformTraceTarget implements TraceImportTarget {
  readonly projectId: string;

  private readonly accessToken: string;
  private readonly endpoint: string;
  private readonly fetch: Fetch;
  private readonly sleep: Sleep;
  private readonly maxAttempts: number;
  private readonly requestTimeoutMs: number;

  constructor(options: MastraPlatformTraceTargetOptions, dependencies: MastraPlatformTraceTargetDependencies = {}) {
    this.accessToken = requireValue(options.accessToken, 'Mastra Platform access token');
    this.projectId = requireProjectId(options.projectId);
    this.endpoint = resolveTracesEndpoint(options.endpoint ?? DEFAULT_ENDPOINT, this.projectId);
    this.fetch = dependencies.fetch ?? globalThis.fetch;
    this.sleep = dependencies.sleep ?? sleep;
    this.maxAttempts = dependencies.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.requestTimeoutMs = dependencies.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    if (!Number.isInteger(this.maxAttempts) || this.maxAttempts < 1) {
      throw new Error('Mastra Platform max attempts must be a positive integer.');
    }
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('Mastra Platform request timeout must be greater than zero.');
    }
  }

  async upload(batch: PreparedTraceBatch, options: TraceImportTargetUploadOptions = {}): Promise<void> {
    const body = serializePreparedTraceBatch(batch);

    for (let attempt = 0; ; attempt++) {
      options.signal?.throwIfAborted();

      let response: Response;
      try {
        const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
        response = await this.fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            [OBSERVABILITY_CAPABILITIES_HEADER]: QUOTA_PAUSE_CAPABILITY,
          },
          body,
          redirect: 'manual',
          signal: options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal,
        });
      } catch (cause) {
        if (options.signal?.aborted) throw options.signal.reason ?? cause;
        if (attempt + 1 < this.maxAttempts) {
          await this.sleep(backoffMilliseconds(attempt), options.signal);
          continue;
        }
        throw new MastraPlatformUploadError('Could not reach Mastra Platform after the retry limit was exhausted.', {
          retryable: true,
          cause,
        });
      }

      if (response.status >= 300 && response.status < 400) {
        await discardResponseBody(response);
        throw new MastraPlatformUploadError(
          'Mastra Platform redirected an authenticated collector request. Redirects are not followed.',
          { status: response.status },
        );
      }

      if (response.ok) {
        try {
          await assertAcknowledgement(response, batch.spanCount);
          return;
        } catch (cause) {
          if (options.signal?.aborted) throw options.signal.reason ?? cause;
          if (attempt + 1 < this.maxAttempts) {
            await this.sleep(backoffMilliseconds(attempt), options.signal);
            continue;
          }
          throw new MastraPlatformUploadError(
            'Mastra Platform did not acknowledge the uploaded span count after the retry limit was exhausted.',
            { retryable: true, cause },
          );
        }
      }

      const retryable = isRetryableStatus(response.status);
      if (retryable && attempt + 1 < this.maxAttempts) {
        const delay = parseRetryAfter(response.headers.get('retry-after'), backoffMilliseconds(attempt));
        await discardResponseBody(response);
        await this.sleep(delay, options.signal);
        continue;
      }

      await discardResponseBody(response);
      throw platformResponseError(response.status, retryable);
    }
  }
}

function requireValue(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} is required.`);
  return value.trim();
}

function requireProjectId(value: string): string {
  const projectId = requireValue(value, 'Mastra Platform project ID');
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Mastra Platform project ID may only contain letters, numbers, hyphens, and underscores.');
  }
  return projectId;
}

function resolveTracesEndpoint(value: string, projectId: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error('Mastra Platform observability endpoint must be a valid URL.', { cause });
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      'Mastra Platform observability endpoint cannot contain credentials, query parameters, or a fragment.',
    );
  }
  const localhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
    throw new Error('Mastra Platform observability endpoint must use HTTPS, except when testing against localhost.');
  }

  const pathname = url.pathname.replace(/\/+$/, '');
  if (!pathname) return `${url.origin}/projects/${projectId}/ai/spans/publish`;
  if (!pathname.endsWith('/spans/publish')) {
    throw new Error('Mastra Platform observability endpoint must be an origin or end in /spans/publish.');
  }

  const projectRoute = pathname.match(/^\/projects\/([^/]+)\/ai\/spans\/publish$/);
  if (projectRoute && projectRoute[1] !== projectId) {
    throw new Error('Mastra Platform observability endpoint belongs to a different target project.');
  }
  return `${url.origin}${pathname}`;
}

async function assertAcknowledgement(response: Response, expectedSpanCount: number): Promise<void> {
  const value: unknown = await response.json();
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as Record<string, unknown>).ok !== true
  ) {
    throw new Error('Collector response is not a successful acknowledgement.');
  }

  const data = (value as Record<string, unknown>).data;
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Collector acknowledgement does not contain data.');
  }
  if ((data as Record<string, unknown>).spanCount !== expectedSpanCount) {
    throw new Error('Collector acknowledgement span count does not match the uploaded batch.');
  }
}

function platformResponseError(status: number, retryable: boolean): MastraPlatformUploadError {
  if (status === 401 || status === 403) {
    return new MastraPlatformUploadError(`Mastra Platform rejected the access token (HTTP ${status}).`, { status });
  }
  if (status === 402) {
    return new MastraPlatformUploadError('Mastra Platform observability quota is exhausted (HTTP 402).', { status });
  }
  if (status === 413) {
    return new MastraPlatformUploadError('Mastra Platform rejected a trace batch because it is too large (HTTP 413).', {
      status,
    });
  }
  if (status === 404) {
    return new MastraPlatformUploadError(
      'Mastra Platform could not find the target project. Check the project and access token (HTTP 404).',
      { status },
    );
  }
  return new MastraPlatformUploadError(`Mastra Platform collector request failed with HTTP ${status}.`, {
    status,
    retryable,
  });
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function backoffMilliseconds(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** attempt);
}

function parseRetryAfter(value: string | null, fallback: number): number {
  if (value === null) return fallback;
  const retryAfter = value.trim();
  if (!retryAfter) return fallback;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const date = Date.parse(retryAfter);
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
    // Cleanup must not replace the upload error that the caller needs.
  }
}
