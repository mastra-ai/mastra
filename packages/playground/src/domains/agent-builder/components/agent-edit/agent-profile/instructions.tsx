import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';
import { InstructionsDetail } from '../details/instructions-detail';

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
    <InstructionsDetail
      prompt={displayedPrompt}
      onChange={value => {
        if (isEditable) setValue('instructions', value, { shouldDirty: true });
      }}
      editable={isEditable}
    />
  );
};
