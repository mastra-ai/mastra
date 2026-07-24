import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface InstructionsProps {
  editable?: boolean;
  fallbackPrompt?: string;
}

export const Instructions = ({ editable = true, fallbackPrompt }: InstructionsProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftInstructions = useWatch({ control, name: 'instructions' }) ?? '';
  const displayedPrompt = editable ? draftInstructions : (fallbackPrompt ?? draftInstructions);

  const handleChange = (value: string) => {
    if (!editable) return;
    setValue('instructions', value, { shouldDirty: true });
  };

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] px-2">
      <CodeEditor
        data-testid="system-prompt-dialog-input"
        value={displayedPrompt}
        onChange={handleChange}
        language="markdown"
        editable={editable}
        placeholder="You are a helpful assistant that…"
        showCopyButton={false}
        className="min-h-0 w-full border-0 bg-transparent p-0 rounded-none [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-y-auto [&_.cm-scroller]:!font-sans [&_.cm-line]:leading-relaxed"
      />
    </div>
  );
};
