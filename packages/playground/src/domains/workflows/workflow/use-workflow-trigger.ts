import type { GetWorkflowResponse } from '@mastra/client-js';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
import { useCallback, useContext, useMemo } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import type { ResumeStepParams } from './workflow-suspended-steps';
import { buildStepsFlow, constructNodesAndEdges } from './utils';
import { WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { resolveSerializedZodOutput } from '@/lib/form/utils';

export interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: any;
  workflow?: GetWorkflowResponse;
  isLoading: boolean;
}

export function useSuspendedSteps(streamResult: WorkflowRunStreamResult | null, runId: string): SuspendedStep[] {
  return useMemo(() => {
    return Object.entries(streamResult?.steps || {})
      .filter(([_, { status }]) => status === 'suspended')
      .map(([stepId, { suspendPayload }]) => ({
        stepId,
        runId,
        suspendPayload,
        isLoading: false,
      }));
  }, [streamResult?.steps, runId]);
}

export function useWorkflowSchemas(workflow?: GetWorkflowResponse) {
  return useMemo(() => {
    const triggerSchema = workflow?.inputSchema;
    const stateSchema = workflow?.stateSchema;

    const zodInputSchema = triggerSchema ? resolveSerializedZodOutput(jsonSchemaToZod(parse(triggerSchema))) : null;
    const zodStateSchema = stateSchema ? resolveSerializedZodOutput(jsonSchemaToZod(parse(stateSchema))) : null;

    return {
      zodSchemaToUse: zodStateSchema
        ? z.object({
            inputData: zodInputSchema,
            initialState: zodStateSchema.optional(),
          })
        : zodInputSchema,
      hasStateSchema: !!stateSchema,
    };
  }, [workflow?.inputSchema, workflow?.stateSchema]);
}

export function useNextPerStep() {
  const { result, runId, workflowId, workflow, debugMode, setDebugMode, timeTravelWorkflowStream } =
    useContext(WorkflowRunContext);
  const requestContext = useMergedRequestContext();

  const stepGraph = workflow?.stepGraph;

  const { stepNodesInOrder, stepsFlow } = useMemo(() => {
    const { nodes, edges } = constructNodesAndEdges({ stepGraph });
    const orderedStepIds = nodes
      .filter(node => node.type === WORKFLOW_STEP_NODE_TYPE && node.data?.nodeRole !== 'condition' && node.data?.stepId)
      .map(node => node.data.stepId as string);

    return { stepNodesInOrder: orderedStepIds, stepsFlow: buildStepsFlow(edges) };
  }, [stepGraph]);

  const nextStepKey = useMemo(() => {
    if (!debugMode || result?.status !== 'paused') return undefined;

    return stepNodesInOrder.find(stepId => result?.steps?.[stepId]?.status !== 'success');
  }, [debugMode, result?.status, result?.steps, stepNodesInOrder]);

  const stepPayload = useMemo(() => {
    if (!nextStepKey) return undefined;
    const previousSteps = stepsFlow?.[nextStepKey] ?? [];
    if (previousSteps.length === 0) return undefined;

    if (previousSteps.length > 1) {
      return {
        hasMultiSteps: true,
        input: previousSteps.reduce(
          (acc, stepId) => {
            if (result?.steps?.[stepId]?.status === 'success') {
              acc[stepId] = result?.steps?.[stepId].output;
            }
            return acc;
          },
          {} as Record<string, any>,
        ),
      };
    }

    const prevStepId = previousSteps[0];
    if (result?.steps?.[prevStepId]?.status === 'success') {
      return {
        hasMultiSteps: false,
        input: result?.steps?.[prevStepId].output,
      };
    }

    return undefined;
  }, [nextStepKey, stepsFlow, result?.steps]);

  const canRunNextStep = Boolean(nextStepKey && stepPayload);

  const runStep = useCallback(
    (isContinueRun: boolean) => {
      if (!nextStepKey || !stepPayload) return;

      const payload = {
        runId,
        workflowId,
        step: nextStepKey,
        inputData: stepPayload.hasMultiSteps ? undefined : stepPayload.input,
        requestContext,
        ...(isContinueRun ? { perStep: false } : {}),
        ...(stepPayload.hasMultiSteps
          ? {
              context: Object.keys(stepPayload.input).reduce(
                (acc, stepId) => {
                  acc[stepId] = { output: stepPayload.input[stepId] };
                  return acc;
                },
                {} as Record<string, any>,
              ),
            }
          : {}),
      };

      if (isContinueRun) {
        setDebugMode(false);
      }

      void timeTravelWorkflowStream(payload);
    },
    [nextStepKey, stepPayload, runId, workflowId, requestContext, setDebugMode, timeTravelWorkflowStream],
  );

  return {
    canRunNextStep,
    runNextStep: useCallback(() => runStep(false), [runStep]),
    continueFullRun: useCallback(() => runStep(true), [runStep]),
  };
}

export function useResumeWorkflow() {
  const { workflowId, workflow, createWorkflowRun, resumeWorkflow } = useContext(WorkflowRunContext);
  const requestContext = useMergedRequestContext();

  return useCallback(
    async (step: ResumeStepParams) => {
      if (!workflow) return;

      const { stepId, runId: prevRunId, resumeData } = step;

      const run = await createWorkflowRun({ workflowId, prevRunId });

      await resumeWorkflow({
        step: stepId,
        runId: run.runId,
        resumeData,
        workflowId,
        requestContext,
      });
    },
    [workflowId, workflow, createWorkflowRun, resumeWorkflow, requestContext],
  );
}
