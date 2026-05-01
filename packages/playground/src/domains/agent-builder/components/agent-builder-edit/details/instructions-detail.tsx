import { Button, CodeEditor, Txt } from '@mastra/playground-ui';
import { FileTextIcon, XIcon } from 'lucide-react';

interface InstructionsDetailProps {
  prompt: string;
  onChange: (prompt: string) => void;
  onClose: () => void;
  editable?: boolean;
}

export const InstructionsDetail = ({ prompt, onChange, onClose, editable = true }: InstructionsDetailProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <FileTextIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Instructions
          </Txt>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          tooltip="Close"
          className="rounded-full"
          onClick={onClose}
          data-testid="instructions-detail-close"
        >
          <XIcon />
        </Button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col px-6 py-4">
        <CodeEditor
          data-testid="system-prompt-dialog-input"
          value={prompt}
          onChange={onChange}
          language="markdown"
          editable={editable}
          placeholder="You are a helpful assistant that…"
          showCopyButton={false}
          className="h-full w-full border-0 bg-transparent p-0 rounded-none"
        />
      </div>
    </div>
  );
};
