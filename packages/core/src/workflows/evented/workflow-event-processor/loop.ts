import type { StepFlowEntry, StepResult } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { Mastra } from '../../../mastra';
import { getEntryId, getEntryWorkflow } from '../../step-entry';
import { resolveForeachConcurrency } from '../../utils';
import { resolveCurrentState } from '../helpers';
import type { StepExecutor } from '../step-executor';
import { createPendingMarker } from '../types';
import type { ProcessorArgs } from '.';

export async function processWorkflowLoop(
  {
    workflowId,
    prevResult,
    runId,
    executionPath,
    stepResults,
    activeStepsPath,
    resumeSteps,
    resumeData,
    parentWorkflow,
    requestContext,
    retryCount = 0,
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
    stepResult,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'loop' }>;
    stepResult: StepResult<any, any, any, any>;
  },
) {
  // Get current state from stepResult, stepResults or passed state
  const currentState = resolveCurrentState({ stepResult, stepResults, state });

  // Create a proper RequestContext from the plain object passed in ProcessorArgs
  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);

  // Get iteration count from step results metadata (same pattern as control-flow.ts)
  const prevIterationCount = stepResults[getEntryId(step.step)]?.metadata?.iterationCount ?? 0;
  const iterationCount = prevIterationCount + 1;

  const loopCondition = await stepExecutor.evaluateCondition({
    workflowId,
    condition: step.condition,
    runId,
    stepResults,
    state: currentState,
    requestContext: reqContext,
    inputData: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    abortController: new AbortController(),
    retryCount,
    iterationCount,
  });

  // When the loop body runs again, it's a fresh iteration — not a resume — so drop any
  // resume metadata. Otherwise the body would keep receiving the same resumeData on every
  // iteration (and e.g. never re-suspend).
  const loopAgainData = {
    parentWorkflow,
    workflowId,
    runId,
    executionPath,
    resumeSteps: [] as string[],
    // Carry the iteration count forward on the loop body's stepResults entry. The
    // loop-again path does not merge the body result back into stepResults[bodyStepId]
    // (only prevResult carries it), and the evented step executor never writes
    // iterationCount, so without this the next processWorkflowLoop re-reads 0 and the
    // condition is always evaluated with iterationCount === 1 (an infinite loop when
    // termination depends on the count). Mirrors the default engine, which stamps
    // metadata.iterationCount onto the step result. See handlers/step.ts.
    stepResults: {
      ...stepResults,
      [getEntryId(step.step)]: {
        ...stepResults[getEntryId(step.step)],
        metadata: { ...stepResults[getEntryId(step.step)]?.metadata, iterationCount },
      },
    },
    prevResult: stepResult,
    resumeData: undefined,
    activeStepsPath,
    requestContext,
    retryCount,
    perStep,
    state: currentState,
    outputOptions,
  };
  const loopEndData = {
    parentWorkflow,
    workflowId,
    runId,
    executionPath,
    resumeSteps,
    stepResults,
    prevResult: stepResult,
    resumeData,
    activeStepsPath,
    requestContext,
    perStep,
    state: currentState,
    outputOptions,
  };

  if (step.loopType === 'dountil') {
    if (loopCondition) {
      await pubsub.publish('workflows', { type: 'workflow.step.end', runId, data: loopEndData });
    } else {
      await pubsub.publish('workflows', { type: 'workflow.step.run', runId, data: loopAgainData });
    }
  } else {
    if (loopCondition) {
      await pubsub.publish('workflows', { type: 'workflow.step.run', runId, data: loopAgainData });
    } else {
      await pubsub.publish('workflows', { type: 'workflow.step.end', runId, data: loopEndData });
    }
  }
}

