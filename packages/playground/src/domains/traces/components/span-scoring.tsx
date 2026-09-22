import type { GetScorerResponse } from '@mastra/client-js';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import {
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogDescription,
  DialogFooter,
} from '@mastra/playground-ui/components/Dialog';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { toast } from '@mastra/playground-ui/utils/toast';
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
  onSuccess?: () => void;
}

export function SpanScoring({
  traceId,
  spanId,
  entityType,
  isTopLevelSpan,
  scorers,
  isLoadingScorers,
  onSuccess,
}: SpanScoringProps) {
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const { mutate: triggerScorer, isPending } = useTriggerScorer();

  let scorerList = Object.entries(scorers || {}).flatMap(([key, scorer]) =>
    scorer
      ? [
          {
            id: key,
            name: scorer.scorer.config.name,
            description: scorer.scorer.config.description,
            isRegistered: scorer.isRegistered,
            type: scorer.scorer.config.type,
          },
        ]
      : [],
  );
  scorerList = scorerList.filter(scorer => scorer.isRegistered);

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
          onSuccess: () => {
            toast.info('Scorer triggered', {
              description: 'Results will appear once scoring completes.',
            });
            onSuccess?.();
          },
        },
      );
    }
  };

  const selectedScorerDescription = scorerList.find(s => s.id === selectedScorer)?.description || '';

  if (scorers === undefined && !isLoadingScorers) {
    return (
      <>
        <DialogBody>
          <Notice variant="destructive">Failed to load scorers.</Notice>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
        </DialogFooter>
      </>
    );
  }

  if (!isLoadingScorers && scorerList.length === 0) {
    return (
      <>
        <DialogBody>
          <Notice variant="info">No eligible scorers have been defined to run.</Notice>
        </DialogBody>
        <DialogFooter>
          <DialogCancel>Cancel</DialogCancel>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogBody>
        <DialogDescription>Select a scorer to evaluate this trace.</DialogDescription>
        <Combobox
          aria-label="Select scorer"
          searchPlaceholder="Search scorers..."
          placeholder="Select a scorer..."
          options={scorerList.map(scorer => ({
            label: scorer.name || scorer.id,
            value: scorer.id || scorer.name || '',
          }))}
          onValueChange={setSelectedScorer}
          value={selectedScorer || ''}
          className="w-full"
          disabled={isWaiting}
        />
        {selectedScorerDescription && (
          <TextAndIcon className="text-muted-foreground text-caption">
            <InfoIcon /> {selectedScorerDescription}
          </TextAndIcon>
        )}
      </DialogBody>
      <DialogFooter>
        <DialogCancel disabled={isPending}>Cancel</DialogCancel>
        <DialogAction disabled={!selectedScorer || isWaiting} onConfirm={handleStartScoring}>
          {isPending ? 'Starting...' : 'Start Scoring'}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
