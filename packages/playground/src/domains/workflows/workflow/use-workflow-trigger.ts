import type { GetWorkflowResponse, TimeTravelParams } from '@mastra/client-js';
import { useCallback, useContext, useMemo } from 'react';
import { parse } from 'superjson';
import { z } from 'zod';

import type { WorkflowRunStreamResult } from '../context/workflow-run-context';
import { WorkflowRunContext } from '../context/workflow-run-context';
import {
  buildNextStepInput,
  buildStepSuccessors,
  buildStepsFlow,
  collectGraphStepFlags,
  constructNodesAndEdges,
  isBranchArmBypassed,
  isLastRunnableStep,
  selectNextStepKey,
} from './utils';
import { WORKFLOW_STEP_NODE_TYPE } from './workflow-step-node-utils';
import type { ResumeStepParams } from './workflow-suspended-steps';
import { useMergedRequestContext } from '@/domains/request-context/context/schema-request-context';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export interface SuspendedStep {
  stepId: string;
  runId: string;
  suspendPayload: unknown;
}

export function useSuspendedSteps(streamResult: WorkflowRunStreamResult | null, runId: string): SuspendedStep[] {
  return useMemo(() => {
    return Object.entries(streamResult?.steps || {})
      .filter(([_, { status }]) => status === 'suspended')
      .map(([stepId, { suspendPayload }]) => ({ stepId, runId, suspendPayload }));
  }, [streamResult?.steps, runId]);
}

export function useWorkflowSchemas(workflow?: GetWorkflowResponse) {
  return useMemo(() => {
    const triggerSchema = workflow?.inputSchema;
    const stateSchema = workflow?.stateSchema;

    const zodInputSchema = triggerSchema ? jsonSchemaToZodRuntime(parse(triggerSchema)) : null;
    const zodStateSchema = stateSchema ? jsonSchemaToZodRuntime(parse(stateSchema)) : null;

    return {
      zodSchemaToUse: zodStateSchema
        ? z.object({
            inputData: zodInputSchema ?? z.any(),
            initialState: zodStateSchema.optional(),
          })
        : zodInputSchema,
      hasStateSchema: !!stateSchema,
    };
  }, [workflow?.inputSchema, workflow?.stateSchema]);
}

function useWorkflowStepGraphInfo(stepGraph: GetWorkflowResponse['stepGraph'] | undefined) {
  return useMemo(() => {
    const { nodes, edges } = constructNodesAndEdges({ stepGraph });
    const stepNodesInOrder = nodes.flatMap(node => {
      if (node.type !== WORKFLOW_STEP_NODE_TYPE || node.data.nodeRole === 'condition' || !node.data.stepId) {
        return [];
      }
      return [node.data.stepId];
    });

    const stepsFlow = buildStepsFlow(edges);
    const stepSuccessors = buildStepSuccessors(stepsFlow);
    const { conditionalStepIds, nestedWorkflowStepIds } = collectGraphStepFlags(stepGraph);

    return { stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds, nestedWorkflowStepIds };
  }, [stepGraph]);
}

export function useWaitingStepKey(): string | undefined {
  const { result, workflow } = useContext(WorkflowRunContext);

  const { stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds } = useWorkflowStepGraphInfo(
    workflow?.stepGraph,
  );

  const steps = result?.steps;

  // Only per-step runs pause, so a paused run stays steppable when debugMode starts false on its :runId page.
  const isPaused = result?.status === 'paused';

  const isStepResolved = useCallback(
    (stepId: string) => steps?.[stepId]?.status === 'success' || steps?.[stepId]?.status === 'skipped',
    [steps],
  );
  const isStepBypassed = useCallback(
    (stepId: string) => isBranchArmBypassed({ stepId, conditionalStepIds, stepSuccessors, stepsFlow, steps }),
    [conditionalStepIds, stepSuccessors, stepsFlow, steps],
  );

  return useMemo(
    () =>
      isPaused ? selectNextStepKey({ stepNodesInOrder, isStepSuccess: isStepResolved, isStepBypassed }) : undefined,
    [isPaused, stepNodesInOrder, isStepResolved, isStepBypassed],
  );
}

export function useSuspendedStepKey(): string | undefined {
  const { result } = useContext(WorkflowRunContext);

  return useMemo(() => {
    const entry = Object.entries(result?.steps || {}).find(([_, { status }]) => status === 'suspended');
    return entry?.[0];
  }, [result?.steps]);
}

export function useNextPerStep() {
  const { result, runId, workflowId, workflow, payload, setDebugMode, timeTravelWorkflowStream } =
    useContext(WorkflowRunContext);
  const requestContext = useMergedRequestContext();

  const { stepsFlow, stepNodesInOrder, nestedWorkflowStepIds, conditionalStepIds, stepSuccessors } =
    useWorkflowStepGraphInfo(workflow?.stepGraph);

  const steps = result?.steps;

  const isStepResolved = useCallback(
    (stepId: string) => steps?.[stepId]?.status === 'success' || steps?.[stepId]?.status === 'skipped',
    [steps],
  );
  const isStepBypassed = useCallback(
    (stepId: string) => isBranchArmBypassed({ stepId, conditionalStepIds, stepSuccessors, stepsFlow, steps }),
    [conditionalStepIds, stepSuccessors, stepsFlow, steps],
  );

  const nextStepKey = useWaitingStepKey();

  const stepPayload = useMemo(() => {
    const input = buildNextStepInput({ nextStepKey, stepsFlow, steps, isStepBypassed });
    if (input) return input;
    // The first step has no upstream output; seed it from the run input so the paused run can advance.
    if (nextStepKey && (stepsFlow[nextStepKey]?.length ?? 0) === 0) {
      return { hasMultiSteps: false, input: result?.input !== undefined ? result.input : payload };
    }
    return undefined;
  }, [nextStepKey, stepsFlow, steps, result?.input, payload, isStepBypassed]);

  const isLastStep = useMemo(
    () => isLastRunnableStep({ nextStepKey, stepNodesInOrder, isStepSuccess: isStepResolved, isStepBypassed }),
    [nextStepKey, stepNodesInOrder, isStepResolved, isStepBypassed],
  );

  const canRunNextStep = Boolean(nextStepKey && stepPayload);

  const runStep = useCallback(
    (isContinueRun: boolean) => {
      if (!nextStepKey || !stepPayload) return;

      // Nested workflows are atomic and the last step must end the run, so both skip the per-step pause.
      const isNestedWorkflowStep = nestedWorkflowStepIds.has(nextStepKey);
      const runToFinish = isContinueRun || isNestedWorkflowStep || isLastStep;

      const payload = {
        runId,
        workflowId,
        step: nextStepKey,
        inputData: stepPayload.hasMultiSteps ? undefined : stepPayload.input,
        requestContext,
        // Explicit, because debugMode starts false on the :runId page and would default to a full run.
        perStep: !runToFinish,
        ...(stepPayload.hasMultiSteps
          ? {
              context: Object.keys(stepPayload.input).reduce<NonNullable<TimeTravelParams['context']>>(
                (acc, stepId) => {
                  acc[stepId] = { status: 'success', output: stepPayload.input[stepId] };
                  return acc;
                },
                {},
              ),
            }
          : {}),
      };

      if (isContinueRun) {
        setDebugMode(false);
      }

      void timeTravelWorkflowStream(payload);
    },
    [
      nextStepKey,
      stepPayload,
      runId,
      workflowId,
      requestContext,
      setDebugMode,
      timeTravelWorkflowStream,
      nestedWorkflowStepIds,
      isLastStep,
    ],
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
