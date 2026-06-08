import { Button, Icon } from '@mastra/playground-ui';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ZodSchema } from 'zod';

import { WorkflowInputData } from './workflow-input-data';

export interface WorkflowTriggerFormProps {
  zodSchema: ZodSchema | null;
  isStreaming: boolean;
  onExecute: (data: any) => void;
  defaultValues?: any;
  isViewingRun?: boolean;
  isReadOnly?: boolean;
  isProcessorWorkflow?: boolean;
  submitActions?: ReactNode;
  leftActions?: ReactNode;
  heading?: string;
}

export function WorkflowTriggerForm({
  zodSchema,
  isStreaming,
  onExecute,
  defaultValues,
  isViewingRun,
  isReadOnly,
  isProcessorWorkflow,
  submitActions,
  leftActions,
  heading,
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
        isReadOnly={isReadOnly}
        isProcessorWorkflow={isProcessorWorkflow}
        submitActions={submitActions}
        leftActions={leftActions}
        heading={heading}
      />
    );
  }

  if (isViewingRun) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-1">
      {leftActions ?? <div />}
      <div className="flex items-center gap-1">
        {submitActions}
        <Button variant="default" disabled={isStreaming} onClick={() => onExecute(null)}>
          {isStreaming ? (
            <Icon>
              <Loader2 className="animate-spin" />
            </Icon>
          ) : (
            'Trigger'
          )}
        </Button>
      </div>
    </div>
  );
}
