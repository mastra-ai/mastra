import { Controller, useWatch } from 'react-hook-form';

import { SectionHeader } from '@/domains/cms';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { Label } from '@/ds/components/Label';
import { Input } from '@/ds/components/Input';
import { Switch } from '@/ds/components/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Entity, EntityContent, EntityName, EntityDescription } from '@/ds/components/Entity';
import { EmptyState } from '@/ds/components/EmptyState';
import { ProcessorIcon } from '@/ds/icons/ProcessorIcon';
import { useProcessorProviders } from '@/domains/processor-providers/hooks/use-processor-providers';
import { useProcessorProvider } from '@/domains/processor-providers/hooks/use-processor-provider';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

const PHASE_LABELS: Record<string, string> = {
  processInput: 'Process Input',
  processInputStep: 'Process Input Step',
  processOutputStream: 'Process Output Stream',
  processOutputResult: 'Process Output Result',
  processOutputStep: 'Process Output Step',
};

export function ProcessorsPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const { data, isLoading } = useProcessorProviders();
  const providers = data?.providers ?? [];
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6">
        <SectionHeader
          title="Preprocessors"
          subtitle="Attach processor providers to transform inputs and outputs for this agent."
        />

        {!isLoading && providers.length === 0 && (
          <div className="py-12">
            <EmptyState
              iconSlot={<ProcessorIcon height={40} width={40} />}
              titleSlot="No processor providers registered"
              descriptionSlot="Register processor providers in your Mastra configuration to attach them to agents."
            />
          </div>
        )}

        {providers.length > 0 && (
          <div className="flex flex-col gap-2">
            {providers.map(provider => (
              <ProcessorProviderEntity
                key={provider.id}
                providerId={provider.id}
                name={provider.name}
                description={provider.description}
                availablePhases={provider.availablePhases}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function ProcessorProviderEntity({
  providerId,
  name,
  description,
  availablePhases,
}: {
  providerId: string;
  name: string;
  description?: string;
  availablePhases: string[];
}) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const processorValue = useWatch({ control, name: `inputProcessors.${providerId}` });
  const isEnabled = processorValue !== undefined;

  const { data: providerDetails } = useProcessorProvider(providerId, { enabled: isEnabled });
  const configSchema = providerDetails?.configSchema as Record<string, unknown> | undefined;

  const handleToggle = (checked: boolean) => {
    const current = form.getValues('inputProcessors') ?? {};
    if (checked) {
      form.setValue(
        'inputProcessors',
        { ...current, [providerId]: { config: {}, enabledPhases: [...availablePhases] } },
        { shouldDirty: true },
      );
    } else {
      const next = { ...current };
      delete next[providerId];
      form.setValue('inputProcessors', next, { shouldDirty: true });
    }
  };

  return (
    <Entity className="flex-col gap-0 p-0 overflow-hidden">
      <div className="flex gap-3 py-3 px-4">
        <EntityContent>
          <EntityName>{name}</EntityName>
          {description && <EntityDescription>{description}</EntityDescription>}
        </EntityContent>

        {!readOnly && <Switch checked={isEnabled} onCheckedChange={handleToggle} />}
      </div>

      {isEnabled && (
        <div className="bg-surface2 border-t border-border1 p-4 flex flex-col gap-4">
          <PhaseSelection providerId={providerId} availablePhases={availablePhases} />
          {configSchema && <ConfigFields providerId={providerId} configSchema={configSchema} />}
        </div>
      )}
    </Entity>
  );
}

function PhaseSelection({ providerId, availablePhases }: { providerId: string; availablePhases: string[] }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const enabledPhases = (useWatch({ control, name: `inputProcessors.${providerId}.enabledPhases` }) ?? []) as string[];

  const handlePhaseToggle = (phase: string, checked: boolean) => {
    const current = form.getValues(`inputProcessors.${providerId}`) ?? { config: {}, enabledPhases: [] };
    const currentPhases = (current.enabledPhases ?? []) as string[];
    const next = checked ? [...currentPhases, phase] : currentPhases.filter(p => p !== phase);
    form.setValue(`inputProcessors.${providerId}.enabledPhases`, next, { shouldDirty: true });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm text-neutral5">Enabled Phases</Label>
      <div className="flex flex-col gap-1.5">
        {availablePhases.map(phase => (
          <div key={phase} className="flex items-center justify-between">
            <span className="text-sm text-neutral4">{PHASE_LABELS[phase] ?? phase}</span>
            {!readOnly && (
              <Switch
                checked={enabledPhases.includes(phase)}
                onCheckedChange={checked => handlePhaseToggle(phase, checked)}
              />
            )}
            {readOnly && <span className="text-xs text-neutral3">{enabledPhases.includes(phase) ? 'On' : 'Off'}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigFields({ providerId, configSchema }: { providerId: string; configSchema: Record<string, unknown> }) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;

  const properties = (configSchema as { properties?: Record<string, Record<string, unknown>> }).properties;
  if (!properties || Object.keys(properties).length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm text-neutral5">Configuration</Label>
      <div className="grid grid-cols-2 gap-4">
        {Object.entries(properties).map(([key, schema]) => (
          <ConfigField key={key} providerId={providerId} fieldKey={key} schema={schema} />
        ))}
      </div>
    </div>
  );
}

function ConfigField({
  providerId,
  fieldKey,
  schema,
}: {
  providerId: string;
  fieldKey: string;
  schema: Record<string, unknown>;
}) {
  const { form, readOnly } = useAgentEditFormContext();
  const { control } = form;
  const fieldName = `inputProcessors.${providerId}.config.${fieldKey}` as const;
  const fieldType = schema.type as string | undefined;
  const fieldEnum = schema.enum as string[] | undefined;
  const fieldDescription = schema.description as string | undefined;
  const fieldTitle = (schema.title as string | undefined) ?? fieldKey;

  if (fieldEnum) {
    return (
      <Controller
        name={fieldName}
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-neutral5">{fieldTitle}</Label>
            {fieldDescription && <span className="text-xs text-neutral2">{fieldDescription}</span>}
            <Select value={(field.value as string) ?? ''} onValueChange={field.onChange} disabled={readOnly}>
              <SelectTrigger className="bg-surface3">
                <SelectValue placeholder={`Select ${fieldTitle}`} />
              </SelectTrigger>
              <SelectContent>
                {fieldEnum.map(opt => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      />
    );
  }

  if (fieldType === 'boolean') {
    return (
      <Controller
        name={fieldName}
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-neutral5">{fieldTitle}</Label>
            {fieldDescription && <span className="text-xs text-neutral2">{fieldDescription}</span>}
            <Switch checked={(field.value as boolean) ?? false} onCheckedChange={field.onChange} disabled={readOnly} />
          </div>
        )}
      />
    );
  }

  if (fieldType === 'number' || fieldType === 'integer') {
    return (
      <Controller
        name={fieldName}
        control={control}
        render={({ field }) => (
          <div className="flex flex-col gap-1.5">
            <Label className="text-sm text-neutral5">{fieldTitle}</Label>
            {fieldDescription && <span className="text-xs text-neutral2">{fieldDescription}</span>}
            <Input
              type="number"
              value={(field.value as number) ?? ''}
              onChange={e => {
                const v = e.target.value;
                field.onChange(v === '' ? undefined : Number(v));
              }}
              placeholder={fieldTitle}
              className="bg-surface3"
              disabled={readOnly}
            />
          </div>
        )}
      />
    );
  }

  // Default: string input
  return (
    <Controller
      name={fieldName}
      control={control}
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <Label className="text-sm text-neutral5">{fieldTitle}</Label>
          {fieldDescription && <span className="text-xs text-neutral2">{fieldDescription}</span>}
          <Input
            type="text"
            value={(field.value as string) ?? ''}
            onChange={e => field.onChange(e.target.value)}
            placeholder={fieldTitle}
            className="bg-surface3"
            disabled={readOnly}
          />
        </div>
      )}
    />
  );
}
