import { useState } from 'react';
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

export interface RunTriggerDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (runId: string) => void;
}

export function RunTriggerDialog({ datasetId, open, onOpenChange, onSuccess }: RunTriggerDialogProps) {
  const [targetType, setTargetType] = useState<TargetType | ''>('');
  const [targetId, setTargetId] = useState<string>('');
  const [selectedScorers, setSelectedScorers] = useState<string[]>([]);

  const { triggerRun } = useDatasetMutations();

  const canRun = targetType && targetId;
  const isRunning = triggerRun.isPending;

  const handleRun = async () => {
    if (!canRun) return;

    try {
      const result = await triggerRun.mutateAsync({
        datasetId,
        targetType,
        targetId,
        scorerIds: selectedScorers.length > 0 ? selectedScorers : undefined,
      });

      toast.success('Run triggered successfully');
      onOpenChange(false);
      // API returns runId, not id (RunSummary type)
      onSuccess?.((result as unknown as { runId: string }).runId);

      // Reset state
      setTargetType('');
      setTargetId('');
      setSelectedScorers([]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to trigger run';
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run Dataset</DialogTitle>
          <DialogDescription>Execute all items in this dataset against a target.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6">
          <TargetSelector
            targetType={targetType}
            setTargetType={setTargetType}
            targetId={targetId}
            setTargetId={setTargetId}
          />

          {/* Only show scorer selector for agent/workflow targets */}
          {targetType && targetType !== 'scorer' && (
            <ScorerSelector
              selectedScorers={selectedScorers}
              setSelectedScorers={setSelectedScorers}
              disabled={isRunning}
            />
          )}
        </DialogBody>

        <DialogFooter className="px-6 pt-4">
          <Button variant="ghost" onClick={handleClose} disabled={isRunning}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleRun} disabled={!canRun || isRunning}>
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
