import { Button } from '@/ds/components/Button/Button';
import { InfoIcon } from 'lucide-react';
import { useTriggerScorer } from '@/domains/scores/hooks/use-trigger-scorer';
import { Notification } from '@/ds/components/Notification';
import { SelectField } from '@/ds/components/FormFields';
import { TextAndIcon } from '@/ds/components/Text';
import { useEffect, useState } from 'react';
import { type GetScorerResponse } from '@mastra/client-js';

export interface SpanScoringProps {
  traceId?: string;
  spanId?: string;
  entityType?: string;
  isTopLevelSpan?: boolean;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
}

export const SpanScoring = ({
  traceId,
  spanId,
  entityType,
  isTopLevelSpan,
  scorers,
  isLoadingScorers,
}: SpanScoringProps) => {
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const { mutate: triggerScorer, isPending, isSuccess } = useTriggerScorer();
  const [notificationIsVisible, setNotificationIsVisible] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      setNotificationIsVisible(true);
    }
  }, [isSuccess]);

  let scorerList = Object.entries(scorers || {})
    .map(([key, scorer]) => ({
      id: key,
      name: scorer.scorer.config.name,
      description: scorer.scorer.config.description,
      isRegistered: scorer.isRegistered,
      type: scorer.scorer.config.type,
    }))
    .filter(scorer => scorer.isRegistered);

  // Filter out Scorers with type agent if we are not scoring on a top level agent generated span
  if (entityType !== 'Agent' || !isTopLevelSpan) {
    scorerList = scorerList.filter(scorer => scorer.type !== 'agent');
  }

  const isWaiting = isPending || isLoadingScorers;

  const handleStartScoring = () => {
    if (selectedScorer) {
      setNotificationIsVisible(false);
      triggerScorer({
        scorerName: selectedScorer,
        traceId: traceId || '',
        spanId,
      });
    }
  };

  const handleScorerChange = (val: string) => {
    setSelectedScorer(val);
    setNotificationIsVisible(false);
  };

  const selectedScorerDescription = scorerList.find(s => s.name === selectedScorer)?.description || '';

  if (scorers === undefined && !isLoadingScorers) {
    return (
      <Notification isVisible={true} autoDismiss={false} type="error">
        <InfoIcon /> Failed to load scorers.
      </Notification>
    );
  }

  if (scorerList.length === 0) {
    return (
      <Notification isVisible={true} dismissible={false}>
        <InfoIcon /> No eligible scorers have been defined to run.
      </Notification>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-[3fr_1fr] gap-[1rem] items-start">
        <div className="grid gap-[0.5rem]">
          <SelectField
            name={'select-scorer'}
            placeholder="Select a scorer..."
            options={scorerList.map(scorer => ({
              label: scorer.name || scorer.id,
              value: scorer.id || scorer.name || '',
            }))}
            onValueChange={handleScorerChange}
            value={selectedScorer || ''}
            className="min-w-[20rem]"
            disabled={isWaiting}
          />
          {selectedScorerDescription && (
            <TextAndIcon className="text-neutral3">
              <InfoIcon /> {selectedScorerDescription}
            </TextAndIcon>
          )}
        </div>

        <Button disabled={!selectedScorer || isWaiting} onClick={handleStartScoring}>
          {isPending ? 'Starting...' : 'Start Scoring'}
        </Button>
      </div>

      <Notification isVisible={notificationIsVisible} className="mt-[1rem]">
        <InfoIcon /> Scorer triggered! When finished successfully, it will appear in the list below. It could take a
        moment.
      </Notification>
    </div>
  );
};