export async function processWorkflowForEach(
  {
    workflowId,
    prevResult,
    runId,
    executionPath,
    stepResults,
    activeStepsPath,
    resumeSteps,
    timeTravel,
    restart,
    resumeData,
    parentWorkflow,
    requestContext,
    perStep,
    state,
    outputOptions,
    forEachIndex,
  }: ProcessorArgs,
  {
    pubsub,
    mastra,
    step,
  }: {
    pubsub: PubSub;
    mastra: Mastra;
    step: Extract<StepFlowEntry, { type: 'foreach' }>;
  },
) {
  // Get current state from stepResults or passed state
  const currentState = resolveCurrentState({ stepResults, state });
  const currentResult: Extract<StepResult<any, any, any, any>, { status: 'success' }> = stepResults[
    getEntryId(step.step)
  ] as any;

  const idx = currentResult?.output?.length ?? 0;
  const targetLen = (prevResult as any)?.output?.length ?? 0;

  // Handle resume with forEachIndex: kick off the targeted iteration resume
  if (forEachIndex !== undefined && resumeSteps?.length > 0 && idx > 0) {
    // Validate forEachIndex is within bounds to fail loudly instead of silently no-op
    const outputArray = currentResult?.output;
    const outputLength = Array.isArray(outputArray) ? outputArray.length : 0;
    if (!Array.isArray(outputArray) || forEachIndex < 0 || forEachIndex >= outputLength) {
      const error = new Error(
        `Invalid forEachIndex ${forEachIndex} for forEach resume: ` +
          `expected index in range [0, ${outputLength - 1}] but output array has length ${outputLength}`,
      );
      await pubsub.publish('workflows', {
        type: 'workflow.fail',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: { status: 'failed', error },
          activeStepsPath,
          requestContext,
          state: currentState,
          outputOptions,
        },
      });
      return;
    }

    // Check if the target iteration is suspended
    const iterationResult = currentResult?.output?.[forEachIndex];
    if (iterationResult?.status === 'suspended' || iterationResult === null) {
      // Only pass resumeData to the targeted iteration
      const isNestedWorkflow = getEntryWorkflow(step.step) !== null;
      const targetArray = (prevResult as any)?.output;
      const iterationPrevResult =
        isNestedWorkflow && prevResult.status === 'success' && Array.isArray(targetArray)
          ? { status: 'success' as const, output: targetArray[forEachIndex] }
          : prevResult;

      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath: [executionPath[0]!, forEachIndex],
          resumeSteps,
          timeTravel,
          restart,
          stepResults,
          prevResult: iterationPrevResult,
          resumeData,
          activeStepsPath,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
      return;
    }

    // If forEachIndex was provided but the iteration is already complete,
    // check if there are still pending (null or suspended) iterations.
    // If so, re-suspend the workflow to wait for those to be resumed.
    const pendingIterations = currentResult.output.filter((r: any) => r === null || r?.status === 'suspended');
    if (pendingIterations.length > 0) {
      // Collect resumeLabels from all suspended iterations and capture the first
      // suspended iteration's full suspendPayload so non-__workflow_meta keys
      // (e.g. __streamState stashed by the agent loop) survive aggregation.
      const collectedResumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
      let firstSuspendedIterationPayload: Record<string, unknown> | undefined;
      for (let i = 0; i < currentResult.output.length; i++) {
        const iterResult = currentResult.output[i];
        if (iterResult?.status === 'suspended') {
          if (iterResult.suspendPayload?.__workflow_meta?.resumeLabels) {
            Object.assign(collectedResumeLabels, iterResult.suspendPayload.__workflow_meta.resumeLabels);
          }
          if (firstSuspendedIterationPayload === undefined) {
            firstSuspendedIterationPayload = iterResult.suspendPayload;
          }
        }
      }

      // Build the suspend metadata with all collected resumeLabels
      const suspendMeta: {
        foreachIndex?: number;
        resumeLabels?: Record<string, { stepId: string; foreachIndex?: number }>;
      } = {
        foreachIndex: forEachIndex,
      };
      if (Object.keys(collectedResumeLabels).length > 0) {
        suspendMeta.resumeLabels = collectedResumeLabels;
      }

      const aggregatedSuspendPayload = {
        ...firstSuspendedIterationPayload,
        __workflow_meta: suspendMeta,
      };

      // Re-suspend the workflow - there are still pending iterations
      // Use workflow.step.end with suspended status to update storage
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults: {
            ...stepResults,
            [getEntryId(step.step)]: {
              ...currentResult,
              status: 'suspended',
              suspendedAt: Date.now(),
              suspendPayload: aggregatedSuspendPayload,
            },
          },
          prevResult: {
            status: 'suspended',
            output: currentResult.output,
            suspendPayload: aggregatedSuspendPayload,
            payload: currentResult.payload,
            startedAt: currentResult.startedAt,
            suspendedAt: Date.now(),
          },
          activeStepsPath,
          requestContext,
          state: currentState,
          outputOptions,
        },
      });
      return;
    }

    // forEachIndex was provided but the target iteration is already complete,
    // and there are no pending iterations. The workflow step.end handler will
    // advance the workflow. This is expected behavior for completed forEach loops.
    return;
  }

  // Handle bulk resume: when resumeData is provided but no forEachIndex,
  // resume suspended iterations up to the concurrency limit
  if (resumeData !== undefined && forEachIndex === undefined && currentResult?.output?.length > 0) {
    const suspendedIndices: number[] = [];
    for (let i = 0; i < currentResult.output.length; i++) {
      const iterResult = currentResult.output[i];
      if (iterResult && typeof iterResult === 'object' && iterResult.status === 'suspended') {
        suspendedIndices.push(i);
      }
    }

    if (suspendedIndices.length > 0) {
      // Limit resumption to concurrency value (like initial execution)
      const concurrency = resolveForeachConcurrency(step.opts, {
        inputData: (prevResult as any)?.output,
        getInitData: () => (stepResults as any)?.input,
      });
      const indicesToResume = suspendedIndices.slice(0, concurrency);

      // Reset suspended iterations to "pending" state before re-running them.
      //
      // Why PendingMarker instead of null?
      // The storage merge logic treats null as "keep existing value" to prevent
      // completed results from being overwritten by concurrent iterations that
      // haven't finished yet. But when resuming, we need to force-reset the
      // suspended result to null so the iteration can run fresh.
      //
      // PendingMarker ({ __mastra_pending__: true }) tells the storage layer
      // "force this to null, don't preserve the existing suspended result."
      // See inmemory.ts updateWorkflowResults for the merge logic.
      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      const updatedOutput = [...currentResult.output];
      for (const suspIdx of indicesToResume) {
        updatedOutput[suspIdx] = createPendingMarker() as any;
      }

      await workflowsStore?.updateWorkflowResults({
        workflowName: workflowId,
        runId,
        stepId: getEntryId(step.step),
        result: {
          ...currentResult,
          output: updatedOutput,
        } as any,
        requestContext,
      });

      // Check if inner step is a nested workflow
      const isNestedWorkflow = getEntryWorkflow(step.step) !== null;

      // Resume iterations up to concurrency limit
      // Wrap in try-catch to prevent partial state issues if some publishes fail
      for (const suspIdx of indicesToResume) {
        const targetArray = (prevResult as any)?.output;
        const iterationPrevResult =
          isNestedWorkflow && prevResult.status === 'success' && Array.isArray(targetArray)
            ? { status: 'success' as const, output: targetArray[suspIdx] }
            : prevResult;

        try {
          await pubsub.publish('workflows', {
            type: 'workflow.step.run',
            runId,
            data: {
              parentWorkflow,
              workflowId,
              runId,
              executionPath: [executionPath[0]!, suspIdx],
              resumeSteps,
              timeTravel,
              restart,
              stepResults,
              prevResult: iterationPrevResult,
              resumeData,
              activeStepsPath,
              requestContext,
              perStep,
              state: currentState,
              outputOptions,
            },
          });
        } catch {
          // Log error but continue - the iteration will be picked up on next resume
          // State was already updated, so no data loss
        }
      }
      return;
    }
  }

  const workflowsStore = await mastra.getStorage()?.getStore('workflows');

  if (
    (idx >= targetLen && currentResult?.output?.filter((r: any) => r !== null)?.length >= targetLen) ||
    (prevResult as any)?.output?.length === 0
  ) {
    // Foreach completed all iterations or the previous result is an empty array - advance to next step
    // If the previous result is an empty array, we need to create a new result with an empty array output, save to stroage and stepResults
    let result = currentResult;
    if ((prevResult as any)?.output?.length === 0) {
      result = {
        status: 'success',
        output: [],
        startedAt: Date.now(),
        endedAt: Date.now(),
        payload: (prevResult as any)?.output,
      };
      await workflowsStore?.updateWorkflowResults({
        workflowName: workflowId,
        runId,
        stepId: getEntryId(step.step),
        result,
        requestContext,
      });
      stepResults[getEntryId(step.step)] = result as StepResult<any, any, any, any>;
    }

    await pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
        resumeSteps,
        stepResults,
        timeTravel,
        restart,
        prevResult: result,
        resumeData: undefined, // No resumeData when advancing past foreach
        activeStepsPath,
        requestContext,
        perStep,
        state: currentState,
        outputOptions,
      },
    });

    return;
  } else if (idx >= targetLen) {
    // wait for the 'null' values to be filled from the concurrent run
    return;
  }

  if (executionPath.length === 1 && idx === 0) {
    // on first iteratation we need to kick off up to the set concurrency
    const resolvedConcurrency = resolveForeachConcurrency(step.opts, {
      inputData: (prevResult as any)?.output,
      getInitData: () => (stepResults as any)?.input,
    });
    const concurrency = Math.min(resolvedConcurrency, targetLen);
    const dummyResult = Array.from({ length: concurrency }, () => null);

    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId: getEntryId(step.step),
      result: {
        status: 'success',
        output: dummyResult as any,
        startedAt: Date.now(),
        payload: (prevResult as any)?.output,
      } as any,
      requestContext,
    });

    // Check if inner step is a nested workflow - only then extract individual items
    // Regular steps use foreachIdx in step executor for item extraction
    const isNestedWorkflow = getEntryWorkflow(step.step) !== null;

    for (let i = 0; i < concurrency; i++) {
      // For nested workflows, extract individual item since they receive prevResult directly
      // For regular steps, step executor handles extraction via foreachIdx
      const targetArray = (prevResult as any)?.output;
      const iterationPrevResult =
        isNestedWorkflow && prevResult.status === 'success' && Array.isArray(targetArray)
          ? { status: 'success' as const, output: targetArray[i] }
          : prevResult;
      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath: [executionPath[0]!, i],
          resumeSteps,
          stepResults,
          timeTravel,
          restart,
          prevResult: iterationPrevResult,
          resumeData,
          activeStepsPath,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
    }

    return;
  }

  (currentResult as any).output.push(null);
  await workflowsStore?.updateWorkflowResults({
    workflowName: workflowId,
    runId,
    stepId: getEntryId(step.step),
    result: {
      status: 'success',
      output: (currentResult as any).output,
      startedAt: Date.now(),
      payload: (prevResult as any)?.output,
    } as any,
    requestContext,
  });

  // For nested workflows, extract individual item since they receive prevResult directly
  // For regular steps, step executor handles extraction via foreachIdx
  const isNestedWorkflow = getEntryWorkflow(step.step) !== null;
  const targetArray = (prevResult as any)?.output;
  const iterationPrevResult =
    isNestedWorkflow && prevResult.status === 'success' && Array.isArray(targetArray)
      ? { status: 'success' as const, output: targetArray[idx] }
      : prevResult;

  await pubsub.publish('workflows', {
    type: 'workflow.step.run',
    runId,
    data: {
      parentWorkflow,
      workflowId,
      runId,
      executionPath: [executionPath[0]!, idx],
      resumeSteps,
      timeTravel,
      restart,
      stepResults,
      prevResult: iterationPrevResult,
      resumeData,
      activeStepsPath,
      requestContext,
      perStep,
      state: currentState,
      outputOptions,
    },
  });
}
