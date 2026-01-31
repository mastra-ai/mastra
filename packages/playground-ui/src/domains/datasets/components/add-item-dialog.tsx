'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../hooks/use-dataset-mutations';

export interface AddItemDialogProps {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddItemDialog({ datasetId, open, onOpenChange, onSuccess }: AddItemDialogProps) {
  const [input, setInput] = useState('{}');
  const [expectedOutput, setExpectedOutput] = useState('');
  const { addItem } = useDatasetMutations();

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
      await addItem.mutateAsync({
        datasetId,
        input: parsedInput,
        expectedOutput: parsedExpectedOutput,
      });

      toast.success('Item added successfully');

      // Reset form
      setInput('{}');
      setExpectedOutput('');
      onOpenChange(false);

      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to add item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    setInput('{}');
    setExpectedOutput('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="item-input">Input (JSON) *</Label>
              <CodeEditor value={input} onChange={setInput} showCopyButton={false} className="min-h-[120px]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-expected-output">Expected Output (JSON, optional)</Label>
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
              <Button type="submit" variant="light" disabled={addItem.isPending}>
                {addItem.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
