import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { FormInput, Loader2, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ZodSchema } from 'zod';

import { WorkflowInputData } from './workflow-input-data';

export interface WorkflowTriggerFormProps {
  zodSchema: ZodSchema | null;
  isStreaming: boolean;
  onExecute: (data: any) => void;
  defaultValues?: any;
  isViewingRun?: boolean;
  isReadOnly?: boolean;
  disableSubmit?: boolean;
  isProcessorWorkflow?: boolean;
  submitActions?: ReactNode;
  leftActions?: ReactNode;
  heading?: string;
  headingSlot?: ReactNode;
  collapsible?: boolean;
}

export function WorkflowTriggerForm({
  zodSchema,
  isStreaming,
  onExecute,
  defaultValues,
  isViewingRun,
  isReadOnly,
  disableSubmit,
  isProcessorWorkflow,
  submitActions,
  leftActions,
  heading,
  headingSlot,
  collapsible,
}: WorkflowTriggerFormProps) {
  const [isInputDialogOpen, setIsInputDialogOpen] = useState(false);

  if (zodSchema && isViewingRun) {
    return (
      <div>
        {headingSlot && <div className="pb-3">{headingSlot}</div>}
        <div className="flex flex-col gap-1 px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => setIsInputDialogOpen(true)}
          >
            <FormInput className="shrink-0 text-neutral3" />
            <span className="truncate">Run input</span>
          </Button>
        </div>
        <Dialog open={isInputDialogOpen} onOpenChange={setIsInputDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Workflow input</DialogTitle>
            </DialogHeader>
            <DialogBody className="max-h-[90vh]">
              <WorkflowInputData
                schema={zodSchema}
                defaultValues={defaultValues}
                isSubmitLoading={isStreaming}
                submitButtonLabel="Run"
                onSubmit={onExecute}
                withoutSubmit
                isReadOnly
                disableSubmit={disableSubmit}
                isProcessorWorkflow={isProcessorWorkflow}
                collapsible={false}
                hideHeading
                hideInputTypeLabel
              />
            </DialogBody>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (zodSchema) {
    return (
      <WorkflowInputData
        schema={zodSchema}
        defaultValues={defaultValues}
        isSubmitLoading={isStreaming}
        submitButtonLabel="Run"
        submitButtonVariant="primary"
        submitButtonIcon={
          <Icon>
            <Play />
          </Icon>
        }
        onSubmit={onExecute}
        withoutSubmit={isViewingRun}
        isReadOnly={isReadOnly}
        disableSubmit={disableSubmit}
        isProcessorWorkflow={isProcessorWorkflow}
        submitActions={submitActions}
        leftActions={leftActions}
        heading={heading}
        headingSlot={headingSlot}
        collapsible={collapsible}
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
        <Button variant="primary" disabled={isStreaming || disableSubmit} onClick={() => onExecute(null)}>
          {isStreaming ? (
            <Icon>
              <Loader2 className="animate-spin" />
            </Icon>
          ) : (
            <Icon>
              <Play />
            </Icon>
          )}
          Run
        </Button>
      </div>
    </div>
  );
}
