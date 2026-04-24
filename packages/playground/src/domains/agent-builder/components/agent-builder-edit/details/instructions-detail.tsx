import { Button, IconButton, Textarea, Txt } from '@mastra/playground-ui';
import { FileTextIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InstructionsDetailProps {
  prompt: string;
  onSave: (prompt: string) => void;
  onClose: () => void;
  editable?: boolean;
}

export const InstructionsDetail = ({ prompt, onSave, onClose, editable = true }: InstructionsDetailProps) => {
  const [draft, setDraft] = useState(prompt);

  useEffect(() => {
    setDraft(prompt);
  }, [prompt]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <FileTextIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Instructions
          </Txt>
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="instructions-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 flex flex-col gap-3 px-6 py-4 overflow-y-auto">
        <Textarea
          testId="system-prompt-dialog-input"
          size="default"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          rows={16}
          placeholder="You are a helpful assistant that…"
          readOnly={!editable}
        />
      </div>

      {editable && (
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)} data-testid="system-prompt-dialog-save">
            Save
          </Button>
        </div>
      )}
    </div>
  );
};
