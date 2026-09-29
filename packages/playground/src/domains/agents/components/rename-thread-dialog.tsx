import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { useState } from 'react';

export interface RenameThreadDialogProps {
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => Promise<void>;
}

/**
 * Mount on demand (`{open && ...}`) so the input is seeded from the thread each time it opens.
 */
export function RenameThreadDialog({ initialTitle, onOpenChange, onRename }: RenameThreadDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [isPending, setIsPending] = useState(false);

  const trimmed = title.trim();
  const canSave = Boolean(trimmed) && trimmed !== initialTitle.trim() && !isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setIsPending(true);
    try {
      await onRename(trimmed);
      onOpenChange(false);
    } catch {
      // The caller surfaces the failure (toast); keep the dialog open so the user can retry.
      setIsPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-thread-title">Title</Label>
              <Input
                id="rename-thread-title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter a chat title"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!canSave}>
                Save
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
