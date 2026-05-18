import { CodeEditor } from '@mastra/playground-ui';

interface InstructionsDetailProps {
  prompt: string;
  onChange: (prompt: string) => void;
  editable?: boolean;
}

export const InstructionsDetail = ({ prompt, onChange, editable = true }: InstructionsDetailProps) => {
  return (
    <div className="flex flex-col px-6 py-4 h-[20rem] max-h-[50vh] overflow-hidden">
      <CodeEditor
        data-testid="system-prompt-dialog-input"
        value={prompt}
        onChange={onChange}
        language="markdown"
        editable={editable}
        placeholder="You are a helpful assistant that…"
        showCopyButton={false}
        className="h-full w-full border-0 bg-transparent p-0 rounded-none overflow-auto"
      />
    </div>
  );
};
