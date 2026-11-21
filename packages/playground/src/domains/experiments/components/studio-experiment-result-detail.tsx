import type { ExperimentResultDetailProps } from '@mastra/playground-ui/domains/experiments';
import { ExperimentResultDetail } from '@mastra/playground-ui/domains/experiments';
import { useExperimentResultDetailData } from '../hooks/use-experiment-result-detail-data';

export type StudioExperimentResultDetailProps = Omit<
  ExperimentResultDetailProps,
  'tracePanel' | 'feedbackTabSlot' | 'feedbackCount' | 'usage' | 'isUsageLoading'
> & {
  /** Shows the Feedback tabs and fetches their feedback. */
  withFeedback: boolean;
};

/** The shared result detail with Studio's trace panel, feedback and usage, used by the review queue. */
export function StudioExperimentResultDetail({ withFeedback, ...props }: StudioExperimentResultDetailProps) {
  const data = useExperimentResultDetailData({ traceId: props.result?.traceId, scores: props.scores, withFeedback });
  return <ExperimentResultDetail {...props} {...data} />;
}
