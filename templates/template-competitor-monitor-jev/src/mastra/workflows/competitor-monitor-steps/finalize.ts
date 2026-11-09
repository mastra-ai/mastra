import { createStep } from '@mastra/core/workflows';

import { buildReport } from '../../lib/reporting';
import type { MonitorInput } from '../../schemas';
import {
  classifiedSourcesSchema,
  workflowOutputSchema,
  type MonitorRunResult,
  type StepContext,
} from './workflow-context';

export function aggregateRun(
  processed: Array<{ source: MonitorRunResult['sources'][number] }>,
  changes: MonitorRunResult['changes'],
) {
  const sources = processed.map((item: { source: MonitorRunResult['sources'][number] }) => item.source);
  const pendingIds = changes.filter((change: MonitorRunResult['changes'][number]) => change.status !== 'classified');
  const failed = sources.filter((source: MonitorRunResult['sources'][number]) => source.status === 'failed').length;
  const baselineCreated = sources.filter(
    (source: MonitorRunResult['sources'][number]) => source.status === 'baseline_created',
  ).length;
  const status: MonitorRunResult['status'] =
    failed === sources.length
      ? 'failed'
      : failed > 0 || pendingIds.length > 0
        ? 'partial'
        : baselineCreated > 0 ||
            changes.some((change: MonitorRunResult['changes'][number]) => change.status === 'classified')
          ? 'success'
          : 'no_change';
  return {
    status,
    sources,
    counts: {
      sourcesRequested: sources.length,
      // Acquisition completion is separate from a later processing failure, which may overlap this total.
      sourcesChecked: sources.filter(source => source.acquisitionCompleted).length,
      sourcesFailed: failed,
      candidatesDetected: changes.length,
      candidatesClassified: changes.filter(
        (change: MonitorRunResult['changes'][number]) => change.status === 'classified',
      ).length,
      candidatesDeferred: pendingIds.length,
    },
  };
}

export function createFinalizeStep(context: StepContext) {
  const { dependencies } = context;
  return createStep({
    id: 'finalize-competitor-run',
    description: 'Aggregates source statuses and builds the grounded run report.',
    inputSchema: classifiedSourcesSchema,
    outputSchema: workflowOutputSchema,
    execute: async ({ inputData, getInitData }) => {
      const processed = inputData.processed;
      const aggregate = aggregateRun(processed, inputData.changes);
      const first = processed[0]!;
      const input = getInitData<MonitorInput>();

      const report = await buildReport({
        changes: inputData.changes,
        generateSummary: input.options.generateSummary ?? true,
        config: dependencies.config,
        store: dependencies.store,
        agent: dependencies.summaryAgent,
      });

      const summaryDegraded =
        report.summaryFailure !== undefined &&
        report.summaryFailure !== 'SUMMARY_DISABLED' &&
        report.summaryFailure !== 'SUMMARY_NOT_APPLICABLE';

      const finalStatus = aggregate.status === 'success' && summaryDegraded ? 'partial' : aggregate.status;

      const result: MonitorRunResult = {
        runId: first.runId,
        monitorId: first.monitorId,
        status: finalStatus,
        counts: aggregate.counts,
        // Presentation filtering never changes durable totals.
        sources: input.options.includeUnchangedSources
          ? aggregate.sources
          : aggregate.sources.filter(source => source.status !== 'unchanged'),
        changes: report.changes,
        report: { summary: report.summary, summaryFailure: report.summaryFailure },
      };

      return result;
    },
  });
}
