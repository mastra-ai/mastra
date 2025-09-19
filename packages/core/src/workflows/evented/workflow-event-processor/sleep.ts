import EventEmitter from 'events';
import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RuntimeContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { StepExecutor } from '../step-executor';
import { getStep } from './utils';
import type { ProcessorArgs } from '.';

export async function processWorkflowWaitForEvent(
  workflowData: ProcessorArgs,
  {
    pubsub,
    eventName,
    currentState,
  }: {
    pubsub: PubSub;
    eventName: string;
    currentState: WorkflowRunState;
  },
) {
  const executionPath = currentState?.waitingPaths[eventName];
  if (!executionPath) {
    return;
  }

  const currentStep = getStep(workflowData.workflow, executionPath);
  const prevResult = {
    status: 'success',
    output: currentState?.context[currentStep?.id ?? 'input']?.payload,
  };

  await pubsub.publish('workflows', {
    type: 'workflow.step.run',
    runId: workflowData.runId,
    data: {
      workflowId: workflowData.workflowId,
      runId: workflowData.runId,
      executionPath,
      resumeSteps: [],
      resumeData: workflowData.resumeData,
      parentWorkflow: workflowData.parentWorkflow,
      stepResults: currentState?.context,
      prevResult,
      activeSteps: [],
      runtimeContext: currentState?.runtimeContext,
    },
  });
}

export async function processWorkflowSleep(
  {
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resumeSteps,
    prevResult,
    resumeData,
    parentWorkflow,
    runtimeContext,
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
  const startedAt = Date.now();
  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'workflow-step-waiting',
      payload: {
        id: step.id,
        status: 'waiting',
        payload: prevResult.status === 'success' ? prevResult.output : undefined,
        startedAt,
      },
    },
  });

  const duration = await stepExecutor.resolveSleep({
    workflowId,
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
      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            status: 'success',
            payload: prevResult.status === 'success' ? prevResult.output : undefined,
            output: prevResult.status === 'success' ? prevResult.output : undefined,
            startedAt,
            endedAt: Date.now(),
          },
        },
      });

      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            metadata: {},
          },
        },
      });

      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resumeSteps,
          stepResults,
          prevResult,
          resumeData,
          parentWorkflow,
          activeSteps,
          runtimeContext,
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
    resumeSteps,
    prevResult,
    resumeData,
    parentWorkflow,
    runtimeContext,
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
  const startedAt = Date.now();
  const duration = await stepExecutor.resolveSleepUntil({
    workflowId,
    step,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });

  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'workflow-step-waiting',
      payload: {
        id: step.id,
        status: 'waiting',
        payload: prevResult.status === 'success' ? prevResult.output : undefined,
        startedAt,
      },
    },
  });

  setTimeout(
    async () => {
      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-result',
          payload: {
            id: step.id,
            status: 'success',
            payload: prevResult.status === 'success' ? prevResult.output : undefined,
            output: prevResult.status === 'success' ? prevResult.output : undefined,
            startedAt,
            endedAt: Date.now(),
          },
        },
      });

      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-finish',
          payload: {
            id: step.id,
            metadata: {},
          },
        },
      });

      await pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resumeSteps,
          stepResults,
          prevResult,
          resumeData,
          parentWorkflow,
          activeSteps,
          runtimeContext,
        },
      });
    },
    duration < 0 ? 0 : duration,
  );
}
