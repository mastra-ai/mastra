import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { parse } from 'superjson';
import { z } from 'zod';

import { resolveSerializedZodOutput } from '@/lib/form/utils';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Txt } from '@/ds/components/Txt';

import type { GetWorkflowResponse } from '@mastra/client-js';
import type { SuspendedStep } from './use-workflow-trigger';
import { WorkflowInputData } from './workflow-input-data';

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
    <>
      {suspendedSteps.map(step => {
        const stepDefinition = workflow.allSteps[step.stepId];
        if (!stepDefinition || stepDefinition.isWorkflow) return null;

        const stepSchema = stepDefinition?.resumeSchema
          ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stepDefinition.resumeSchema)))
          : z.record(z.string(), z.any());

        return (
          <div className="flex flex-col px-4" key={step.stepId}>
            <Txt variant="ui-xs" className="text-neutral3">
              {step.stepId}
            </Txt>
            {step.suspendPayload && (
              <div data-testid="suspended-payload">
                <CodeEditor data={step.suspendPayload} className="w-full overflow-x-auto p-2" showCopyButton={false} />
              </div>
            )}
            <WorkflowInputData
              schema={stepSchema}
              isSubmitLoading={isStreaming}
              submitButtonLabel="Resume workflow"
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
      })}
    </>
  );
}
