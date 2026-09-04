import { TraceImportError } from '../../errors.js';
import {
  backoffMilliseconds,
  defaultSleep,
  parseRetryAfter,
  readResponseText,
  validateHttpOrigin,
  type FetchLike,
  type Sleep,
} from '../../http.js';
import { langfuseObservationsPageSchema, type LangfuseObservationsPage } from './schema.js';

const MAX_SOURCE_RESPONSE_BYTES = 32 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

export interface LangfuseClientOptions {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  fetch?: FetchLike;
  sleep?: Sleep;
  maxAttempts?: number;
  requestTimeoutMs?: number;
  onRetry?: () => void;
}

export class LangfuseObservationsClient {
  readonly baseUrl: string;
  private readonly authorization: string;
  private readonly fetch: FetchLike;
  private readonly sleep: Sleep;
  private readonly maxAttempts: number;
  private readonly requestTimeoutMs: number;
  private readonly onRetry?: () => void;

  constructor(options: LangfuseClientOptions) {
    if (!options.publicKey || !options.secretKey) {
      throw new Error('Langfuse public and secret keys are required.');
    }
    const origin = validateHttpOrigin(options.baseUrl, 'LANGFUSE_BASE_URL');
    if (origin.pathname !== '/' && origin.pathname !== '') {
      throw new Error('LANGFUSE_BASE_URL must be an origin without a path.');
    }
    this.baseUrl = origin.origin;
    this.authorization = `Basic ${Buffer.from(`${options.publicKey}:${options.secretKey}`).toString('base64')}`;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.onRetry = options.onRetry;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('Langfuse request timeout must be greater than zero.');
    }
  }

  async getPage(args: {
    cutoffAt: string;
    snapshotAt: string;
    fields: string;
    expandMetadata?: string;
    limit: number;
    cursor?: string;
    signal?: AbortSignal;
  }): Promise<LangfuseObservationsPage> {
    const url = new URL('/api/public/v2/observations', this.baseUrl);
    url.searchParams.set('fromStartTime', args.cutoffAt);
    url.searchParams.set('toStartTime', args.snapshotAt);
    url.searchParams.set('fields', args.fields);
    if (args.expandMetadata) url.searchParams.set('expandMetadata', args.expandMetadata);
    url.searchParams.set('limit', String(args.limit));
    if (args.cursor) url.searchParams.set('cursor', args.cursor);

    let lastError: unknown;
    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      args.signal?.throwIfAborted();
      let response: Response;
      try {
        const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
        response = await this.fetch(url, {
          headers: { Authorization: this.authorization, Accept: 'application/json' },
          redirect: 'manual',
          signal: args.signal ? AbortSignal.any([args.signal, timeoutSignal]) : timeoutSignal,
        });
      } catch (error) {
        if (args.signal?.aborted) throw error;
        lastError = error;
        if (attempt + 1 < this.maxAttempts) {
          this.onRetry?.();
          await this.sleep(backoffMilliseconds(attempt), args.signal);
          continue;
        }
        throw new TraceImportError({
          message: 'Langfuse could not be reached after the retry budget was exhausted.',
          stage: 'source',
          resumable: true,
          cause: error,
        });
      }

      if (response.status >= 300 && response.status < 400) {
        throw new TraceImportError({
          message: 'Langfuse redirected the authenticated request; cross-origin redirects are not followed.',
          stage: 'source',
          status: response.status,
        });
      }
      if (response.ok) {
        const text = await readResponseText(response, MAX_SOURCE_RESPONSE_BYTES);
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch (cause) {
          throw new TraceImportError({
            message: 'Langfuse returned invalid JSON.',
            stage: 'source',
            cause,
          });
        }
        const parsed = langfuseObservationsPageSchema.safeParse(json);
        if (!parsed.success) {
          throw new TraceImportError({
            message: `Langfuse returned an unsupported Observations API v2 response: ${parsed.error.issues[0]?.message ?? 'schema mismatch'}`,
            stage: 'source',
          });
        }
        return parsed.data;
      }

      if (response.status === 401 || response.status === 403) {
        throw new TraceImportError({
          message: `Langfuse rejected the project credentials (${response.status}).`,
          stage: 'source',
          status: response.status,
        });
      }
      if (response.status === 404) {
        throw new TraceImportError({
          message:
            'Langfuse Observations API v2 was not found. V0 requires Langfuse Cloud or self-hosted Langfuse v4+.',
          stage: 'source',
          status: 404,
        });
      }
      if (response.status === 429 || response.status === 408 || response.status >= 500) {
        if (attempt + 1 < this.maxAttempts) {
          this.onRetry?.();
          const delay =
            response.status === 429
              ? parseRetryAfter(response, backoffMilliseconds(attempt))
              : backoffMilliseconds(attempt);
          await this.sleep(delay, args.signal);
          continue;
        }
        throw new TraceImportError({
          message: `Langfuse read paused after repeated HTTP ${response.status} responses.`,
          stage: 'source',
          status: response.status,
          resumable: true,
        });
      }

      throw new TraceImportError({
        message: `Langfuse read failed with HTTP ${response.status}.`,
        stage: 'source',
        status: response.status,
      });
    }

    throw new TraceImportError({
      message: 'Langfuse read failed.',
      stage: 'source',
      resumable: true,
      cause: lastError,
    });
  }
}
