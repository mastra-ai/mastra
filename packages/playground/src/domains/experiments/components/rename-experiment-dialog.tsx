import type { DatasetExperiment } from '@mastra/client-js';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { useDatasetMutations } from '@mastra/playground-ui/domains/datasets';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';

export interface RenameExperimentDialogProps {
  experiment: DatasetExperiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edits an experiment's name and description. Mount it on demand (`{open && ...}`)
 * so the form state is seeded from the experiment each time it opens.
 */
export function RenameExperimentDialog({ experiment, open, onOpenChange }: RenameExperimentDialogProps) {
  const [name, setName] = useState(experiment.name ?? '');
  const [description, setDescription] = useState(experiment.description ?? '');
  const { updateExperiment } = useDatasetMutations();

  const canSave = Boolean(name.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || updateExperiment.isPending || !experiment.datasetId) return;

    try {
      await updateExperiment.mutateAsync({
        datasetId: experiment.datasetId,
        experimentId: experiment.id,
        name: name.trim(),
        description: description.trim(),
      });
      toast.success('Experiment renamed');
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to rename experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={updateExperiment.isPending}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Experiment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="rename-experiment-name">Name *</Label>
              <Input
                id="rename-experiment-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter experiment name"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rename-experiment-description">Description</Label>
              <Input
                id="rename-experiment-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter experiment description (optional)"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction type="submit" disabled={!canSave}>
              {updateExperiment.isPending ? 'Saving...' : 'Save'}
            </DialogAction>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
