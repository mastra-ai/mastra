import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from '@mastra/playground-ui';
import { useEffect, useState } from 'react';

interface SystemPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onSave: (prompt: string) => void;
}

export const SystemPromptDialog = ({ open, onOpenChange, prompt, onSave }: SystemPromptDialogProps) => {
  const [draft, setDraft] = useState(prompt);

  useEffect(() => {
    if (open) setDraft(prompt);
  }, [open, prompt]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[720px]">
        <DialogHeader>
          <DialogTitle>Edit system prompt</DialogTitle>
          <DialogDescription>Edit the instructions that shape your agent.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <Textarea
            testId="system-prompt-dialog-input"
            size="default"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={16}
            placeholder="You are a helpful assistant that…"
          />
        </DialogBody>
        <DialogFooter className="px-6 pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)} data-testid="system-prompt-dialog-save">
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
