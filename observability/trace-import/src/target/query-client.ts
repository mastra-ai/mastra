import { z } from 'zod';
import { readResponseText, type FetchLike } from '../http.js';

const MAX_QUERY_RESPONSE_BYTES = 16 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;

const lightTraceSchema = z.object({
  traceId: z.string().min(1),
  spans: z.array(z.object({ spanId: z.string().min(1) })),
});

export type TraceQueryResult =
  | { kind: 'found'; spanIds: string[] }
  | { kind: 'pending' }
  | { kind: 'retryable'; reason: string }
  | { kind: 'unavailable'; reason: string };

export class MastraQueryClient {
  private readonly collectorOrigin: string;
  private readonly projectId: string;
  private readonly accessToken: string;
  private readonly fetch: FetchLike;
  private readonly requestTimeoutMs: number;

  constructor(options: {
    collectorOrigin: string;
    projectId: string;
    accessToken: string;
    fetch?: FetchLike;
    requestTimeoutMs?: number;
  }) {
    this.collectorOrigin = options.collectorOrigin;
    this.projectId = options.projectId;
    this.accessToken = options.accessToken;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    if (!Number.isFinite(this.requestTimeoutMs) || this.requestTimeoutMs <= 0) {
      throw new Error('Platform query timeout must be greater than zero.');
    }
  }

  async getTraceSpanIds(traceId: string, signal?: AbortSignal): Promise<TraceQueryResult> {
    signal?.throwIfAborted();
    let response: Response;
    try {
      const timeoutSignal = AbortSignal.timeout(this.requestTimeoutMs);
      response = await this.fetch(
        `${this.collectorOrigin}/api/observability/traces/${encodeURIComponent(traceId)}/light`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'X-Mastra-Project-Id': this.projectId,
          },
          redirect: 'manual',
          signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
        },
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      return {
        kind: 'retryable',
        reason: `Platform query request failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    if (response.status >= 300 && response.status < 400) {
      return {
        kind: 'unavailable',
        reason: `Platform redirected the authenticated query request (HTTP ${response.status}).`,
      };
    }
    if (response.status === 404) return { kind: 'pending' };
    if (response.status === 401 || response.status === 403) {
      return {
        kind: 'unavailable',
        reason: `Platform query authentication failed with HTTP ${response.status}.`,
      };
    }
    if (response.status === 429 || response.status >= 500) {
      return { kind: 'retryable', reason: `Platform query returned HTTP ${response.status}.` };
    }
    if (response.status !== 200) {
      return { kind: 'unavailable', reason: `Platform query returned HTTP ${response.status}.` };
    }

    try {
      const body = JSON.parse(await readResponseText(response, MAX_QUERY_RESPONSE_BYTES)) as unknown;
      const parsed = lightTraceSchema.safeParse(body);
      if (!parsed.success || parsed.data.traceId !== traceId) {
        return { kind: 'unavailable', reason: 'Platform query returned an invalid light trace response.' };
      }
      return {
        kind: 'found',
        spanIds: [...new Set(parsed.data.spans.map(span => span.spanId))].sort(),
      };
    } catch {
      return { kind: 'unavailable', reason: 'Platform query returned an invalid light trace response.' };
    }
  }
}
