import type { ClientScoreRowData } from '@mastra/client-js';
import type { ExperimentResultDetailProps } from '@mastra/playground-ui/domains/experiments';
import { TraceFeedbackTab } from '@mastra/playground-ui/domains/traces/components/trace-feedback-tab';
import { useTraceFeedback } from '@mastra/react/hooks/traces';
import { ExperimentResultTracePanel } from '../components/experiment-result-trace-panel';
import { useExperimentResultUsage } from './use-experiment-result-usage';

type ExperimentResultDetailData = Pick<
  ExperimentResultDetailProps,
  'tracePanel' | 'feedbackTabSlot' | 'feedbackCount' | 'usage' | 'isUsageLoading'
>;

/** Studio's data for `ExperimentResultDetail`: trace panel, feedback tab and count, and usage of the result's trace. */
export function useExperimentResultDetailData({
  traceId,
  scores,
  withFeedback,
}: {
  traceId: string | null | undefined;
  scores: ClientScoreRowData[] | undefined;
  withFeedback: boolean;
}): ExperimentResultDetailData {
  const feedbackTraceId = withFeedback ? (traceId ?? undefined) : undefined;
  // Fetched as soon as the panel opens so the tab can flag feedback still needing review.
  const { data: resultFeedback } = useTraceFeedback({
    traceId: feedbackTraceId,
    queryOptions: { enabled: !!feedbackTraceId },
  });
  const { usage, isLoading: isUsageLoading } = useExperimentResultUsage(traceId);

  return {
    tracePanel: state => <ExperimentResultTracePanel state={state} scores={scores} withFeedback={withFeedback} />,
    feedbackTabSlot: withFeedback
      ? ({ traceId: feedbackTabTraceId }) => <TraceFeedbackTab key={feedbackTabTraceId} traceId={feedbackTabTraceId} />
      : undefined,
    feedbackCount: resultFeedback?.pagination?.total ?? undefined,
    usage,
    isUsageLoading,
  };
}
