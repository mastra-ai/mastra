import { useUpdateThread } from '@mastra/react/hooks/memory';
import { useState } from 'react';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { Button } from '@/ds/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';
import { toast } from '@/utils/toast';

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
