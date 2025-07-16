import EventEmitter from 'events';
import type { StepFlowEntry, StepResult } from '../..';
import { RuntimeContext } from '../../../di';
import type { PubSub } from '../../../events';
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
    runtimeContext,
    runCount = 0,
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
  console.log('loop found', step.step.id, stepResult, runCount);
  const loopCondition = await stepExecutor.evaluateCondition({
    condition: step.condition,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    inputData: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    abortController: new AbortController(),
    runCount,
  });

  if (step.loopType === 'dountil') {
    if (loopCondition) {
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
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
          runtimeContext,
        },
      });
    } else {
      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
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
          runtimeContext,
          runCount,
        },
      });
    }
  } else {
    if (loopCondition) {
      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
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
          runtimeContext,
          runCount,
        },
      });
    } else {
      await pubsub.publish('workflows', {
        type: 'workflow.step.end',
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
          runtimeContext,
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
    resumeData,
    parentWorkflow,
    runtimeContext,
    runCount = 0,
  }: ProcessorArgs,
  {
    pubsub,
    step,
  }: {
    pubsub: PubSub;
    step: Extract<StepFlowEntry, { type: 'foreach' }>;
  },
) {
  // TODO: concurrency
  const currentResult: Extract<StepResult<any, any, any, any>, { status: 'success' }> = stepResults[
    step.step.id
  ] as any;

  const idx = currentResult?.output?.length ?? 0;
  console.log('foreach found', step.step.id, idx, prevResult, runCount);

  const targetLen = (prevResult as any)?.output?.length ?? 0;

  if (idx >= targetLen) {
    await pubsub.publish('workflows', {
      type: 'workflow.step.run',
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
        resumeSteps,
        stepResults,
        prevResult: currentResult,
        resumeData,
        activeSteps,
        runtimeContext,
      },
    });

    return;
  }

  await pubsub.publish('workflows', {
    type: 'workflow.step.run',
    data: {
      parentWorkflow,
      workflowId,
      runId,
      executionPath: [executionPath[0]!, idx],
      resumeSteps,
      stepResults,
      prevResult,
      resumeData,
      activeSteps,
      runtimeContext,
    },
  });
}
