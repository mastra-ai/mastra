import type { StepFlowEntry, StepResult } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { Mastra } from '../../../mastra';
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
    activeSteps,
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
  const prevIterationCount = stepResults[step.step?.id]?.metadata?.iterationCount ?? 0;
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

  if (step.loopType === 'dountil') {
    if (loopCondition) {
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
    } else {
      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          state: currentState,
          outputOptions,
          prevResult: stepResult,
          resumeData,
          activeSteps,
          requestContext,
          retryCount,
          perStep,
        },
      });
    }
  } else {
    if (loopCondition) {
      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
          requestContext,
          retryCount,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
    } else {
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
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
    activeSteps,
    resumeSteps,
    timeTravel,
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
    step.step.id
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
          activeSteps,
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
      const isNestedWorkflow = (step.step as any).component === 'WORKFLOW';
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
          stepResults,
          prevResult: iterationPrevResult,
          resumeData,
          activeSteps,
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
      // Collect resumeLabels from all suspended iterations
      const collectedResumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
      for (let i = 0; i < currentResult.output.length; i++) {
        const iterResult = currentResult.output[i];
        if (iterResult?.status === 'suspended' && iterResult.suspendPayload?.__workflow_meta?.resumeLabels) {
          Object.assign(collectedResumeLabels, iterResult.suspendPayload.__workflow_meta.resumeLabels);
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
            [step.step.id]: {
              ...currentResult,
              status: 'suspended',
              suspendedAt: Date.now(),
              suspendPayload: { __workflow_meta: suspendMeta },
            },
          },
          prevResult: {
            status: 'suspended',
            output: currentResult.output,
            suspendPayload: { __workflow_meta: suspendMeta },
            payload: currentResult.payload,
            startedAt: currentResult.startedAt,
            suspendedAt: Date.now(),
          },
          activeSteps,
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
      const concurrency = step.opts.concurrency ?? 1;
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
        stepId: step.step.id,
        result: {
          ...currentResult,
          output: updatedOutput,
        } as any,
        requestContext,
      });

      // Check if inner step is a nested workflow
      const isNestedWorkflow = (step.step as any).component === 'WORKFLOW';

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
              stepResults,
              prevResult: iterationPrevResult,
              resumeData,
              activeSteps,
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

  if (idx >= targetLen && currentResult.output.filter((r: any) => r !== null).length >= targetLen) {
    // Foreach completed all iterations - advance to next step
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
        prevResult: currentResult,
        resumeData: undefined, // No resumeData when advancing past foreach
        activeSteps,
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

  const workflowsStore = await mastra.getStorage()?.getStore('workflows');

  if (executionPath.length === 1 && idx === 0) {
    // on first iteratation we need to kick off up to the set concurrency
    const concurrency = Math.min(step.opts.concurrency ?? 1, targetLen);
    const dummyResult = Array.from({ length: concurrency }, () => null);

    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId: step.step.id,
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
    const isNestedWorkflow = (step.step as any).component === 'WORKFLOW';

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
          prevResult: iterationPrevResult,
          resumeData,
          activeSteps,
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
    stepId: step.step.id,
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
  const isNestedWorkflow = (step.step as any).component === 'WORKFLOW';
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
      stepResults,
      prevResult: iterationPrevResult,
      resumeData,
      activeSteps,
      requestContext,
      perStep,
      state: currentState,
      outputOptions,
    },
  });
}
