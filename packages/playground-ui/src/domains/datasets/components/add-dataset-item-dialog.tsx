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
import { Label } from '@/ds/components/Label';
import { useCreateDatasetItems } from '../hooks/use-dataset-items';

export type AddDatasetItemDialogProps = {
  datasetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AddDatasetItemDialog({ datasetId, open, onOpenChange }: AddDatasetItemDialogProps) {
  const [input, setInput] = useState('{}');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: createItems, isPending } = useCreateDatasetItems(datasetId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let parsedInput: unknown;
    let parsedExpectedOutput: unknown | undefined;

    try {
      parsedInput = JSON.parse(input);
    } catch {
      setError('Invalid JSON in Input field');
      return;
    }

    if (expectedOutput.trim()) {
      try {
        parsedExpectedOutput = JSON.parse(expectedOutput);
      } catch {
        setError('Invalid JSON in Expected Output field');
        return;
      }
    }

    await createItems([
      {
        input: parsedInput,
        expectedOutput: parsedExpectedOutput,
      },
    ]);

    onOpenChange(false);
    setInput('{}');
    setExpectedOutput('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Dataset Item</DialogTitle>
          <DialogDescription>Add a new item to the dataset.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="input">Input (JSON)</Label>
              <textarea
                id="input"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder='{"prompt": "Hello"}'
                className="w-full h-24 px-3 py-2 text-sm font-mono bg-surface2 border border-border1 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-accent1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedOutput">Expected Output (JSON, optional)</Label>
              <textarea
                id="expectedOutput"
                value={expectedOutput}
                onChange={e => setExpectedOutput(e.target.value)}
                placeholder='{"response": "Hi there!"}'
                className="w-full h-24 px-3 py-2 text-sm font-mono bg-surface2 border border-border1 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-accent1"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
