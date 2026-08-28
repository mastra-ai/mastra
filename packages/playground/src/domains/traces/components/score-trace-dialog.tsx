import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@mastra/playground-ui/components/Dialog';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { toast } from '@mastra/playground-ui/utils/toast';
import { CircleGaugeIcon, InfoIcon } from 'lucide-react';
import { useState } from 'react';

import { useTriggerScorer } from '../hooks/use-trigger-scorer';
import { useScorers } from '@/domains/scores';

export interface ScoreTraceDialogProps {
  traceId: string;
  spanId?: string;
  /** Agent scorers only make sense on the top level span of an agent run. */
  isTopLevelSpan?: boolean;
  entityType?: string;
  /** Called once the run is queued, so the caller can reveal the scores in progress. */
  onScoringStarted?: () => void;
  /** The trigger's look and size, so it can sit in a panel header or beside a disclosure. */
  variant?: 'default' | 'ghost';
  size?: 'sm' | 'md';
}

/**
 * Starts a scorer run for a trace. Lives in the trace header: picking a scorer is a
 * one-off action, not something worth a permanent slot in the scores view.
 */
export function ScoreTraceDialog({
  traceId,
  spanId,
  isTopLevelSpan,
  entityType,
  onScoringStarted,
  variant = 'default',
  size = 'md',
}: ScoreTraceDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedScorer, setSelectedScorer] = useState<string | null>(null);
  const { data: scorers, isLoading: isLoadingScorers } = useScorers();
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

  if (entityType !== 'Agent' || !isTopLevelSpan) {
    scorerList = scorerList.filter(scorer => scorer.type !== 'agent');
  }

  const isWaiting = isPending || isLoadingScorers;
  const selectedScorerDescription = scorerList.find(s => s.id === selectedScorer)?.description || '';

  const handleStartScoring = () => {
    if (!selectedScorer) return;

    triggerScorer(
      { scorerName: selectedScorer, traceId, spanId },
      {
        onSuccess: () => {
          toast.info('Scorer triggered', { description: 'Results will appear once scoring completes.' });
          setOpen(false);
          onScoringStarted?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant={variant}>
          <CircleGaugeIcon />
          Score trace
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Score this trace</DialogTitle>
        </DialogHeader>

        <DialogBody className="grid gap-3">
          <p className="text-neutral3 text-ui-md">
            Scoring runs the selected scorer against this trace. It runs in the background, and the results show up in
            the Scorers tab once it completes.
          </p>

          {scorers === undefined && !isLoadingScorers ? (
            <Notice variant="destructive">Failed to load scorers.</Notice>
          ) : !isLoadingScorers && scorerList.length === 0 ? (
            <Notice variant="info">No eligible scorers have been defined to run.</Notice>
          ) : (
            <>
              <SelectFieldBlock
                name="select-scorer"
                label="Select scorer"
                labelIsHidden
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
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="default" disabled={!selectedScorer || isWaiting} onClick={handleStartScoring}>
            {isPending ? 'Starting...' : 'Start scoring'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
