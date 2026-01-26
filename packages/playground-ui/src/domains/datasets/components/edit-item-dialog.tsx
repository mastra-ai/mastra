'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface EditItemDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    input: unknown;
    expectedOutput?: unknown;
  };
  onSuccess?: () => void;
}

export function EditItemDialog({ datasetId, open, onOpenChange, item, onSuccess }: EditItemDialogProps) {
  const [input, setInput] = useState(() => JSON.stringify(item.input, null, 2));
  const [expectedOutput, setExpectedOutput] = useState(() =>
    item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : ''
  );
  const { updateItem } = useDatasetMutations();

  // Sync form state when item prop changes
  useEffect(() => {
    setInput(JSON.stringify(item.input, null, 2));
    setExpectedOutput(item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '');
  }, [item.id, item.input, item.expectedOutput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Parse and validate input JSON
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(input);
    } catch {
      toast.error('Input must be valid JSON');
      return;
    }

    // Parse expectedOutput if provided
    let parsedExpectedOutput: unknown | undefined;
    if (expectedOutput.trim()) {
      try {
        parsedExpectedOutput = JSON.parse(expectedOutput);
      } catch {
        toast.error('Expected Output must be valid JSON');
        return;
      }
    }

    try {
      await updateItem.mutateAsync({
        datasetId,
        itemId: item.id,
        input: parsedInput,
        expectedOutput: parsedExpectedOutput,
      });

      toast.success('Item updated successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setInput(JSON.stringify(item.input, null, 2));
    setExpectedOutput(item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-item-input">Input (JSON) *</Label>
              <CodeEditor
                value={input}
                onChange={setInput}
                showCopyButton={false}
                className="min-h-[120px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-item-expected-output">Expected Output (JSON, optional)</Label>
              <CodeEditor
                value={expectedOutput}
                onChange={setExpectedOutput}
                showCopyButton={false}
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" variant="light" disabled={updateItem.isPending}>
                {updateItem.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
