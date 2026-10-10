import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Controller } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';
import { SubSectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

export function ReflectorFields({ reflectorProvider }: { reflectorProvider: string }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;

  return (
    <div className="flex flex-col gap-4">
      <SubSectionHeader title="Reflector" />
      <div className="grid grid-cols-2 gap-4">
        <Field className="gap-1.5">
          <FieldLabel>Provider Override</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Override the default model provider for the reflector
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.reflection.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.reflection.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel>Model Override</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Override the default model for the reflector
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.reflection.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={reflectorProvider} />
              </div>
            )}
          />
        </Field>

        <Controller
          name="memory.observationalMemory.reflection.observationTokens"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Observation Tokens</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Token count of observations that triggers reflection (default: 40000)
              </FieldDescription>
              <Input
                type="number"
                min="1"
                step="1"
                value={field.value ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  field.onChange(v === '' ? undefined : parseInt(v, 10));
                }}
                placeholder="40000"
                disabled={readOnly}
              />
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.reflection.blockAfter"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Block After</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Multiplier or absolute token count for synchronous blocking (default: 1.2)
              </FieldDescription>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={field.value ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  field.onChange(v === '' ? undefined : parseFloat(v));
                }}
                placeholder="1.2"
                disabled={readOnly}
              />
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.reflection.bufferActivation"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Buffer Activation</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Ratio (0-1) controlling when async reflection buffering starts
              </FieldDescription>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.1"
                value={field.value ?? ''}
                onChange={e => {
                  const v = e.target.value;
                  field.onChange(v === '' ? undefined : parseFloat(v));
                }}
                placeholder="0.8"
                disabled={readOnly}
              />
            </Field>
          )}
        />
      </div>
    </div>
  );
}
