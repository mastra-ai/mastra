import { useMemo, useState } from 'react';
import { SideDialog } from '@/ds/components/SideDialog';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { DynamicForm } from '@/lib/form';
import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import type { ProcessorGraphStep, ProcessorPhase } from '../types';
import { useProcessorProviderDetails } from '@/domains/processors/hooks';
import z from 'zod';

interface ProcessorConfigDialogProps {
  step: ProcessorGraphStep;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, unknown>, enabledPhases: ProcessorPhase[]) => void;
}

export function ProcessorConfigDialog({ step, isOpen, onClose, onSave }: ProcessorConfigDialogProps) {
  const { data: providerDetails } = useProcessorProviderDetails(step.providerId || null);

  const availablePhases = (providerDetails?.availablePhases ?? []) as ProcessorPhase[];

  const zodSchema = useMemo(() => {
    if (!providerDetails?.configSchema || Object.keys(providerDetails.configSchema).length === 0) {
      return null;
    }
    try {
      const jsonSchema = providerDetails.configSchema as Parameters<typeof jsonSchemaToZod>[0];
      return resolveSerializedZodOutput(jsonSchemaToZod(jsonSchema));
    } catch (error) {
      console.error('Failed to parse processor configSchema:', error);
      return null;
    }
  }, [providerDetails?.configSchema]);

  const handleSave = (values: Record<string, unknown>, enabledPhases: ProcessorPhase[]) => {
    onSave(values, enabledPhases);
    onClose();
  };

  return (
    <SideDialog
      dialogTitle={`Configure ${providerDetails?.name ?? step.providerId}`}
      dialogDescription="Configure processor settings and enabled phases"
      isOpen={isOpen}
      onClose={onClose}
      level={3}
    >
      <SideDialog.Top>
        <span className="flex-1">Configure Processor</span>
        <div className="flex items-center gap-2 mr-6">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </SideDialog.Top>

      <SideDialog.Content>
        {isOpen && (
          <InnerDialog
            availablePhases={availablePhases}
            config={step.config}
            initialEnabledPhases={step.enabledPhases}
            zodSchema={zodSchema}
            onSave={handleSave}
          />
        )}
      </SideDialog.Content>
    </SideDialog>
  );
}

interface InnerDialogProps {
  availablePhases: ProcessorPhase[];
  config: Record<string, unknown>;
  initialEnabledPhases: ProcessorPhase[];
  zodSchema: z.ZodSchema;
  onSave: (config: Record<string, unknown>, enabledPhases: ProcessorPhase[]) => void;
}

const InnerDialog = ({ availablePhases, config, initialEnabledPhases, zodSchema, onSave }: InnerDialogProps) => {
  const [enabledPhases, setEnabledPhases] = useState<ProcessorPhase[]>(initialEnabledPhases);

  const togglePhase = (phase: ProcessorPhase) => {
    setEnabledPhases(prev => (prev.includes(phase) ? prev.filter(p => p !== phase) : [...prev, phase]));
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h4 className="text-ui-sm font-medium text-neutral5 mb-3">Enabled Phases</h4>
        <div className="flex flex-col gap-2">
          {availablePhases.map(phase => (
            <label key={phase} className="flex items-center gap-2 text-ui-sm text-neutral5 cursor-pointer">
              <Checkbox checked={enabledPhases.includes(phase)} onCheckedChange={() => togglePhase(phase)} />
              {phase}
            </label>
          ))}
          {availablePhases.length === 0 && <p className="text-ui-sm text-neutral3">Loading available phases...</p>}
        </div>
      </div>

      {zodSchema && (
        <div>
          <h4 className="text-ui-sm font-medium text-neutral5 mb-3">Configuration</h4>
          <DynamicForm
            schema={zodSchema}
            onSubmit={values => onSave(values as Record<string, unknown>, enabledPhases)}
            defaultValues={config}
          />
        </div>
      )}
    </div>
  );
};
