import { CodeEditor } from '@/ds/components/CodeEditor';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentEditFormValues } from './types';

export interface InstructionsProps {
  editable?: boolean;
  fallbackPrompt?: string;
}

export const Instructions = ({ editable = true, fallbackPrompt }: InstructionsProps) => {
  const { setValue, control } = useFormContext<AgentEditFormValues>();
  const draftInstructions = useWatch({ control, name: 'instructions' }) ?? '';
  const displayedPrompt = editable ? draftInstructions : (fallbackPrompt ?? draftInstructions);

  const handleChange = (value: string) => {
    if (!editable) return;
    setValue('instructions', value, { shouldDirty: true });
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] px-2">
      <CodeEditor
        font="body"
        data-testid="system-prompt-dialog-input"
        value={displayedPrompt}
        onChange={handleChange}
        language="markdown"
        variant="embedded"
        editable={editable}
        placeholder="You are a helpful assistant"
        showCopyButton={false}
        className="min-h-0 w-full [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-y-auto"
      />
    </div>
  );
};
