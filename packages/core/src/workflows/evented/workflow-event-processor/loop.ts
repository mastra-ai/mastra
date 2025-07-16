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
  console.log('foreach found', step.step.id, prevResult, runCount);

  const concurrency = step.opts.concurrency ?? 1;

  for (let i = 0; i < (prevResult as any).output.length; i += concurrency) {
    const items = (prevResult as any).output.slice(i, i + concurrency);

    await Promise.all(
      items.map(async (_item: any) => {
        return pubsub.publish('workflows', {
          type: 'workflow.step.run',
          data: {
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            prevResult,
            resumeData,
            activeSteps,
            runtimeContext,
          },
        });
      }),
    );
  }
}
