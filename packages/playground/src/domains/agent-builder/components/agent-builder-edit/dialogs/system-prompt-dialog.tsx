import { Button, SideDialog, Textarea } from '@mastra/playground-ui';
import { FileTextIcon } from 'lucide-react';
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
    <SideDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      dialogTitle="Edit system prompt"
      dialogDescription="Edit the instructions that shape your agent."
      level={2}
    >
      <SideDialog.Top>
        <FileTextIcon className="size-4" /> Instructions
      </SideDialog.Top>
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <FileTextIcon /> Edit system prompt
          </SideDialog.Heading>
        </SideDialog.Header>

        <Textarea
          testId="system-prompt-dialog-input"
          size="default"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={16}
          placeholder="You are a helpful assistant that…"
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)} data-testid="system-prompt-dialog-save">
            Save
          </Button>
        </div>
      </SideDialog.Content>
    </SideDialog>
  );
};
