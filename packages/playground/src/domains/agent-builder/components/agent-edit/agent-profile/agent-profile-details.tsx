import { FieldBlock, Textarea, TextFieldBlock } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface AgentProfileDetailsProps {
  /** Fallback name shown when not editable. */
  fallbackName?: string;
  /** Fallback description shown when not editable. */
  fallbackDescription?: string;
  editable?: boolean;
  /** Disables interaction (e.g. while a stream is running). */
  disabled?: boolean;
}

export const AgentProfileDetails = ({
  fallbackName,
  fallbackDescription,
  editable = true,
  disabled = false,
}: AgentProfileDetailsProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftName = useWatch({ control, name: 'name' }) ?? '';
  const draftDescription = useWatch({ control, name: 'description' }) ?? '';

  const isDisabled = disabled || !editable;
  const displayedName = editable ? draftName : (fallbackName ?? draftName);
  const displayedDescription = editable ? draftDescription : (fallbackDescription ?? draftDescription);

  const setDraftName = (value: string) => {
    if (!isDisabled) setValue('name', value, { shouldDirty: true });
  };
  const setDraftDescription = (value: string) => {
    if (!isDisabled) setValue('description', value, { shouldDirty: true });
  };

  return (
    <div className="w-full space-y-2">
      <TextFieldBlock
        name="agent-name"
        label="Name"
        value={displayedName}
        placeholder="Untitled agent"
        onChange={e => setDraftName(e.target.value)}
        disabled={isDisabled}
        testId="agent-configure-name"
      />

      <FieldBlock.Layout layout="vertical">
        <FieldBlock.Column>
          <FieldBlock.Label name="agent-description">Description</FieldBlock.Label>
          <Textarea
            name="agent-description"
            value={displayedDescription}
            placeholder="What is this agent for?"
            onChange={e => setDraftDescription(e.target.value)}
            disabled={isDisabled}
            testId="agent-configure-description"
          />
        </FieldBlock.Column>
      </FieldBlock.Layout>
    </div>
  );
};
