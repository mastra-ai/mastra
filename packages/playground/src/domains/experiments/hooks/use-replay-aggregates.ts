import type { ExperimentStatus } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import type { ToolReplayCall, ToolReplayCallsSummary } from '../utils/tool-replay';
import { getToolReplayReport, summarizeReplayCalls } from '../utils/tool-replay';

/** One item's run flow, in call order — the per-item row of the experiment flow table. */
export interface ReplayItemFlow {
  resultId: string;
  itemId: string;
  outcomes: { outcome: ToolReplayCall['outcome']; argsDiffered?: boolean }[];
  hasError: boolean;
}

export interface ReplayAggregates {
  total: number;
  /** Report present with recorded events, zero misses/unconsumed/argMismatches, no error. */
  fullyGrounded: number;
  withMisses: number;
  withUnconsumed: number;
  withArgMismatches: number;
  /** Items whose report carries at least one unsatisfied tool-call expectation. */
  withFailedExpectations: number;
  /** Items failed with a TOOL_REPLAY_* error code. */
  failedReplay: number;
  /** Recordings that contained zero tool calls — nothing was replayed for these items. */
  emptyRecordings: number;
  staleRecordings: number;
  redactedPayloads: number;
  /** Call outcomes summed across every item that has a call-flow report. */
  callTotals: ToolReplayCallsSummary;
  /** Per-item run flows in result order (only items whose report carries calls). */
  itemFlows: ReplayItemFlow[];
}

const PER_PAGE = 100;

/**
 * Folds every result of a replay experiment into groundedness aggregates.
 * Paginates through all pages (mirrors useScoresByExperimentId) so the
 * summary is never silently computed on a partial window.
 */
export const useReplayAggregates = ({
  datasetId,
  experimentId,
  enabled,
  experimentStatus,
}: {
  datasetId: string;
  experimentId: string;
  enabled: boolean;
  experimentStatus?: ExperimentStatus;
}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['experiment-replay-aggregates', datasetId, experimentId, experimentStatus],
    queryFn: async (): Promise<ReplayAggregates> => {
      const aggregates: ReplayAggregates = {
        total: 0,
        fullyGrounded: 0,
        withMisses: 0,
        withUnconsumed: 0,
        withArgMismatches: 0,
        withFailedExpectations: 0,
        failedReplay: 0,
        emptyRecordings: 0,
        staleRecordings: 0,
        redactedPayloads: 0,
        callTotals: { total: 0, replayed: 0, replayedWithDrift: 0, mocked: 0, missed: 0, live: 0 },
        itemFlows: [],
      };

      let page = 0;
      while (true) {
        const response = await client.listDatasetExperimentResults(datasetId, experimentId, {
          page,
          perPage: PER_PAGE,
        });
        for (const result of response.results) {
          aggregates.total++;
          if (result.error?.code?.startsWith('TOOL_REPLAY_')) {
            aggregates.failedReplay++;
          }
          const report = getToolReplayReport(result);
          if (!report) continue;
          if (report.misses.length > 0) aggregates.withMisses++;
          if (report.unconsumed.length > 0) aggregates.withUnconsumed++;
          if (report.argMismatches.length > 0) aggregates.withArgMismatches++;
          if (report.expectations?.some(expectation => !expectation.satisfied)) aggregates.withFailedExpectations++;
          if (report.staleRecording) aggregates.staleRecordings++;
          const callsSummary = summarizeReplayCalls(report);
          if (callsSummary) {
            aggregates.callTotals.total += callsSummary.total;
            aggregates.callTotals.replayed += callsSummary.replayed;
            aggregates.callTotals.replayedWithDrift += callsSummary.replayedWithDrift;
            aggregates.callTotals.mocked += callsSummary.mocked;
            aggregates.callTotals.missed += callsSummary.missed;
            aggregates.callTotals.live += callsSummary.live;
            aggregates.itemFlows.push({
              resultId: result.id,
              itemId: result.itemId,
              outcomes: (report.calls ?? []).map(call => ({
                outcome: call.outcome,
                ...(call.argsDiffered ? { argsDiffered: true } : {}),
              })),
              hasError: Boolean(result.error),
            });
          }
          if ((report.redactedPayloadCount ?? 0) > 0) aggregates.redactedPayloads++;
          if (report.totalRecorded === 0) {
            // Nothing was on the tape — "grounded" would be vacuously true.
            aggregates.emptyRecordings++;
          } else if (
            !result.error &&
            report.misses.length === 0 &&
            report.unconsumed.length === 0 &&
            report.argMismatches.length === 0
          ) {
            aggregates.fullyGrounded++;
          }
        }
        const total = response.pagination?.total ?? 0;
        if (!response.results.length || (page + 1) * PER_PAGE >= total) break;
        page++;
      }

      return aggregates;
    },
    enabled: enabled && Boolean(datasetId) && Boolean(experimentId),
    refetchInterval: experimentStatus === 'running' || experimentStatus === 'pending' ? 2000 : false,
  });
};
