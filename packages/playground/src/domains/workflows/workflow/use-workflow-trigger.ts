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
  const { result, runId, workflowId, workflow, setDebugMode, timeTravelWorkflowStream } =
    useContext(WorkflowRunContext);
  const requestContext = useMergedRequestContext();

  const stepGraph = workflow?.stepGraph;

  const { stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds, nestedWorkflowStepIds } =
    useMemo(() => {
    const { nodes, edges } = constructNodesAndEdges({ stepGraph });
    const orderedStepIds = nodes
      .filter(node => node.type === WORKFLOW_STEP_NODE_TYPE && node.data?.nodeRole !== 'condition' && node.data?.stepId)
      .map(node => node.data.stepId as string);

    const stepsFlow = buildStepsFlow(edges);

    // Invert the predecessor map so we can tell which steps share a successor (a "join").
    // Branch arms feed the same downstream join node, which lets us detect arms that were
    // never taken once a sibling on the same join has already succeeded.
    const stepSuccessors = Object.entries(stepsFlow).reduce(
      (acc, [stepId, prevStepIds]) => {
        for (const prevStepId of prevStepIds) {
          acc[prevStepId] = [...new Set([...(acc[prevStepId] || []), stepId])];
        }
        return acc;
      },
      {} as Record<string, string[]>,
    );

    // Only steps inside a conditional entry can be "bypassed": when one branch arm is
    // selected, the other arms never run. Parallel arms also share a downstream join, but
    // every parallel arm must run, so they must NOT be treated as bypassable.
    const conditionalStepIds = new Set<string>();
    // A nested workflow is a single atomic step from the parent's perspective. When it is
    // the next step to advance, it must run to completion in one go rather than pausing
    // after its own first inner step, so it is targeted with per-step execution disabled.
    const nestedWorkflowStepIds = new Set<string>();
    const collectStepFlags = (entry: any) => {
      if (!entry) return;
      if (entry.type === 'step' || entry.type === 'foreach' || entry.type === 'loop') {
        if (entry.step?.component === 'WORKFLOW' && entry.step?.id) {
          nestedWorkflowStepIds.add(entry.step.id);
        }
      }
      if (entry.type === 'conditional') {
        for (const child of entry.steps) {
          conditionalStepIds.add(child.step.id);
          collectStepFlags(child);
        }
      }
      if (entry.type === 'parallel') {
        for (const child of entry.steps) {
          collectStepFlags(child);
        }
      }
    };
    for (const entry of stepGraph ?? []) {
      collectStepFlags(entry);
    }

    return {
      stepNodesInOrder: orderedStepIds,
      stepsFlow,
      stepSuccessors,
      conditionalStepIds,
      nestedWorkflowStepIds,
    };
  }, [stepGraph]);

  const nextStepKey = useMemo(() => {
    // A run only reaches the 'paused' status when it was started in per-step (debug) mode, so
    // a paused run is always steppable regardless of the in-memory debugMode flag. This lets
    // the step controls work when landing directly on a paused run's :runId page, where the
    // debugMode flag starts out false.
    if (result?.status !== 'paused') return undefined;

    const isSuccess = (stepId: string) => result?.steps?.[stepId]?.status === 'success';

    // A conditional branch arm is bypassed when one of its successors (a join such as a
    // post-branch map) already has another predecessor that succeeded. That means a sibling
    // arm was the one selected by the condition, so this arm will never run and must be
    // skipped, otherwise per-step execution stalls on it forever. Parallel arms are excluded
    // here because every parallel arm is expected to run, even though they share a join.
    const isBypassed = (stepId: string) => {
      if (!conditionalStepIds.has(stepId)) return false;
      const successors = stepSuccessors[stepId] ?? [];
      return successors.some(successorId => (stepsFlow[successorId] ?? []).some(sib => sib !== stepId && isSuccess(sib)));
    };

    return stepNodesInOrder.find(stepId => !isSuccess(stepId) && !isBypassed(stepId));
  }, [result?.status, result?.steps, stepNodesInOrder, stepsFlow, stepSuccessors, conditionalStepIds]);

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

  // The final advance must finish the run instead of pausing again, otherwise the workflow
  // ends in a 'paused' state and the user never sees the run's end output. A step is the last
  // one when no later step in graph order still needs to run (ignoring bypassed branch arms).
  const isLastStep = useMemo(() => {
    if (!nextStepKey) return false;
    const isSuccess = (stepId: string) => result?.steps?.[stepId]?.status === 'success';
    const isBypassed = (stepId: string) => {
      if (!conditionalStepIds.has(stepId)) return false;
      const successors = stepSuccessors[stepId] ?? [];
      return successors.some(successorId => (stepsFlow[successorId] ?? []).some(sib => sib !== stepId && isSuccess(sib)));
    };
    const nextIndex = stepNodesInOrder.indexOf(nextStepKey);
    return stepNodesInOrder
      .slice(nextIndex + 1)
      .every(stepId => isSuccess(stepId) || isBypassed(stepId));
  }, [nextStepKey, stepNodesInOrder, result?.steps, conditionalStepIds, stepSuccessors, stepsFlow]);

  const canRunNextStep = Boolean(nextStepKey && stepPayload);

  const runStep = useCallback(
    (isContinueRun: boolean) => {
      if (!nextStepKey || !stepPayload) return;

      // A nested workflow must run atomically: disable per-step for this single advance so
      // the nested run completes instead of pausing after its first inner step. Debug mode
      // stays on so subsequent top-level steps continue to advance one at a time.
      const isNestedWorkflowStep = nestedWorkflowStepIds.has(nextStepKey);

      // The last step must finish the run rather than pause again, so the user can see the
      // workflow's end output. Disabling per-step for this final advance lets core complete
      // the run and populate the run result.
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
      result?.steps,
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
