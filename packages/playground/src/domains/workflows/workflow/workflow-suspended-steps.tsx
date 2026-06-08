import type { GetWorkflowResponse } from '@mastra/client-js';
import {
  Button,
  CodeEditor,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Txt,
} from '@mastra/playground-ui';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { CirclePause, FileJson } from 'lucide-react';
import { useState } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import type { SuspendedStep } from './use-workflow-trigger';
import { WorkflowInputData } from './workflow-input-data';

import { resolveSerializedZodOutput } from '@/lib/form/utils';

export interface ResumeStepParams {
  stepId: string | string[];
  runId: string;
  suspendPayload: any;
  resumeData: any;
  isLoading: boolean;
}

export interface WorkflowSuspendedStepsProps {
  suspendedSteps: SuspendedStep[];
  workflow: GetWorkflowResponse;
  isStreaming: boolean;
  onResume: (step: ResumeStepParams) => void;
}

export function WorkflowSuspendedSteps({
  suspendedSteps,
  workflow,
  isStreaming,
  onResume,
}: WorkflowSuspendedStepsProps) {
  if (isStreaming || suspendedSteps.length === 0) {
    return null;
  }

  return (
    <div className="bg-accent3Dark py-4 space-y-4 border-y-2 border-accent3">
      <Txt as="p" variant="ui-md" className="flex items-center gap-2 text-accent3 pb-4 px-5">
        <CirclePause className="h-4 w-4" />
        A step suspended
      </Txt>
      {suspendedSteps.map(step => {
        const stepDefinition = workflow.allSteps[step.stepId];
        if (!stepDefinition || stepDefinition.isWorkflow) return null;

        const stepSchema = stepDefinition?.resumeSchema
          ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.resumeSchema)))
          : z.record(z.string(), z.any());

        return (
          <SuspendedStepCard
            key={step.stepId}
            step={step}
            stepSchema={stepSchema}
            isStreaming={isStreaming}
            onResume={onResume}
          />
        );
      })}
    </div>
  );
}

interface SuspendedStepCardProps {
  step: SuspendedStep;
  stepSchema: z.ZodSchema;
  isStreaming: boolean;
  onResume: (step: ResumeStepParams) => void;
}

function SuspendedStepCard({ step, stepSchema, isStreaming, onResume }: SuspendedStepCardProps) {
  const [isPayloadOpen, setIsPayloadOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 px-5" key={step.stepId}>
      <Txt variant="ui-xs" className="text-neutral3">
        {step.stepId}
      </Txt>

      {step.suspendPayload && (
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPayloadOpen(true)}
            className="self-start border-accent3/40 text-accent3 hover:bg-accent3/15 hover:text-accent3 hover:border-accent3/60 active:bg-accent3/25"
          >
            <FileJson className="h-4 w-4" />
            Suspension payload
          </Button>

          <Dialog open={isPayloadOpen} onOpenChange={setIsPayloadOpen}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Suspension payload</DialogTitle>
                <DialogDescription>{step.stepId}</DialogDescription>
              </DialogHeader>
              <DialogBody className="max-h-[70vh]">
                <div data-testid="suspended-payload">
                  <CodeEditor
                    data={step.suspendPayload}
                    className="w-full overflow-x-auto p-2"
                    showCopyButton={false}
                  />
                </div>
              </DialogBody>
            </DialogContent>
          </Dialog>
        </>
      )}

      <WorkflowInputData
        schema={stepSchema}
        isSubmitLoading={isStreaming}
        submitButtonLabel="Resume workflow"
        heading="Expected data"
        headingClassName="text-accent3"
        submitButtonClassName="bg-accent3 border-accent3 text-surface1 hover:bg-accent3/90 hover:text-surface1 active:bg-accent3/80"
        onSubmit={data => {
          const stepIds = step.stepId?.split('.');
          onResume({
            stepId: stepIds,
            runId: step.runId,
            suspendPayload: step.suspendPayload,
            resumeData: data,
            isLoading: false,
          });
        }}
      />
    </div>
  );
}
