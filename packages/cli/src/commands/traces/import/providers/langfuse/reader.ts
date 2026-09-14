import {
  LangfuseClient,
  type LangfuseClientDependencies,
  type LangfuseClientOptions,
  type LangfuseObservationQuery,
  LangfuseResponseTooLargeError,
} from './client.js';
import {
  LANGFUSE_EXPAND_ALL_METADATA,
  LANGFUSE_OBSERVATION_FIELDS,
  type LangfuseObservation,
  type LangfuseObservationsPage,
  type LangfuseProject,
  type LangfuseSourceTrace,
  type LangfuseTraceDiscovery,
} from './types.js';

const PAGE_SIZE = 1000;

export interface LangfuseReadWindow {
  cutoffAt: string;
  snapshotAt: string;
  projectId: string;
  signal?: AbortSignal;
  onRetry?: () => void;
}

export interface LangfuseTraceReadOptions {
  traceId: string;
  projectId: string;
  signal?: AbortSignal;
  onRetry?: () => void;
}

/**
 * Reads raw Langfuse observations. Tree validation and conversion into Mastra
 * spans belong to the Langfuse provider adapter.
 */
export class LangfuseObservationsReader {
  private readonly client: LangfuseClient;

  constructor(options: LangfuseClientOptions, dependencies: LangfuseClientDependencies = {}) {
    this.client = new LangfuseClient(options, dependencies);
  }

  get baseUrl(): string {
    return this.client.baseUrl;
  }

  identify(signal?: AbortSignal): Promise<LangfuseProject> {
    return this.client.identifyProject(signal);
  }

  /**
   * Finds each unique trace with at least one observation starting inside the
   * selected window. Rows without a trace ID remain visible to the adapter so
   * it can report them instead of silently dropping them.
   */
  async *discoverTraces(window: LangfuseReadWindow): AsyncGenerator<LangfuseTraceDiscovery> {
    const seenTraceIds = new Set<string>();

    for await (const page of this.pages({
      fields: 'core',
      limit: PAGE_SIZE,
      fromStartTime: window.cutoffAt,
      toStartTime: window.snapshotAt,
      signal: window.signal,
      onRetry: window.onRetry,
    })) {
      for (const observation of page) {
        assertProject(observation, window.projectId);
        if (observation.traceId === null || observation.traceId.trim().length === 0) {
          yield { kind: 'missing-trace-id', observationId: observation.id };
        } else if (!seenTraceIds.has(observation.traceId)) {
          seenTraceIds.add(observation.traceId);
          yield { kind: 'trace', traceId: observation.traceId };
        }
      }
    }
  }

  /**
   * Fetches the complete currently available observation set for one selected
   * trace. The detail request intentionally has no date filter: a child can
   * start outside the discovery window and still belong to the selected tree.
   */
  async readTrace(options: LangfuseTraceReadOptions): Promise<LangfuseSourceTrace> {
    if (options.traceId.trim().length === 0) throw new Error('Langfuse trace ID is required.');
    if (options.projectId.trim().length === 0) throw new Error('Langfuse project ID is required.');

    const observations: LangfuseObservation[] = [];
    for await (const page of this.pages({
      fields: LANGFUSE_OBSERVATION_FIELDS,
      expandMetadata: LANGFUSE_EXPAND_ALL_METADATA,
      limit: PAGE_SIZE,
      traceId: options.traceId,
      signal: options.signal,
      onRetry: options.onRetry,
    })) {
      for (const observation of page) {
        assertProject(observation, options.projectId);
        if (observation.traceId !== options.traceId) {
          throw new Error(`Langfuse returned observation ${observation.id} for a different trace.`);
        }
        observations.push(observation);
      }
    }

    return { traceId: options.traceId, observations };
  }

  private async *pages(
    query: Omit<LangfuseObservationQuery, 'cursor'> & { onRetry?: () => void },
  ): AsyncGenerator<LangfuseObservation[]> {
    const { onRetry, ...observationQuery } = query;
    const seenCursors = new Set<string>();
    let limit = observationQuery.limit;
    let cursor: string | undefined;

    do {
      observationQuery.signal?.throwIfAborted();
      let page: LangfuseObservationsPage;
      while (true) {
        try {
          page = await this.client.getObservationsPage({ ...observationQuery, cursor, limit }, onRetry);
          break;
        } catch (error) {
          if (!(error instanceof LangfuseResponseTooLargeError) || limit === 1) throw error;

          // The cursor identifies the last returned observation independently
          // of the requested limit, so the page can safely be retried smaller.
          limit = Math.max(1, Math.floor(limit / 2));
          onRetry?.();
        }
      }
      yield page.data;

      cursor = page.cursor ?? undefined;
      if (cursor !== undefined) {
        if (seenCursors.has(cursor)) {
          throw new Error('Langfuse returned a repeated pagination cursor.');
        }
        seenCursors.add(cursor);
      }
    } while (cursor !== undefined);
  }
}

function assertProject(observation: LangfuseObservation, projectId: string): void {
  if (observation.projectId !== projectId) {
    throw new Error(`Langfuse returned observation ${observation.id} from a different project.`);
  }
}
