import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Controller } from 'react-hook-form';
import { useAgentEditFormContext } from '../../../context/agent-edit-form-context';
import { SubSectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

export function ObserverFields({ observerProvider }: { observerProvider: string }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control, setValue } = form;

  return (
    <div className="flex flex-col gap-4">
      <SubSectionHeader title="Observer" />
      <div className="grid grid-cols-2 gap-4">
        <Field className="gap-1.5">
          <FieldLabel>Provider Override</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Override the default model provider for the observer
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.observation.model.provider"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMProviders
                  value={field.value ?? ''}
                  onValueChange={v => {
                    field.onChange(v);
                    setValue('memory.observationalMemory.observation.model.name', '', { shouldDirty: true });
                  }}
                />
              </div>
            )}
          />
        </Field>

        <Field className="gap-1.5">
          <FieldLabel>Model Override</FieldLabel>
          <FieldDescription className="mt-0 text-placeholder">
            Override the default model for the observer
          </FieldDescription>
          <Controller
            name="memory.observationalMemory.observation.model.name"
            control={control}
            render={({ field }) => (
              <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                <LLMModels value={field.value ?? ''} onValueChange={field.onChange} llmId={observerProvider} />
              </div>
            )}
          />
        </Field>

        <Controller
          name="memory.observationalMemory.observation.messageTokens"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Message Tokens</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Token count of unobserved messages that triggers observation (default: 30000)
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
                placeholder="30000"
                disabled={readOnly}
              />
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.observation.maxTokensPerBatch"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Max Tokens Per Batch</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Maximum tokens per batch when observing multiple threads (default: 10000)
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
                placeholder="10000"
                disabled={readOnly}
              />
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.observation.bufferTokens"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Buffer Tokens</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Token interval for async buffering (fraction of messageTokens or absolute count, empty to use default
                0.2, set 0 to disable)
              </FieldDescription>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={field.value === false ? '0' : (field.value ?? '')}
                onChange={e => {
                  const v = e.target.value;
                  if (v === '' || v === undefined) {
                    field.onChange(undefined);
                  } else {
                    const n = parseFloat(v);
                    field.onChange(n === 0 ? false : n);
                  }
                }}
                placeholder="0.2"
                disabled={readOnly}
              />
            </Field>
          )}
        />

        <Controller
          name="memory.observationalMemory.observation.bufferActivation"
          control={control}
          render={({ field }) => (
            <Field className="gap-1.5">
              <FieldLabel>Buffer Activation</FieldLabel>
              <FieldDescription className="mt-0 text-placeholder">
                Ratio (0-1) of buffered observations to activate (default: 0.8)
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

        <Controller
          name="memory.observationalMemory.observation.blockAfter"
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
      </div>
    </div>
  );
}
