import { Entity, EntityContent, EntityName, EntityDescription } from '@mastra/playground-ui/components/Entity';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Controller } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';

export function ReadOnlyEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;

  return (
    <Entity>
      <EntityContent>
        <EntityName>Read Only</EntityName>
        <EntityDescription>Memory is read-only (no new messages stored)</EntityDescription>
      </EntityContent>

      {!readOnly && (
        <Controller
          name="memory.readOnly"
          control={control}
          render={({ field }) => <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />}
        />
      )}
    </Entity>
  );
}
