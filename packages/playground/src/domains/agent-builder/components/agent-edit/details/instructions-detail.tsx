import { CodeEditor } from '@mastra/playground-ui';

interface InstructionsDetailProps {
  prompt: string;
  onChange: (prompt: string) => void;
  editable?: boolean;
}

export const InstructionsDetail = ({ prompt, onChange, editable = true }: InstructionsDetailProps) => {
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] px-2 py-2">
      <CodeEditor
        data-testid="system-prompt-dialog-input"
        value={prompt}
        onChange={onChange}
        language="markdown"
        editable={editable}
        placeholder="You are a helpful assistant that…"
        showCopyButton={false}
        className="min-h-0 w-full border-0 bg-transparent p-0 rounded-none [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-y-auto"
      />
    </div>
  );
};
