import EventEmitter from 'events';
import type { StepFlowEntry } from '../..';
import { RuntimeContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { StepExecutor } from '../step-executor';
import type { ProcessorArgs } from '.';

export async function processWorkflowSleep(
  {
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
  },
) {
  const duration = await stepExecutor.resolveSleep({
    step,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });

  setTimeout(
    async () => {
      return pubsub.publish('workflows', {
        type: 'workflow.step.run',
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resume,
          stepResults,
          prevResult,
          resumeData,
          parentWorkflow,
          activeSteps,
        },
      });
    },
    duration < 0 ? 0 : duration,
  );
}

export async function processWorkflowSleepUntil(
  {
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
  },
) {
  const duration = await stepExecutor.resolveSleepUntil({
    step,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });

  setTimeout(
    async () => {
      return pubsub.publish('workflows', {
        type: 'workflow.step.run',
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resume,
          stepResults,
          prevResult,
          resumeData,
          parentWorkflow,
          activeSteps,
        },
      });
    },
    duration < 0 ? 0 : duration,
  );
}
