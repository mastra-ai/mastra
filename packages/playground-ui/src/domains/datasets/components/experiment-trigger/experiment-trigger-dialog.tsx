import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { TargetSelector, TargetType } from './target-selector';
import { ScorerSelector } from './scorer-selector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { toast } from 'sonner';

export interface ExperimentTriggerDialogProps {
  datasetId: string;
  version?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

export function ExperimentTriggerDialog({
  datasetId,
  version,
  open,
  onOpenChange,
  onSuccess,
}: ExperimentTriggerDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [targetType, setTargetType] = useState<TargetType | ''>('');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);

  const { triggerExperiment } = useDatasetMutations();

  const canRun = targetType && targetId;
  const isRunning = triggerExperiment.isPending;

  const handleRun = async () => {
    if (!canRun) return;

    try {
      const result = await triggerExperiment.mutateAsync({
        datasetId,
        targetType,
        targetId,
        scorerIds: selectedScorers.length > 0 ? selectedScorers : undefined,
        version,
      });

      toast.success('Experiment triggered successfully');
      onOpenChange(false);
      onSuccess?.(result.experimentId);

      // Reset state
      setTargetType('');
      setTargetId('');
      setSelectedScorers([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger experiment';
      toast.error(message);
    }
  };

  const handleClose = () => {
    if (!isRunning) {
      onOpenChange(false);
      // Reset state on close
      setTargetType('');
      setTargetId('');
      setSelectedScorers([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent ref={contentRef}>
        <DialogHeader>
          <DialogTitle>Run Experiment</DialogTitle>
          <DialogDescription>
            {version
              ? `Execute items from ${format(new Date(version), 'MMM d, yyyy')} version against a target.`
              : 'Execute all items in this dataset against a target.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6">
          <TargetSelector
            targetType={targetType}
            setTargetType={setTargetType}
            targetId={targetId}
            setTargetId={setTargetId}
            container={contentRef}
          />

          {/* Only show scorer selector for agent/workflow targets */}
          {targetType && targetType !== 'scorer' && (
            <ScorerSelector
              selectedScorers={selectedScorers}
              setSelectedScorers={setSelectedScorers}
              disabled={isRunning}
              container={contentRef}
            />
          )}
        </DialogBody>

        <DialogFooter className="px-6 pt-4">
          <Button variant="standard" size="default" onClick={handleClose} disabled={isRunning}>
            Cancel
          </Button>
          <Button variant="cta" size="default" onClick={handleRun} disabled={!canRun || isRunning}>
            {isRunning ? (
              <>
                <Spinner className="w-4 h-4" />
                Running...
              </>
            ) : (
              'Run'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
