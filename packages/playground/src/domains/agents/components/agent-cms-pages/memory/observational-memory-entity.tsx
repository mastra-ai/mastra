import {
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  EntityHeader,
  EntityBody,
} from '@mastra/playground-ui/components/Entity';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Controller, useWatch } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';
import { ObserverFields } from './observer-fields';
import { ReflectorFields } from './reflector-fields';
import { LLMProviders, LLMModels } from '@/domains/llm';

export function ObservationalMemoryEntity() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const observationalMemoryEnabled = useWatch({ control, name: 'memory.observationalMemory.enabled' }) ?? false;

  return (
    <Entity variant="section">
      <EntityHeader>
        <EntityContent>
          <EntityName>Observational Memory</EntityName>
          <EntityDescription>
            Automatically observe and reflect on conversations to build long-term memory
          </EntityDescription>
        </EntityContent>

        {!readOnly && (
          <Controller
            name="memory.observationalMemory.enabled"
            control={control}
            render={({ field }) => (
              <Switch
                checked={field.value ?? false}
                onCheckedChange={checked => {
                  field.onChange(checked);
                  if (checked) {
                    form.setValue('memory.lastMessages', false, { shouldDirty: true });
                  }
                }}
              />
            )}
          />
        )}
      </EntityHeader>

      {observationalMemoryEnabled && (
        <EntityBody>
          <ObservationalMemoryFields />
        </EntityBody>
      )}
    </Entity>
  );
}
function ObservationalMemoryFields() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;
  const omProvider = useWatch({ control, name: 'memory.observationalMemory.model.provider' }) ?? '';
  const observerProvider = useWatch({ control, name: 'memory.observationalMemory.observation.model.provider' }) ?? '';
  const reflectorProvider = useWatch({ control, name: 'memory.observationalMemory.reflection.model.provider' }) ?? '';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <Field className="gap-1.5">
          <FieldLabel>Provider</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Provider for the observer and reflector agents
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel>Model</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Model for the observer and reflector agents
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={omProvider} />
              </div>
            )}
          />
        </Field>

        <Controller
          name="memory.observationalMemory.scope"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Scope</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Whether observations are scoped per thread or shared across all threads for a resource. Resource scope
                is deprecated and will be removed in a future release.
              </FieldDescription>
              <Select value={field.value ?? 'thread'} onValueChange={field.onChange} disabled={readOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thread">Thread</SelectItem>
                  <SelectItem value="resource">Resource (deprecated)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.shareTokenBudget"
          control={control}
          render={({ field }) => (
            <Field disabled={readOnly} className="gap-1.5">
              <FieldLabel>Share Token Budget</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Share token budget between observation and reflection
              </FieldDescription>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </Field>
          )}
        />
      </div>

      <div className="mt-2 border-t border-border pt-4">
        <ObserverFields observerProvider={observerProvider} />
      </div>
      <div className="mt-2 border-t border-border pt-4">
        <ReflectorFields reflectorProvider={reflectorProvider} />
      </div>
    </div>
  );
}
