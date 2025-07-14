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
    resume,
    resumeData,
    parentWorkflow,
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
  console.log('loop found', step.step.id, stepResult);
  const loopCondition = await stepExecutor.evaluateCondition({
    condition: step.condition,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    inputData: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    abortController: new AbortController(),
    runCount: 0,
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
          resume,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
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
          resume,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
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
          resume,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
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
          resume,
          stepResults,
          prevResult: stepResult,
          resumeData,
          activeSteps,
        },
      });
    }
  }
}
