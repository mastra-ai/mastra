'use client';

import { useState, useEffect } from 'react';
import { useMastraClient } from '@mastra/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface DuplicateDatasetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceDatasetId: string;
  sourceDatasetName: string;
  sourceDatasetDescription?: string;
  onSuccess?: (datasetId: string) => void;
}

export function DuplicateDatasetDialog({
  open,
  onOpenChange,
  sourceDatasetId,
  sourceDatasetName,
  sourceDatasetDescription,
  onSuccess,
}: DuplicateDatasetDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [progress, setProgress] = useState({
    phase: 'idle' as 'idle' | 'fetching' | 'creating' | 'copying',
    current: 0,
    total: 0,
  });

  const client = useMastraClient();
  const { createDataset, addItem } = useDatasetMutations();

  // Pre-populate name when dialog opens
  useEffect(() => {
    if (open) {
      setName(`${sourceDatasetName} (Copy)`);
      setDescription(sourceDatasetDescription || '');
    }
  }, [open, sourceDatasetName, sourceDatasetDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Dataset name is required');
      return;
    }

    setIsDuplicating(true);
    setProgress({ phase: 'fetching', current: 0, total: 0 });

    try {
      // Fetch all items from source dataset
      const allItems: Array<{ input: unknown; groundTruth?: unknown; metadata?: Record<string, unknown> }> = [];
      let page = 0;
      const perPage = 100;
      let hasMore = true;

      while (hasMore) {
        const response = await client.listDatasetItems(sourceDatasetId, { page, perPage });
        const items = response.items || [];
        allItems.push(
          ...items.map(item => ({
            input: item.input,
            groundTruth: item.groundTruth,
            metadata: item.metadata as Record<string, unknown> | undefined,
          })),
        );

        setProgress({
          phase: 'fetching',
          current: allItems.length,
          total: response.pagination?.total || allItems.length,
        });

        const totalFetched = (page + 1) * perPage;
        hasMore = items.length > 0 && totalFetched < (response.pagination?.total || 0);
        page++;
      }

      // Create the new dataset
      setProgress({ phase: 'creating', current: 0, total: allItems.length });
      const dataset = await createDataset.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
      });

      // Copy items to new dataset
      setProgress({ phase: 'copying', current: 0, total: allItems.length });
      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        await addItem.mutateAsync({
          datasetId: dataset.id,
          input: item.input,
          groundTruth: item.groundTruth,
          metadata: item.metadata,
        });
        setProgress({ phase: 'copying', current: i + 1, total: allItems.length });
      }

      toast.success(`Dataset duplicated with ${allItems.length} items`);

      // Reset form
      setName('');
      setDescription('');
      setIsDuplicating(false);
      setProgress({ phase: 'idle', current: 0, total: 0 });
      onOpenChange(false);

      // Navigate to new dataset
      onSuccess?.(dataset.id);
    } catch (error) {
      toast.error(`Failed to duplicate dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsDuplicating(false);
      setProgress({ phase: 'idle', current: 0, total: 0 });
    }
  };

  const handleCancel = () => {
    if (isDuplicating) return; // Prevent cancel during duplication
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  const getProgressText = () => {
    switch (progress.phase) {
      case 'fetching':
        return `Fetching items: ${progress.current}${progress.total > 0 ? ` / ${progress.total}` : ''}`;
      case 'creating':
        return 'Creating dataset...';
      case 'copying':
        return `Copying items: ${progress.current} / ${progress.total}`;
      default:
        return '';
    }
  };

  const progressPercent = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={isDuplicating ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate Dataset</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dataset-name">Name *</Label>
              <Input
                id="dataset-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter dataset name"
                autoFocus
                disabled={isDuplicating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataset-description">Description</Label>
              <Input
                id="dataset-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter dataset description (optional)"
                disabled={isDuplicating}
              />
            </div>

            <p className="text-sm text-muted-foreground">
              All items from &quot;{sourceDatasetName}&quot; will be copied to the new dataset
            </p>

            {isDuplicating && (
              <div className="space-y-2">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">{getProgressText()}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="standard" size="default" onClick={handleCancel} disabled={isDuplicating}>
                Cancel
              </Button>
              <Button type="submit" variant="cta" size="default" disabled={isDuplicating || !name.trim()}>
                {isDuplicating ? 'Duplicating...' : 'Duplicate Dataset'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
