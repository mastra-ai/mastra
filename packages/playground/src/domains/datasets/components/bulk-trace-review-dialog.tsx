'use client';

import { Button, CodeEditor, Label, SideDialog, Txt, toast } from '@mastra/playground-ui';
import { ChevronLeftIcon, ChevronRightIcon, DatabaseIcon, Loader2Icon, TrashIcon } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';

export type BulkTraceItem = {
  input: string;
  groundTruth: string;
  expectedTrajectory: string;
  source?: { type: 'trace'; referenceId: string };
};

type BulkTraceReviewDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string;
  datasetName: string;
  initialItems: BulkTraceItem[];
};

export function BulkTraceReviewDialog({
  isOpen,
  onClose,
  datasetId,
  datasetName,
  initialItems,
}: BulkTraceReviewDialogProps) {
  const [items, setItems] = useState<BulkTraceItem[]>(initialItems);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { batchInsertItems } = useDatasetMutations();

  // Reset state when dialog opens with new items
  useEffect(() => {
    if (isOpen) {
      setItems(initialItems);
      setCurrentIndex(0);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset on open, not on initialItems change

  const currentItem = items[currentIndex];
  const total = items.length;

  const updateCurrentItem = useCallback(
    (field: keyof BulkTraceItem, value: string) => {
      setItems(prev => prev.map((item, i) => (i === currentIndex ? { ...item, [field]: value } : item)));
    },
    [currentIndex],
  );

  const removeCurrentItem = useCallback(() => {
    setItems(prev => {
      const next = prev.filter((_, i) => i !== currentIndex);
      if (next.length === 0) {
        onClose();
        return prev;
      }
      setCurrentIndex(idx => Math.min(idx, next.length - 1));
      return next;
    });
  }, [currentIndex, onClose]);

  const handleSubmit = async () => {
    const parsed = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      let parsedInput: unknown;
      try {
        parsedInput = JSON.parse(item.input);
      } catch {
        toast.error(`Item ${i + 1}: Input must be valid JSON`);
        setCurrentIndex(i);
        return;
      }

      let parsedGroundTruth: unknown | undefined;
      if (item.groundTruth.trim()) {
        try {
          parsedGroundTruth = JSON.parse(item.groundTruth);
        } catch {
          toast.error(`Item ${i + 1}: Ground Truth must be valid JSON`);
          setCurrentIndex(i);
          return;
        }
      }

      let parsedTrajectory: unknown | undefined;
      if (item.expectedTrajectory.trim()) {
        try {
          parsedTrajectory = JSON.parse(item.expectedTrajectory);
        } catch {
          toast.error(`Item ${i + 1}: Expected Trajectory must be valid JSON`);
          setCurrentIndex(i);
          return;
        }
      }

      parsed.push({
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        expectedTrajectory: parsedTrajectory,
        ...(item.source ? { source: item.source } : {}),
      });
    }

    try {
      await batchInsertItems.mutateAsync({ datasetId, items: parsed });
      toast.success(`Added ${parsed.length} item${parsed.length !== 1 ? 's' : ''} to "${datasetName}"`);
      onClose();
    } catch {
      toast.error('Failed to add items to dataset');
    }
  };

  if (!currentItem) return null;

  return (
    <SideDialog
      dialogTitle="Review items before adding to dataset"
      dialogDescription={`Reviewing ${total} item${total !== 1 ? 's' : ''} for dataset "${datasetName}"`}
      isOpen={isOpen}
      onClose={onClose}
      level={1}
    >
      <SideDialog.Top>
        <DatabaseIcon className="size-4" /> Review {total} item{total !== 1 ? 's' : ''} → {datasetName}
      </SideDialog.Top>

      <SideDialog.Content>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Button
              tooltip="Previous item"
              variant="outline"
              size="icon-sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(prev => prev - 1)}
            >
              <ChevronLeftIcon />
            </Button>
            <Txt variant="ui-sm" className="text-icon3 tabular-nums">
              {currentIndex + 1} / {total}
            </Txt>
            <Button
              tooltip="Next item"
              variant="outline"
              size="icon-sm"
              disabled={currentIndex === total - 1}
              onClick={() => setCurrentIndex(prev => prev + 1)}
            >
              <ChevronRightIcon />
            </Button>
          </div>

          <Button tooltip="Remove this item" variant="ghost" size="icon-sm" onClick={removeCurrentItem}>
            <TrashIcon />
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Input (JSON) *</Label>
            <CodeEditor
              value={currentItem.input}
              onChange={v => updateCurrentItem('input', v)}
              showCopyButton={false}
              className="min-h-[120px]"
            />
          </div>

          <div className="grid gap-2">
            <Label>Ground Truth (JSON, optional)</Label>
            <CodeEditor
              value={currentItem.groundTruth}
              onChange={v => updateCurrentItem('groundTruth', v)}
              showCopyButton={false}
              className="min-h-[80px]"
            />
          </div>

          <div className="grid gap-2">
            <Label>Expected Trajectory (JSON, optional)</Label>
            <CodeEditor
              value={currentItem.expectedTrajectory}
              onChange={v => updateCurrentItem('expectedTrajectory', v)}
              showCopyButton={false}
              className="min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="default" disabled={batchInsertItems.isPending} onClick={handleSubmit}>
              {batchInsertItems.isPending ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <DatabaseIcon className="size-4" />
                  Add all {total} item{total !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
}
