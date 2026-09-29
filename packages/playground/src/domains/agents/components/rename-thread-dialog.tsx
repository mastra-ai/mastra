import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { useState } from 'react';
import { useUpdateThread } from '@/domains/memory/hooks/use-memory';

export interface RenameThreadDialogProps {
  agentId: string;
  threadId: string;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Mount on demand (`{open && ...}`) so the input is seeded from the thread each time it opens.
 */
export function RenameThreadDialog({ agentId, threadId, initialTitle, onOpenChange }: RenameThreadDialogProps) {
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { mutate, isPending } = useUpdateThread(requestContext);
  const [title, setTitle] = useState(initialTitle);

  const trimmed = title.trim();
  const canSave = Boolean(trimmed) && trimmed !== initialTitle.trim() && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    // On failure the hook toasts and the dialog stays open so the user can retry.
    mutate({ threadId, agentId, title: trimmed }, { onSuccess: () => onOpenChange(false) });
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
