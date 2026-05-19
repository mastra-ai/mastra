import { CodeEditor } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface InstructionsProps {
  /** Whether the user can edit the system prompt. */
  editable?: boolean;
  /** Fallback prompt to display when not editable. */
  fallbackPrompt?: string;
  /** Disables interaction (e.g. while a stream is running). */
  disabled?: boolean;
}

export const Instructions = ({ editable = true, fallbackPrompt, disabled = false }: InstructionsProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftInstructions = useWatch({ control, name: 'instructions' }) ?? '';

  const isEditable = editable && !disabled;
  const displayedPrompt = editable ? draftInstructions : (fallbackPrompt ?? draftInstructions);

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)] px-2 py-2">
      <CodeEditor
        data-testid="system-prompt-dialog-input"
        value={displayedPrompt}
        onChange={value => {
          if (isEditable) setValue('instructions', value, { shouldDirty: true });
        }}
        language="markdown"
        editable={editable}
        placeholder="You are a helpful assistant that…"
        showCopyButton={false}
        className="min-h-0 w-full border-0 bg-transparent p-0 rounded-none [&_.cm-editor]:h-full [&_.cm-scroller]:overflow-y-auto"
      />
    </div>
  );
};
