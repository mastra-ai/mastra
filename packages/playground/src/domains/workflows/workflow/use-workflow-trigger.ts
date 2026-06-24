import type { GetWorkflowResponse } from '@mastra/client-js';
import { jsonSchemaToZod } from '@mastra/schema-compat/json-to-zod';
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

/**
 * Derive everything we need to reason about per-step execution from the static
 * workflow graph (independent of any run state):
 * - `stepNodesInOrder`: step ids in graph order (excludes boundary/condition nodes).
 * - `stepsFlow`: each step -> its predecessor step ids.
 * - `stepSuccessors`: each step -> the steps that depend on it (the inverse of `stepsFlow`).
 * - `conditionalStepIds` / `nestedWorkflowStepIds`: see `collectGraphStepFlags`.
 */
function useWorkflowStepGraphInfo(stepGraph: GetWorkflowResponse['stepGraph'] | undefined) {
  return useMemo(() => {
    const { nodes, edges } = constructNodesAndEdges({ stepGraph });
    const stepNodesInOrder = nodes
      .filter(node => node.type === WORKFLOW_STEP_NODE_TYPE && node.data?.nodeRole !== 'condition' && node.data?.stepId)
      .map(node => node.data.stepId as string);

    const stepsFlow = buildStepsFlow(edges);
    const stepSuccessors = buildStepSuccessors(stepsFlow);
    const { conditionalStepIds, nestedWorkflowStepIds } = collectGraphStepFlags(stepGraph);

    return { stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds, nestedWorkflowStepIds };
  }, [stepGraph]);
}

/**
 * Read-only derivation of the step a paused (per-step/debug) run is waiting on.
 * Pulls run + graph state from context so any component (e.g. the graph viewport)
 * can react to the waited step declaratively without props being drilled through.
 * Returns `undefined` when the run is not paused or there is no next step.
 */
export function useWaitingStepKey(): string | undefined {
  const { result, workflow } = useContext(WorkflowRunContext);

  const { stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds } = useWorkflowStepGraphInfo(
    workflow?.stepGraph,
  );

  const steps = result?.steps;

  // A run only reaches the 'paused' status when it was started in per-step (debug) mode, so a
  // paused run is always steppable regardless of the in-memory debugMode flag. This lets the
  // step controls work when landing directly on a paused run's :runId page, where the debugMode
  // flag starts out false.
  const isPaused = result?.status === 'paused';

  const isStepSuccess = useCallback((stepId: string) => steps?.[stepId]?.status === 'success', [steps]);
  // A non-truthy conditional arm is rehydrated as 'skipped' and never produces a successor join,
  // so isBranchArmBypassed can't infer it. Treat both 'success' and 'skipped' as resolved when
  // deciding which step still needs to run, otherwise the controls re-select the skipped arm.
  const isStepResolved = useCallback(
    (stepId: string) => steps?.[stepId]?.status === 'success' || steps?.[stepId]?.status === 'skipped',
    [steps],
  );
  const isStepBypassed = useCallback(
    (stepId: string) => isBranchArmBypassed({ stepId, conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess }),
    [conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess],
  );

  return useMemo(
    () =>
      isPaused ? selectNextStepKey({ stepNodesInOrder, isStepSuccess: isStepResolved, isStepBypassed }) : undefined,
    [isPaused, stepNodesInOrder, isStepResolved, isStepBypassed],
  );
}

export function useNextPerStep() {
  const { result, runId, workflowId, workflow, payload, setDebugMode, timeTravelWorkflowStream } =
    useContext(WorkflowRunContext);
  const requestContext = useMergedRequestContext();

  const { stepsFlow, stepNodesInOrder, nestedWorkflowStepIds, conditionalStepIds, stepSuccessors } =
    useWorkflowStepGraphInfo(workflow?.stepGraph);

  const steps = result?.steps;

  const isStepSuccess = useCallback((stepId: string) => steps?.[stepId]?.status === 'success', [steps]);
  const isStepResolved = useCallback(
    (stepId: string) => steps?.[stepId]?.status === 'success' || steps?.[stepId]?.status === 'skipped',
    [steps],
  );
  const isStepBypassed = useCallback(
    (stepId: string) => isBranchArmBypassed({ stepId, conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess }),
    [conditionalStepIds, stepSuccessors, stepsFlow, isStepSuccess],
  );

  const nextStepKey = useWaitingStepKey();

  const stepPayload = useMemo(() => {
    const input = buildNextStepInput({ nextStepKey, stepsFlow, steps, isStepBypassed });
    if (input) return input;
    // A predecessor-less step (the first step of a paused run with no completed steps) has no
    // upstream output to build from, so buildNextStepInput returns undefined and the run can never
    // advance. Seed it from the run's own input/payload so the first step becomes runnable.
    if (nextStepKey && (stepsFlow[nextStepKey]?.length ?? 0) === 0) {
      return { hasMultiSteps: false, input: result?.input ?? payload };
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

      // A nested workflow is atomic from the parent's perspective, and the last step must finish
      // the run instead of pausing again (otherwise the user never sees the run's end output).
      // Both cases run to completion in a single advance with per-step disabled.
      const isNestedWorkflowStep = nestedWorkflowStepIds.has(nextStepKey);
      const runToFinish = isContinueRun || isNestedWorkflowStep || isLastStep;

      const payload = {
        runId,
        workflowId,
        step: nextStepKey,
        inputData: stepPayload.hasMultiSteps ? undefined : stepPayload.input,
        requestContext,
        // Drive per-step explicitly off the paused-run intent rather than the in-memory
        // debugMode flag. On the :runId page debugMode starts false, so omitting perStep
        // would let timeTravelStream default to a full run instead of re-pausing.
        perStep: !runToFinish,
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
