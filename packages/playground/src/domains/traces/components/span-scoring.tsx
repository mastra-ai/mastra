import type { GetScorerResponse } from '@mastra/client-js';
import { Button, Notice, SelectFieldBlock, TextAndIcon, toast } from '@mastra/playground-ui';
import { InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { useTriggerScorer } from '../hooks/use-trigger-scorer';

export interface SpanScoringProps {
  traceId?: string;
  spanId?: string;
  entityType?: string;
  isTopLevelSpan?: boolean;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
}

export function SpanScoring({
  traceId,
  spanId,
  entityType,
  isTopLevelSpan,
  scorers,
  isLoadingScorers,
}: SpanScoringProps) {
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const { mutate: triggerScorer, isPending } = useTriggerScorer();

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
    if (selectedScorer && traceId) {
      triggerScorer(
        { scorerName: selectedScorer, traceId, spanId },
        {
          onSuccess: () =>
            toast.info('Scorer triggered', {
              description: 'Results will appear once scoring completes.',
            }),
        },
      );
    }
  };

  const selectedScorerDescription = scorerList.find(s => s.id === selectedScorer)?.description || '';

  if (scorers === undefined && !isLoadingScorers) {
    return <Notice variant="destructive">Failed to load scorers.</Notice>;
  }

  if (!isLoadingScorers && scorerList.length === 0) {
    return <Notice variant="info">No eligible scorers have been defined to run.</Notice>;
  }

  return (
    <div className="grid grid-cols-[3fr_1fr] gap-4 items-start">
      <div className="grid gap-2">
        <SelectFieldBlock
          name="select-scorer"
          label="Select scorer"
          labelIsHidden={true}
          placeholder="Select a scorer..."
          options={scorerList.map(scorer => ({
            label: scorer.name || scorer.id,
            value: scorer.id || scorer.name || '',
          }))}
          onValueChange={setSelectedScorer}
          value={selectedScorer || ''}
          className="min-w-80"
          disabled={isWaiting}
        />
        {selectedScorerDescription && (
          <TextAndIcon className="text-neutral3 text-ui-sm">
            <InfoIcon /> {selectedScorerDescription}
          </TextAndIcon>
        )}
      </div>

      <Button disabled={!selectedScorer || isWaiting} onClick={handleStartScoring}>
        {isPending ? 'Starting...' : 'Start Scoring'}
      </Button>
    </div>
  );
}
