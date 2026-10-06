import {
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  EntityHeader,
  EntityBody,
} from '@mastra/playground-ui/components/Entity';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Controller, useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';

export function LastMessagesEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const lastMessages = useWatch({ control, name: 'memory.lastMessages' });
  const lastMessagesEnabled = lastMessages !== false;

  return (
    <Entity variant="section">
      <EntityHeader>
        <EntityContent>
          <EntityName>Message History</EntityName>
          <EntityDescription>Number of recent messages to include in context</EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.lastMessages"
            control={control}
            render={({ field }) => (
              <Switch
                aria-label="Enable message history"
                checked={lastMessagesEnabled}
                onCheckedChange={checked => {
                  field.onChange(checked ? 40 : false);
                  if (checked) {
                    form.setValue('memory.observationalMemory.enabled', false, { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        )}
      </EntityHeader>

      {lastMessagesEnabled && (
        <EntityBody>
          <Field>
            <FieldLabel htmlFor="memory-last-messages">Recent messages</FieldLabel>
            <Controller
              name="memory.lastMessages"
              control={control}
              render={({ field }) => (
                <Input
                  id="memory-last-messages"
                  type="number"
                  min="1"
                  step="1"
                  value={field.value === false ? '' : (field.value ?? 40)}
                  onChange={e => {
                    const value = e.target.value;
                    field.onChange(value === '' ? false : parseInt(value, 10));
                  }}
                  placeholder="40"
                  disabled={readOnly}
                />
              )}
            />
          </Field>
        </EntityBody>
      )}
    </Entity>
  );
}
