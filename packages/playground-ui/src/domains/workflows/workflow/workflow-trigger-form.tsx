import { Loader2, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ZodSchema } from 'zod';

import { WorkflowInputData } from './workflow-input-data';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';

export interface WorkflowTriggerFormProps {
  zodSchema: ZodSchema | null;
  isStreaming: boolean;
  onExecute: (data: any) => void;
  defaultValues?: any;
  isViewingRun?: boolean;
  isProcessorWorkflow?: boolean;
  submitActions?: ReactNode;
  leftActions?: ReactNode;
  runHeading?: ReactNode;
  submitButtonLabel?: string;
}

export function WorkflowTriggerForm({
  zodSchema,
  isStreaming,
  onExecute,
  defaultValues,
  isViewingRun,
  isProcessorWorkflow,
  submitActions,
  leftActions,
  runHeading,
  submitButtonLabel = 'Run',
}: WorkflowTriggerFormProps) {
  if (isViewingRun) {
    return runHeading && <div className="pb-3">{runHeading}</div>;
  }

  if (zodSchema) {
    return (
      <WorkflowInputData
        schema={zodSchema}
        defaultValues={defaultValues}
        isSubmitLoading={isStreaming}
        submitButtonLabel={submitButtonLabel}
        inputTypeLabel="Next run input"
        submitButtonVariant="primary"
        submitButtonIcon={
          <Icon>
            <Play />
          </Icon>
        }
        onSubmit={onExecute}
        isProcessorWorkflow={isProcessorWorkflow}
        submitActions={submitActions}
        leftActions={leftActions}
        collapsible={false}
        hideHeading
      />
    );
  }

  return (
    <div className="flex items-center justify-between gap-1 px-5 pt-3">
      {leftActions ?? <div />}
      <div className="flex items-center gap-1">
        {submitActions}
        <Button variant="primary" disabled={isStreaming} onClick={() => onExecute(null)}>
          {isStreaming ? (
            <Icon>
              <Loader2 className="animate-spin" />
            </Icon>
          ) : (
            <Icon>
              <Play />
            </Icon>
          )}
          {submitButtonLabel}
        </Button>
      </div>
    </div>
  );
}
