import { TraceImportError } from '../errors.js';
import {
  backoffMilliseconds,
  defaultSleep,
  parseRetryAfter,
  readResponseText,
  validateHttpOrigin,
  type FetchLike,
  type Sleep,
} from '../http.js';
import { collectorPublishResponseSchema, type CollectorPublishResponse } from './collector-schema.js';

const DEFAULT_COLLECTOR_ORIGIN = 'https://observability.mastra.ai';
const MAX_TARGET_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export function resolveCollectorEndpoint(
  value: string | undefined,
  projectId: string,
): {
  origin: string;
  endpoint: string;
} {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) {
    throw new Error('Target project ID may only contain letters, numbers, hyphens, and underscores.');
  }
  const parsed = validateHttpOrigin(value || DEFAULT_COLLECTOR_ORIGIN, 'Platform collector URL');
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  const expectedPath = `/projects/${projectId}/ai/spans/publish`;
  if (pathname !== '/' && pathname !== expectedPath) {
    throw new Error(`Platform collector URL must be an origin or the project-scoped endpoint ${expectedPath}.`);
  }
  return { origin: parsed.origin, endpoint: `${parsed.origin}${expectedPath}` };
}

export class MastraCollectorClient {
  readonly origin: string;
  readonly endpoint: string;
  private readonly projectId: string;
  private readonly accessToken: string;
  private readonly fetch: FetchLike;
  private readonly sleep: Sleep;
  private readonly maxAttempts: number;
  private readonly requestTimeoutMs: number;
  private readonly onRetry?: () => void;

  constructor(options: {
    collectorUrl?: string;
    projectId: string;
    accessToken: string;
    fetch?: FetchLike;
    sleep?: Sleep;
    maxAttempts?: number;
    requestTimeoutMs?: number;
    onRetry?: () => void;
  }) {
    if (!options.accessToken.startsWith('sk_')) {
      throw new Error(
        'MASTRA_PLATFORM_ACCESS_TOKEN must be an organization ingestion key beginning with "sk_"; the mastra auth login token is not accepted.',
      );
    }
    const target = resolveCollectorEndpoint(options.collectorUrl, options.projectId);
    this.origin = target.origin;
    this.endpoint = target.endpoint;
    this.projectId = options.projectId;
    this.accessToken = options.accessToken;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.onRetry = options.onRetry;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('Platform request timeout must be greater than zero.');
    }
  }

  async publishBody(body: string, expectedSpanCount: number, signal?: AbortSignal): Promise<CollectorPublishResponse> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      signal?.throwIfAborted();
      let response: Response;
      try {
        const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
        response = await this.fetch(this.endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'x-mastra-observability-capabilities': 'quota-pause-v1',
          },
          body,
          redirect: 'manual',
          signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
        });
      } catch (error) {
        if (signal?.aborted) throw error;
        if (attempt + 1 < this.maxAttempts) {
          this.onRetry?.();
          await this.sleep(backoffMilliseconds(attempt), signal);
          continue;
        }
        throw new TraceImportError({
          message: 'Platform upload paused after the network retry budget was exhausted.',
          stage: 'target',
          resumable: true,
          cause: error,
        });
      }

      if (response.status >= 300 && response.status < 400) {
        throw new TraceImportError({
          message: 'Platform redirected an authenticated collector request; redirects are not followed.',
          stage: 'target',
          status: response.status,
        });
      }
      if (response.status === 200) {
        const text = await readResponseText(response, MAX_TARGET_RESPONSE_BYTES);
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch (cause) {
          throw new TraceImportError({
            message: 'Platform returned invalid JSON for an acknowledged batch.',
            stage: 'target',
            cause,
          });
        }
        const parsed = collectorPublishResponseSchema.safeParse(json);
        if (!parsed.success || parsed.data.data.spanCount !== expectedSpanCount) {
          throw new TraceImportError({
            message: `Platform acknowledgement did not contain the expected span count (${expectedSpanCount}).`,
            stage: 'target',
          });
        }
        if (parsed.data.warnings?.some(warning => warning.code === 'MISSING_STABLE_ID')) {
          throw new TraceImportError({
            message: 'Platform reported missing stable IDs for an import batch.',
            stage: 'target',
          });
        }
        return parsed.data;
      }

      if (response.status === 402) {
        throw new TraceImportError({
          message: 'Platform observability quota is exhausted; the import is safely paused.',
          stage: 'target',
          status: 402,
          resumable: true,
        });
      }
      if (response.status === 429 || [500, 502, 503, 504].includes(response.status)) {
        if (attempt + 1 < this.maxAttempts) {
          this.onRetry?.();
          const delay =
            response.status === 429
              ? parseRetryAfter(response, backoffMilliseconds(attempt))
              : backoffMilliseconds(attempt);
          await this.sleep(delay, signal);
          continue;
        }
        throw new TraceImportError({
          message: `Platform upload paused after repeated HTTP ${response.status} responses.`,
          stage: 'target',
          status: response.status,
          resumable: true,
        });
      }
      if (response.status === 204) {
        throw new TraceImportError({
          message: 'Platform returned a legacy quota-drop response (204); the batch was not acknowledged.',
          stage: 'target',
          status: 204,
          resumable: true,
        });
      }
      if (response.status === 404) {
        throw new TraceImportError({
          message: `Project "${this.projectId}" was not found for this organization key. The project ID may be stale, deleted, or owned by a different organization. Re-run with --project using a current project ID or slug.`,
          stage: 'target',
          status: response.status,
        });
      }
      if ([400, 401, 403].includes(response.status)) {
        throw new TraceImportError({
          message: `Platform rejected the import batch with HTTP ${response.status}.`,
          stage: 'target',
          status: response.status,
        });
      }
      throw new TraceImportError({
        message: `Platform upload failed with HTTP ${response.status}.`,
        stage: 'target',
        status: response.status,
      });
    }
    throw new TraceImportError({ message: 'Platform upload failed.', stage: 'target', resumable: true });
  }
}
