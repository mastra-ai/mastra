import type { GetWorkflowResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ChevronRight, CirclePause, MoveDownLeft, MoveUpRight, Play } from 'lucide-react';
import { useState } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import type { SuspendedStep } from './use-workflow-trigger';
import { WorkflowInputData } from './workflow-input-data';

import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export interface ResumeStepParams {
  stepId: string | string[];
  runId: string;
  resumeData: Record<string, unknown>;
}

export interface WorkflowSuspendedStepsProps {
  suspendedSteps: SuspendedStep[];
  workflow: GetWorkflowResponse;
  isStreaming: boolean;
  onResume: (step: ResumeStepParams) => Promise<void>;
}

function formatPayloadSize(payload: unknown): string {
  const size = new Blob([JSON.stringify(payload ?? null)]).size;
  if (size < 1024) {
    return `${size} B`;
  }
  return `${(size / 1024).toFixed(1)} KB`;
}

function getPayloadLabel(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const keys = Object.keys(payload);
    if (keys.length === 1) {
      return keys[0];
    }
  }
  return fallback;
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
    <div className="border-border1 bg-surface4 space-y-5 rounded-lg border p-5" data-testid="workflow-suspended-steps">
      <div className="flex items-center justify-between gap-3">
        <Txt as="p" variant="ui-md" className="text-neutral6 flex items-center gap-2 font-semibold">
          <Icon>
            <CirclePause />
          </Icon>
          Step suspended
        </Txt>
        <Badge variant="yellow">Needs input</Badge>
      </div>

      {suspendedSteps.map(step => {
        const stepDefinition = workflow.allSteps[step.stepId];
        if (!stepDefinition || stepDefinition.isWorkflow) return null;

        const stepSchema = stepDefinition?.resumeSchema
          ? jsonSchemaToZodRuntime(parse(stepDefinition.resumeSchema))
          : z.record(z.string(), z.any());

        return (
          <SuspendedStepCard
            key={`${step.runId}-${step.stepId}`}
            step={step}
            stepSchema={stepSchema}
            description={stepDefinition.description}
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
  description?: string;
  onResume: WorkflowSuspendedStepsProps['onResume'];
}

function SuspendedStepCard({ step, stepSchema, description, onResume }: SuspendedStepCardProps) {
  const [isPayloadOpen, setIsPayloadOpen] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const resumeWithResponse = async (resumeData: Record<string, unknown>) => {
    setIsResuming(true);
    try {
      await onResume({ stepId: step.stepId.split('.'), runId: step.runId, resumeData });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error resuming workflow');
    } finally {
      setIsResuming(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Txt as="p" variant="ui-md" className="text-neutral6 truncate font-medium">
          {step.stepId}
        </Txt>
        {description && (
          <Txt as="p" variant="ui-sm" className="text-neutral3">
            {description}
          </Txt>
        )}
      </div>

      {step.suspendPayload !== undefined && (
        <div className="space-y-2">
          <Txt as="p" variant="ui-sm" className="text-neutral3 flex items-center gap-2">
            <Icon>
              <MoveDownLeft />
            </Icon>
            The step is asking
          </Txt>

          <Collapsible open={isPayloadOpen} onOpenChange={setIsPayloadOpen}>
            <CollapsibleTrigger className="border-border1 bg-surface3 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5">
              <span className="flex min-w-0 items-center gap-2">
                <Icon>
                  <ChevronRight
                    className={cn('transition-transform text-neutral3', { 'transform rotate-90': isPayloadOpen })}
                  />
                </Icon>
                <Txt as="span" variant="ui-md" className="text-neutral6 truncate">
                  {getPayloadLabel(step.suspendPayload, step.stepId)}
                </Txt>
              </span>
              <Txt as="span" variant="ui-sm" className="text-neutral3 shrink-0">
                {formatPayloadSize(step.suspendPayload)}
              </Txt>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div data-testid="suspended-payload" className="pt-2">
                <CodeEditor
                  value={JSON.stringify(step.suspendPayload, null, 2)}
                  editable={false}
                  className="w-full overflow-x-auto p-2"
                  showCopyButton={false}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      <div className="space-y-3">
        <Txt as="p" variant="ui-sm" className="text-neutral3 flex items-center gap-2">
          <Icon>
            <MoveUpRight />
          </Icon>
          Your response
        </Txt>

        <div className="-mx-5">
          <WorkflowInputData
            schema={stepSchema}
            isSubmitLoading={isResuming}
            submitButtonLabel="Resume"
            submitButtonIcon={<Play />}
            submitButtonFullWidth
            collapsible={false}
            hideHeading
            hideInputTypeLabel
            onSubmit={resumeWithResponse}
          />
        </div>
      </div>
    </div>
  );
}
