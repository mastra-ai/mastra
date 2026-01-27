import { Loader2 } from 'lucide-react';
import type { ZodSchema } from 'zod';

import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';

import { WorkflowInputData } from './workflow-input-data';

export interface WorkflowTriggerFormProps {
  zodSchema: ZodSchema | null;
  isStreaming: boolean;
  onExecute: (data: any) => void;
  defaultValues?: any;
  isViewingRun?: boolean;
  isProcessorWorkflow?: boolean;
}

export function WorkflowTriggerForm({
  zodSchema,
  isStreaming,
  onExecute,
  defaultValues,
  isViewingRun,
  isProcessorWorkflow,
}: WorkflowTriggerFormProps) {
  if (zodSchema) {
    return (
      <WorkflowInputData
        schema={zodSchema}
        defaultValues={defaultValues}
        isSubmitLoading={isStreaming}
        submitButtonLabel="Run"
        onSubmit={onExecute}
        withoutSubmit={isViewingRun}
        isProcessorWorkflow={isProcessorWorkflow}
      />
    );
  }

  if (isViewingRun) {
    return null;
  }

  return (
    <Button className="w-full" variant="light" disabled={isStreaming} onClick={() => onExecute(null)}>
      {isStreaming ? (
        <Icon>
          <Loader2 className="animate-spin" />
        </Icon>
      ) : (
        'Trigger'
      )}
    </Button>
  );
}
