import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useState } from 'react';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

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

  const canSave = Boolean(name.trim()) && !updateExperiment.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || !experiment.datasetId) return;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Experiment</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" onClick={() => onOpenChange(false)} disabled={updateExperiment.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!canSave}>
                {updateExperiment.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
