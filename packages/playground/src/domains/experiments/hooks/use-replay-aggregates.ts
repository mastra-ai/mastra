import type { ExperimentStatus } from '@mastra/core/storage';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { getToolReplayReport } from '../utils/tool-replay';

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
