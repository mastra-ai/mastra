import type { ExperimentResultDetailProps as SharedExperimentResultDetailProps } from '@mastra/playground-ui/domains/experiments';
import { ExperimentResultDetail as SharedExperimentResultDetail } from '@mastra/playground-ui/domains/experiments';
import { useExperimentResultDetailData } from '../hooks/use-experiment-result-detail-data';

export type ExperimentResultDetailProps = Omit<
  SharedExperimentResultDetailProps,
  'tracePanel' | 'feedbackTabSlot' | 'feedbackCount' | 'usage' | 'isUsageLoading'
> & {
  /** Shows the Feedback tabs and fetches their feedback. */
  withFeedback: boolean;
};

/** The shared result detail with Studio's trace panel, feedback and usage, used by the review queue. */
export function ExperimentResultDetail({ withFeedback, ...props }: ExperimentResultDetailProps) {
  const data = useExperimentResultDetailData({ traceId: props.result?.traceId, scores: props.scores, withFeedback });
  return <SharedExperimentResultDetail {...props} {...data} />;
}
