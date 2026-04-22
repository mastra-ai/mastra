/**
 * Seed Dataset from DuckDB Traces
 *
 * Queries the DuckDB observability store for recent agent traces,
 * converts them into MastraCodeExperimentItems, and inserts them
 * into a dataset for experiment runs.
 *
 * This is the "trace → dataset" pipeline that turns real sessions
 * into reproducible experiment inputs.
 */

import type { MastraCodeExperimentItem } from './types';
import type { TraceSpan, TraceFeedback, TraceToItemOptions } from './trace-to-item';
import { traceToItem } from './trace-to-item';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Options for seeding a dataset from traces. */
export interface SeedDatasetOptions {
  /** Filter: only include traces after this date. */
  after?: Date;
  /** Filter: only include traces before this date. */
  before?: Date;
  /** Filter: only include traces with feedback. */
  withFeedbackOnly?: boolean;
  /** Filter: only include negative feedback traces (regression candidates). */
  negativeFeedbackOnly?: boolean;
  /** Maximum number of traces to include. Default 50. */
  limit?: number;
  /** Workspace snapshot to attach to all items. */
  workspace?: MastraCodeExperimentItem['workspace'];
  /** Default category override. */
  category?: string;
  /** Default difficulty override. */
  difficulty?: 'easy' | 'medium' | 'hard';
  /** Tags to attach to all items. */
  tags?: string[];
  /** Whether to include conversation history. Default true. */
  includeMemory?: boolean;
}

/** Result from seeding a dataset. */
export interface SeedDatasetResult {
  /** Number of items successfully created. */
  itemsCreated: number;
  /** Number of traces that failed to convert. */
  itemsSkipped: number;
  /** The experiment items that were created. */
  items: MastraCodeExperimentItem[];
  /** Trace IDs that were skipped (with reason). */
  skipped: Array<{ traceId: string; reason: string }>;
}

/**
 * Minimal observability store interface for querying traces.
 * Avoids importing the full DuckDB store type.
 */
export interface ObservabilityStoreLike {
  listTraces(args: {
    filters?: Record<string, unknown>;
    orderBy?: { field: string; direction: string };
    pagination?: { page: number; perPage: number };
  }): Promise<{ spans: TraceSpan[] }>;
  getTrace(args: { traceId: string }): Promise<{ traceId: string; spans: TraceSpan[] } | null>;
  listFeedback(args: {
    filters?: Record<string, unknown>;
    pagination?: { page: number; perPage: number };
  }): Promise<{ feedback: TraceFeedback[] }>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Core pipeline
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Seed experiment items from DuckDB traces.
 *
 * Queries the observability store for agent run traces, converts each
 * into an experiment item, and returns the results.
 *
 * @param store - Observability storage instance
 * @param options - Filtering and configuration options
 * @returns Items created and skip information
 *
 * @example
 * ```typescript
 * const store = await mastra.getStorage().getStore('observability');
 * const result = await seedFromTraces(store, {
 *   after: new Date('2025-04-01'),
 *   negativeFeedbackOnly: true,
 *   workspace: { type: 'git-ref', repo: '.', commit: 'main' },
 * });
 * console.log(`Seeded ${result.itemsCreated} items from traces`);
 * ```
 */
export async function seedFromTraces(
  store: ObservabilityStoreLike,
  options?: SeedDatasetOptions,
): Promise<SeedDatasetResult> {
  const limit = options?.limit ?? 50;

  // Build filters — spanType values are lowercase in the DB (e.g. 'agent_run')
  // listTraces already selects only root spans (parentSpanId IS NULL)
  const filters: Record<string, unknown> = {
    spanType: 'agent_run',
  };
  if (options?.after || options?.before) {
    filters.dateRange = {
      start: options.after,
      end: options.before,
    };
  }

  // Query root spans (traces)
  const { spans: rootSpans } = await store.listTraces({
    filters,
    orderBy: { field: 'startedAt', direction: 'DESC' },
    pagination: { page: 0, perPage: limit },
  });

  // If feedback filtering is requested, get feedback
  let feedbackByTrace = new Map<string, TraceFeedback>();
  if (options?.withFeedbackOnly || options?.negativeFeedbackOnly) {
    const { feedback } = await store.listFeedback({
      pagination: { page: 0, perPage: 1000 },
    });
    for (const fb of feedback) {
      feedbackByTrace.set(fb.traceId, fb);
    }
  }

  // Filter traces based on feedback
  let targetSpans = rootSpans;
  if (options?.withFeedbackOnly) {
    targetSpans = targetSpans.filter(s => feedbackByTrace.has(s.traceId));
  }
  if (options?.negativeFeedbackOnly) {
    targetSpans = targetSpans.filter(s => {
      const fb = feedbackByTrace.get(s.traceId);
      if (!fb) return false;
      const val = fb.value;
      return val === 'down' || val === '0' || val === 'negative' || (typeof val === 'number' && val < 0.5);
    });
  }

  // Convert each trace to an experiment item
  const items: MastraCodeExperimentItem[] = [];
  const skipped: Array<{ traceId: string; reason: string }> = [];

  const itemOptions: TraceToItemOptions = {
    workspace: options?.workspace,
    category: options?.category,
    difficulty: options?.difficulty,
    tags: options?.tags,
    includeMemory: options?.includeMemory,
  };

  for (const rootSpan of targetSpans) {
    try {
      // Get full trace (all spans for this trace)
      const trace = await store.getTrace({ traceId: rootSpan.traceId });
      if (!trace) {
        skipped.push({ traceId: rootSpan.traceId, reason: 'trace not found' });
        continue;
      }

      const feedback = feedbackByTrace.get(rootSpan.traceId);
      const item = traceToItem(trace.spans, itemOptions, feedback);

      if (item) {
        items.push(item);
      } else {
        skipped.push({ traceId: rootSpan.traceId, reason: 'failed to extract user message' });
      }
    } catch (err) {
      skipped.push({
        traceId: rootSpan.traceId,
        reason: err instanceof Error ? err.message : 'unknown error',
      });
    }
  }

  return {
    itemsCreated: items.length,
    itemsSkipped: skipped.length,
    items,
    skipped,
  };
}

/**
 * Seed a single item from a specific trace ID.
 * Useful for manually promoting a specific session to the dataset.
 */
export async function seedFromTrace(
  store: ObservabilityStoreLike,
  traceId: string,
  options?: TraceToItemOptions,
): Promise<MastraCodeExperimentItem | null> {
  const trace = await store.getTrace({ traceId });
  if (!trace) return null;

  // Get feedback for this trace
  const { feedback } = await store.listFeedback({
    filters: { traceId },
    pagination: { page: 0, perPage: 1 },
  });

  return traceToItem(trace.spans, options, feedback[0]);
}
