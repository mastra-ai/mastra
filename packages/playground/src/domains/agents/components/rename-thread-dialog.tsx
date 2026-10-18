import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Form } from '@mastra/playground-ui/components/Form';
import { Input } from '@mastra/playground-ui/components/Input';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useUpdateThread } from '@mastra/react/hooks/memory';
import { useState } from 'react';

export interface RenameThreadDialogProps {
  agentId: string;
  threadId: string;
  initialTitle: string;
  onOpenChange: (open: boolean) => void;
}

export function RenameThreadDialog({ agentId, threadId, initialTitle, onOpenChange }: RenameThreadDialogProps) {
  const [requestContext] = useEntityRequestContext('agent', agentId);
  const { mutate, isPending } = useUpdateThread(requestContext);
  const [title, setTitle] = useState(initialTitle);

  const trimmed = title.trim();
  const canSave = Boolean(trimmed) && trimmed !== initialTitle.trim() && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    mutate(
      { threadId, agentId, title: trimmed },
      {
        onSuccess: () => {
          toast.success('Chat renamed');
          onOpenChange(false);
        },
        onError: () => toast.error('Failed to rename chat'),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rename thread</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Form onSubmit={handleSubmit}>
            <Field>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Enter a chat title"
                autoFocus
              />
            </Field>

            <div className="flex justify-end gap-2">
              <Button type="button" onClick={() => onOpenChange(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={!canSave}>
                Save
              </Button>
            </div>
          </Form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
