import { z } from 'zod';

import type { MonitorConfig } from '../../config';
import type { DnsResolver, PinnedTransport } from '../../lib/acquisition';
import { reportChangeSchema, reportSchema, type SummaryAgent } from '../../lib/reporting';
import { MonitorStore } from '../../lib/store';
import type { NotificationProvider } from '../../notifications';
import { monitorInputSchema, sourceSchema, type MonitorInput } from '../../schemas';

export type MonitorRunResult = {
  runId: string;
  monitorId: string;
  status: 'success' | 'partial' | 'no_change' | 'failed';
  counts: {
    sourcesRequested: number;
    sourcesChecked: number;
    sourcesFailed: number;
    candidatesDetected: number;
    candidatesClassified: number;
    candidatesDeferred: number;
  };
  sources: Array<{
    sourceId: string;
    status: 'baseline_created' | 'unchanged' | 'changed' | 'failed';
    acquisitionCompleted?: boolean;
    error?: { code: string; retryable: boolean };
    outcome?: string;
    warnings?: string[];
  }>;
  changes: z.infer<typeof reportChangeSchema>[];
  report: z.infer<typeof reportSchema>;
  notificationFailures?: string[];
};

export type Dependencies = {
  store: MonitorStore;
  config: MonitorConfig;
  resolver?: DnsResolver;
  transport?: PinnedTransport;
  summaryAgent?: SummaryAgent;
  notificationProviders?: readonly NotificationProvider[];
};

export class RunConcurrencyLimiter {
  private readonly runs = new Map<string, { active: number; waiters: Array<() => void> }>();

  async run<T>(runId: string, limit: number, task: () => Promise<T>) {
    const state = this.runs.get(runId) ?? { active: 0, waiters: [] };
    this.runs.set(runId, state);
    if (state.active >= limit) await new Promise<void>(resolve => state.waiters.push(resolve));
    state.active += 1;
    try {
      return await task();
    } finally {
      state.active -= 1;
      state.waiters.shift()?.();
      if (state.active === 0 && state.waiters.length === 0) this.runs.delete(runId);
    }
  }
}

export function errorDetails(error: unknown) {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  return { code: message, retryable: /TIMEOUT|HTTP_429|HTTP_5\d\d|DNS_TIMEOUT/.test(message) };
}

export const workflowOutputSchema = z.object({
  runId: z.string(),
  monitorId: z.string(),
  status: z.enum(['success', 'partial', 'no_change', 'failed']),
  counts: z.object({
    sourcesRequested: z.number().int(),
    sourcesChecked: z.number().int(),
    sourcesFailed: z.number().int(),
    candidatesDetected: z.number().int(),
    candidatesClassified: z.number().int(),
    candidatesDeferred: z.number().int(),
  }),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      status: z.enum(['baseline_created', 'unchanged', 'changed', 'failed']),
      acquisitionCompleted: z.boolean().optional(),
      error: z.object({ code: z.string(), retryable: z.boolean() }).optional(),
      outcome: z.string().optional(),
      warnings: z.array(z.string()).optional(),
    }),
  ),
  changes: z.array(reportChangeSchema),
  report: reportSchema,
  notificationFailures: z.array(z.string()).optional(),
});

export const sourceTaskSchema = z.object({ runId: z.string(), input: monitorInputSchema, source: sourceSchema });
export const sourceProcessedSchema = z.object({
  runId: z.string(),
  monitorId: z.string(),
  sourceId: z.string(),
  source: workflowOutputSchema.shape.sources.element,
});

export const classifiedSourcesSchema = z.object({
  processed: z.array(sourceProcessedSchema),
  changes: workflowOutputSchema.shape.changes,
});

export function validateEffectiveLimits(input: MonitorInput, config: MonitorConfig) {
  if (input.sources.length > config.sources.maxSources) throw new Error('SOURCE_LIMIT_EXCEEDED');
  if ((input.policy.sourceConcurrency ?? config.sources.concurrency) > config.sources.concurrency) {
    throw new Error('EFFECTIVE_CONCURRENCY_EXCEEDED');
  }
  if (
    (input.policy.maxCandidatesPerSource ?? config.sources.candidatesPerSource) > config.sources.candidatesPerSource
  ) {
    throw new Error('EFFECTIVE_CANDIDATE_LIMIT_EXCEEDED');
  }
}

export function createStepContext(dependencies: Dependencies) {
  const sourceLimiter = new RunConcurrencyLimiter();
  const cancellationCleanups = new Map<string, Promise<void>>();
  const finishCanceledRun = (runId: string, monitorId: string) => {
    const existing = cancellationCleanups.get(runId);
    if (existing) return existing;
    const cleanup = dependencies.store
      .finishRun({ id: runId, monitorId, status: 'running', startedAt: '' }, 'partial', { code: 'CANCELED' })
      .finally(() => {
        if (cancellationCleanups.get(runId) === cleanup) cancellationCleanups.delete(runId);
      });
    cancellationCleanups.set(runId, cleanup);
    return cleanup;
  };
  return { dependencies, sourceLimiter, finishCanceledRun };
}

export type StepContext = ReturnType<typeof createStepContext>;
