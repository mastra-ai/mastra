import EventEmitter from 'node:events';
import type { StepFlowEntry, StepResult } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { Mastra } from '../../../mastra';
import type { StepExecutor } from '../step-executor';
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
  const currentState = (stepResult as any)?.__state ?? stepResults?.__state ?? state ?? {};

  const loopCondition = await stepExecutor.evaluateCondition({
    workflowId,
    condition: step.condition,
    runId,
    stepResults,
    state: currentState,
    emitter: new EventEmitter() as any, // TODO
    requestContext: new RequestContext(), // TODO
    inputData: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    abortController: new AbortController(),
    retryCount,
    iterationCount: 0, //TODO: implement
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
  const currentState = stepResults?.__state ?? state ?? {};
  const currentResult: Extract<StepResult<any, any, any, any>, { status: 'success' }> = stepResults[
    step.step.id
  ] as any;

  const idx = currentResult?.output?.length ?? 0;
  const targetLen = (prevResult as any)?.output?.length ?? 0;

  // Handle resume with forEachIndex: kick off the targeted iteration resume
  if (forEachIndex !== undefined && resumeSteps?.length > 0 && idx > 0) {
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
    }
    return;
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
