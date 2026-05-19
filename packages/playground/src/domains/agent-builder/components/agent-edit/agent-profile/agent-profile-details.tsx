import { FieldBlock, Textarea, TextFieldBlock } from '@mastra/playground-ui';
import { useFormContext, useWatch } from 'react-hook-form';
import type { AgentBuilderEditFormValues } from '../../../schemas';

export interface AgentProfileDetailsProps {
  disabled?: boolean;
}

export const AgentProfileDetails = ({ disabled = false }: AgentProfileDetailsProps) => {
  const { setValue, control } = useFormContext<AgentBuilderEditFormValues>();
  const draftName = useWatch({ control, name: 'name' }) ?? '';
  const draftDescription = useWatch({ control, name: 'description' }) ?? '';

  const handleDraftNameChange = (value: string) => {
    if (disabled) return;
    setValue('name', value, { shouldDirty: true });
  };
  const handleDraftDescriptionChange = (value: string) => {
    if (disabled) return;
    setValue('description', value, { shouldDirty: true });
  };

  return (
    <div className="w-full space-y-2">
      <TextFieldBlock
        name="agent-name"
        label="Name"
        value={draftName}
        placeholder="Untitled agent"
        onChange={e => handleDraftNameChange(e.target.value)}
        disabled={disabled}
        testId="agent-configure-name"
      />

      <FieldBlock.Layout layout="vertical">
        <FieldBlock.Column>
          <FieldBlock.Label name="agent-description">Description</FieldBlock.Label>
          <Textarea
            name="agent-description"
            value={draftDescription}
            placeholder="What is this agent for?"
            onChange={e => handleDraftDescriptionChange(e.target.value)}
            disabled={disabled}
            testId="agent-configure-description"
          />
        </FieldBlock.Column>
      </FieldBlock.Layout>
    </div>
  );
};
