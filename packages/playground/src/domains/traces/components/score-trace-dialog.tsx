import type { GetScorerResponse } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { toast } from '@mastra/playground-ui/utils/toast';
import { GaugeIcon, InfoIcon } from 'lucide-react';
import { useState } from 'react';
import { useTriggerScorer } from '../hooks/use-trigger-scorer';

export interface ScoreTraceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traceId?: string;
  spanId?: string;
  entityType?: string;
  isTopLevelSpan?: boolean;
  scorers?: Record<string, GetScorerResponse>;
  isLoadingScorers?: boolean;
  /** Called once the scorer run has been triggered (the dialog closes itself). */
  onTriggered?: () => void;
}

/**
 * Picks a registered scorer and triggers it on the trace's anchor span. Opened from the
 * "Score trace" header action; the results land in the Scores tab.
 */
export function ScoreTraceDialog({
  open,
  onOpenChange,
  traceId,
  spanId,
  entityType,
  isTopLevelSpan,
  scorers,
  isLoadingScorers,
  onTriggered,
}: ScoreTraceDialogProps) {
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
          onSuccess: () => {
            toast.info('Scorer triggered', {
              description: 'Results will appear once scoring completes.',
            });
            onOpenChange(false);
            onTriggered?.();
          },
        },
      );
    }
  };

  const selectedScorerDescription = scorerList.find(s => s.id === selectedScorer)?.description || '';

  let body;
  if (scorers === undefined && !isLoadingScorers) {
    body = <Notice variant="destructive">Failed to load scorers.</Notice>;
  } else if (!isLoadingScorers && scorerList.length === 0) {
    body = <Notice variant="info">No eligible scorers have been defined to run.</Notice>;
  } else {
    body = (
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
          disabled={isWaiting}
        />
        {selectedScorerDescription && (
          <TextAndIcon className="text-neutral3 text-ui-sm">
            <InfoIcon /> {selectedScorerDescription}
          </TextAndIcon>
        )}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[480px] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Score trace</DialogTitle>
          <DialogDescription>Run a scorer on this trace. Results appear in the Scores tab.</DialogDescription>
        </DialogHeader>
        <DialogBody>{body}</DialogBody>
        <DialogFooter>
          <DialogCancel disabled={isPending}>Cancel</DialogCancel>
          <Button
            variant="primary"
            icon={<GaugeIcon />}
            disabled={!selectedScorer || isWaiting}
            onClick={handleStartScoring}
          >
            {isPending ? 'Starting...' : 'Start scoring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
