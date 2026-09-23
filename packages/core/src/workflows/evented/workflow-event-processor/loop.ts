import type { StepFlowEntry, StepResult } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { Mastra } from '../../../mastra';
import { getEntryId, getEntryWorkflow } from '../../step-entry';
import { resolveForeachConcurrency } from '../../utils';
import { getPersistedRequestContext, resolveCurrentState } from '../helpers';
import type { StepExecutor } from '../step-executor';
import { createPendingMarker } from '../types';
import {
  aggregateEventedForeachSuspensions,
  assertValidEventedForeachSuspensionResults,
  isEventedForeachSuspensionResult,
  restoreEventedForeachSuspensionPayloads,
} from './foreach-suspension';
import type { ProcessorArgs } from '.';

const FOREACH_QUEUED = '__mastra_foreach_queued__';

export function isQueuedForeachIteration(value: unknown): value is { [FOREACH_QUEUED]: true } {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.hasOwn(value, FOREACH_QUEUED) &&
    (value as Record<string, unknown>)[FOREACH_QUEUED] === true &&
    Object.keys(value).length === 1
  );
}

export async function processWorkflowLoop(
  {
    workflowId,
    prevResult,
    runId,
    executionGeneration,
    lifecycleResumeAttempt,
    lifecycleStepStates,
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
    mastra,
    stepExecutor,
    step,
    stepResult,
  }: {
    pubsub: PubSub;
    mastra: Mastra;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'loop' }>;
    stepResult: StepResult<any, any, any, any>;
  },
) {
  const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };

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

  const previousLoopResult = stepResults[getEntryId(step.step)] ?? stepResult;
  const previousLoopMetadata = previousLoopResult?.metadata ?? {};
  const { nestedRunId: _completedNestedRunId, ...nextIterationMetadata } = previousLoopMetadata;
  const nextIterationResult: StepResult<any, any, any, any> = {
    ...previousLoopResult,
    metadata: { ...nextIterationMetadata, iterationCount },
  };

  // When the loop body runs again, it's a fresh iteration — not a resume — so drop any
  // resume metadata. Otherwise the body would keep receiving the same resumeData on every
  // iteration (and e.g. never re-suspend).
  const loopAgainData = {
    ...lifecycleExecution,
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
      // A nested workflow owner belongs only to the iteration that just
      // completed. Clear it at the same boundary that advances the iteration
      // counter so the next delivery derives and atomically binds a new child
      // run id instead of reusing the completed child.
      [getEntryId(step.step)]: nextIterationResult,
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
    ...lifecycleExecution,
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
  const persistNextIteration = async () => {
    const workflowsStore = await mastra.getStorage()?.getStore('workflows');
    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId: getEntryId(step.step),
      result: nextIterationResult,
      requestContext: getPersistedRequestContext(requestContext),
      executionGeneration: lifecycleExecution.executionGeneration,
    });
  };

  if (step.loopType === 'dountil') {
    if (loopCondition) {
      await pubsub.publish('workflows', { type: 'workflow.step.end', runId, data: loopEndData });
    } else {
      await persistNextIteration();
      await pubsub.publish('workflows', { type: 'workflow.step.run', runId, data: loopAgainData });
    }
  } else {
    if (loopCondition) {
      await persistNextIteration();
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
    executionGeneration,
    lifecycleResumeAttempt,
    lifecycleStepStates,
    executionPath,
    stepResults,
    activeStepsPath,
    resumeSteps,
    timeTravel,
    restart,
    resumeData,
    resumeLabel,
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
  const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };
  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);

  // Get current state from stepResults or passed state
  const currentState = resolveCurrentState({ stepResults, state });
  const currentResult: Extract<StepResult<any, any, any, any>, { status: 'success' }> = stepResults[
    getEntryId(step.step)
  ] as any;
  let durableIterationResults: unknown[] | undefined;

  try {
    if (Array.isArray(currentResult?.output)) {
      assertValidEventedForeachSuspensionResults(currentResult.output);
      durableIterationResults = restoreEventedForeachSuspensionPayloads(
        currentResult.output,
        currentResult.suspendPayload?.__workflow_meta?.foreachOutput,
      );
    }
  } catch (error) {
    await pubsub.publish('workflows', {
      type: 'workflow.fail',
      runId,
      data: {
        ...lifecycleExecution,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults,
        prevResult: {
          status: 'failed',
          error: error instanceof Error ? error : new Error('Invalid evented foreach suspension state'),
        },
        activeStepsPath,
        requestContext,
        state: currentState,
        outputOptions,
      },
    });
    return;
  }

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
          ...lifecycleExecution,
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
    if (isEventedForeachSuspensionResult(iterationResult) || iterationResult === null) {
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
          ...lifecycleExecution,
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
          resumeLabel,
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
    const hasActiveIterations = currentResult.output.some((result: any) => result === null);
    if (hasActiveIterations) {
      // A sibling is already in flight. Its completion event owns the next
      // transition; persisting a label-less suspension here would orphan it.
      return;
    }

    const suspendedIterations = currentResult.output.filter(isEventedForeachSuspensionResult);
    if (suspendedIterations.length > 0) {
      // Collect every iteration's durable suspension state. The step-level
      // payload still mirrors the first suspension for user-facing compatibility.
      let suspension: ReturnType<typeof aggregateEventedForeachSuspensions>;
      try {
        suspension = aggregateEventedForeachSuspensions(durableIterationResults ?? currentResult.output);
      } catch (error) {
        await pubsub.publish('workflows', {
          type: 'workflow.fail',
          runId,
          data: {
            ...lifecycleExecution,
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            prevResult: {
              status: 'failed',
              error: error instanceof Error ? error : new Error('Invalid workflow resume label metadata'),
            },
            activeStepsPath,
            requestContext,
            state: currentState,
            outputOptions,
          },
        });
        return;
      }
      if (!suspension) return;

      // Build the suspend metadata with all collected resumeLabels
      const suspendMeta: {
        foreachIndex?: number;
        resumeLabels?: Record<string, { stepId: string; foreachIndex?: number }>;
      } = {
        foreachIndex: suspension.firstSuspendedIndex,
      };
      if (Object.keys(suspension.resumeLabels).length > 0) {
        suspendMeta.resumeLabels = suspension.resumeLabels;
      }

      const aggregatedSuspendPayload = {
        ...suspension.firstSuspendPayload,
        __workflow_meta: {
          ...(suspension.firstSuspendPayload?.__workflow_meta ?? {}),
          ...suspendMeta,
          foreachOutput: suspension.foreachOutput,
        },
      };

      // Re-suspend the workflow - there are still pending iterations
      // Use workflow.step.end with suspended status to update storage
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          ...lifecycleExecution,
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
      if (isEventedForeachSuspensionResult(iterResult)) {
        suspendedIndices.push(i);
      }
    }

    if (suspendedIndices.length > 0) {
      // Limit resumption to concurrency value (like initial execution)
      const concurrency = resolveForeachConcurrency(step.opts, {
        inputData: (prevResult as any)?.output,
        getInitData: () => (stepResults as any)?.input,
        requestContext: reqContext,
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
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
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
              ...lifecycleExecution,
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
  const stepId = getEntryId(step.step);
  const preservedForeachOutput = currentResult?.suspendPayload?.__workflow_meta?.foreachOutput;
  const preservedForeachEntries = Array.isArray(preservedForeachOutput)
    ? preservedForeachOutput
    : preservedForeachOutput && typeof preservedForeachOutput === 'object'
      ? preservedForeachOutput
      : undefined;

  // Time travel reconstructs the target step without its output. Restore only
  // durable successes and queue every failed or unfinished iteration for replay.
  if (
    timeTravel &&
    (!Array.isArray(currentResult?.output) ||
      currentResult.output.length === 0 ||
      currentResult.output.some((result: any) => result?.status === 'failed')) &&
    preservedForeachEntries &&
    Object.keys(preservedForeachEntries).length > 0
  ) {
    const progressLength = Math.max(
      targetLen,
      ...Object.keys(preservedForeachEntries)
        .map(Number)
        .filter(Number.isSafeInteger)
        .map(index => index + 1),
    );
    currentResult.output = Array.from({ length: progressLength }, (_unused, index) => {
      const iterationResult = (preservedForeachEntries as Record<number, any>)[index];
      return iterationResult?.status === 'success'
        ? iterationResult.output
        : ({ [FOREACH_QUEUED]: true } as { [FOREACH_QUEUED]: true });
    });

    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId,
      result: currentResult,
      requestContext: getPersistedRequestContext(requestContext),
      executionGeneration: lifecycleExecution.executionGeneration,
    });
    stepResults[stepId] = currentResult;
  }

  const queuedIndices = Array.isArray(currentResult?.output)
    ? currentResult.output.flatMap((result: any, index: number) => (isQueuedForeachIteration(result) ? [index] : []))
    : [];
  if (queuedIndices.length > 0) {
    const concurrency = resolveForeachConcurrency(step.opts, {
      inputData: (prevResult as any)?.output,
      getInitData: () => (stepResults as any)?.input,
      requestContext: reqContext,
    });
    const runningCount = currentResult.output.filter((result: any) => result === null).length;
    const indicesToRun = queuedIndices.slice(0, Math.max(0, concurrency - runningCount));

    if (indicesToRun.length > 0) {
      const updatedOutput = [...currentResult.output];
      for (const index of indicesToRun) {
        updatedOutput[index] = createPendingMarker() as any;
      }
      await workflowsStore?.updateWorkflowResults({
        workflowName: workflowId,
        runId,
        stepId,
        result: { ...currentResult, output: updatedOutput } as any,
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
      });

      const isNestedWorkflow = getEntryWorkflow(step.step) !== null;
      for (const index of indicesToRun) {
        const targetArray = (prevResult as any)?.output;
        const iterationPrevResult =
          isNestedWorkflow && prevResult.status === 'success' && Array.isArray(targetArray)
            ? { status: 'success' as const, output: targetArray[index] }
            : prevResult;
        await pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: {
            ...lifecycleExecution,
            parentWorkflow,
            workflowId,
            runId,
            executionPath: [executionPath[0]!, index],
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
    }
    return;
  }

  if (
    (idx >= targetLen &&
      currentResult?.output?.filter((r: any) => r !== null && !isQueuedForeachIteration(r))?.length >= targetLen) ||
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
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
      });
      stepResults[getEntryId(step.step)] = result as StepResult<any, any, any, any>;
    } else if (result) {
      // A completed foreach must not carry the aggregate suspension envelope
      // into its terminal snapshot. Resume history can remain, but routing and
      // per-iteration suspend payloads are no longer live.
      const { suspendPayload: _suspendPayload, suspendOutput: _suspendOutput, ...completedResult } = result as any;
      result = completedResult;
      await workflowsStore?.updateWorkflowResults({
        workflowName: workflowId,
        runId,
        stepId: getEntryId(step.step),
        result: { ...result, suspendPayload: undefined, suspendOutput: undefined } as any,
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
      });
      stepResults[getEntryId(step.step)] = result as any;
    }

    await pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        ...lifecycleExecution,
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
      requestContext: reqContext,
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
      requestContext: getPersistedRequestContext(requestContext),
      executionGeneration: lifecycleExecution.executionGeneration,
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
          ...lifecycleExecution,
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
    requestContext: getPersistedRequestContext(requestContext),
    executionGeneration: lifecycleExecution.executionGeneration,
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
      ...lifecycleExecution,
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
