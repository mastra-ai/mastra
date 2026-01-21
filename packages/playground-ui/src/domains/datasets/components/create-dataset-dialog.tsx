import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogTitle,
  DialogDescription,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { useCreateDataset } from '../hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';

export type CreateDatasetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateDatasetDialog({ open, onOpenChange }: CreateDatasetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { mutateAsync: createDataset, isPending } = useCreateDataset();
  const { navigate, paths } = useLinkComponent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const result = await createDataset({ name: name.trim(), description: description.trim() || undefined });
    if (result?.dataset) {
      onOpenChange(false);
      setName('');
      setDescription('');
      navigate(paths.datasetLink(result.dataset.id));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Dataset</DialogTitle>
          <DialogDescription>Create a new dataset to store evaluation data.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Dataset"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A description of this dataset"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || isPending}>
                {isPending ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
