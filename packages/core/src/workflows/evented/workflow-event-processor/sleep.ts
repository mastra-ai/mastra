import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { IMastraLogger } from '../../../logger';
import type { RunStorage } from '../../run-storage';
import { setLongTimeout } from '../../utils';
import { withoutAuthToken } from '../helpers';
import type { StepExecutor } from '../step-executor';
import { getStepId } from './utils';
import type { ProcessorArgs } from '.';

/**
 * When a sleep's timer fires, publish the `workflow.step.end` a finished step
 * publishes. The timer runs outside any event delivery, so it does no storage
 * work itself: `handle()` persists the sleep's result, retries storage errors,
 * drops the event for a canceled run, and routes to the next step.
 */
function endSleepOnTimer(
  pubsub: PubSub,
  logger: IMastraLogger | undefined,
  data: Omit<ProcessorArgs, 'workflow' | 'prevResult'> & { prevResult: { output: unknown; startedAt: number } },
  duration: number,
) {
  setLongTimeout(() => {
    const { output, startedAt } = data.prevResult;
    const prevResult = { status: 'success' as const, payload: output, output, startedAt, endedAt: Date.now() };
    pubsub
      .publish('workflows', { type: 'workflow.step.end', runId: data.runId, data: { ...data, prevResult } })
      .catch(error =>
        // No delivery exists to retry this publish: the run stays waiting until it is restarted, as when the broker is down.
        logger?.error('Failed to publish the end of a finished sleep', { runId: data.runId, error }),
      );
  }, duration);
}

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

  const currentStepId = getStepId(workflowData.workflow, executionPath);
  const prevResult = {
    status: 'success',
    output: currentState?.context[currentStepId ?? 'input']?.payload,
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
      activeStepsPath: {},
      requestContext: withoutAuthToken(currentState?.requestContext),
      // Known gap (deliberately deferred — PR #24569 review, Superagent P2):
      // the actor signal is not persisted in the workflow snapshot, so a run
      // continued from a waitForEvent only keeps the actor if the resuming
      // event carried one. requestContext survives via the snapshot; actor
      // does not. Consequence: an FGA-gated tool with `requireActor` fails
      // closed after the wait even though the originating caller was
      // authorized, and permissive paths run unattributed. Intended fix:
      // persist the ActorSignal (a plain identity claim, no secret material)
      // in the snapshot alongside requestContext and restore it here with an
      // event-carried actor taking precedence: `workflowData.actor ?? snapshot`.
      actor: workflowData.actor,
      perStep: workflowData.perStep,
    },
  });
}

export async function processWorkflowSleep(
  {
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeStepsPath,
    resumeSteps,
    timeTravel,
    restart,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    actor,
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    runStorage,
    step,
    logger,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    runStorage: RunStorage;
    logger?: IMastraLogger;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
  },
) {
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
  // `workflows` routing publishes below are never gated — they drive execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;
  const startedAt = Date.now();
  if (emitStepEvents) {
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
  }

  const output = prevResult.status === 'success' ? prevResult.output : undefined;
  const waiting = { status: 'waiting' as const, payload: output, startedAt };
  const waitingStepsPath = { ...activeStepsPath, [step.id]: executionPath };
  await runStorage.writeStepResult({
    stepId: step.id,
    result: waiting,
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
  await runStorage.updateHeader({
    status: 'running',
    activePaths: executionPath,
    activeStepsPath: waitingStepsPath,
  });

  // Create a proper RequestContext from the plain object passed in ProcessorArgs
  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);

  const duration = await stepExecutor.resolveSleep({
    workflowId,
    step,
    runId,
    stepResults,
    requestContext: reqContext,
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    actor,
  });

  endSleepOnTimer(
    pubsub,
    logger,
    {
      workflowId,
      runId,
      executionPath,
      resumeSteps,
      timeTravel,
      restart,
      resumeData,
      parentWorkflow,
      stepResults: { ...stepResults, [step.id]: waiting },
      activeStepsPath: waitingStepsPath,
      prevResult: { output, startedAt },
      requestContext,
      actor,
      perStep,
      state,
      outputOptions,
    },
    duration,
  );
}

export async function processWorkflowSleepUntil(
  {
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeStepsPath,
    resumeSteps,
    timeTravel,
    restart,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    actor,
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    runStorage,
    step,
    logger,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    runStorage: RunStorage;
    logger?: IMastraLogger;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
  },
) {
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
  // `workflows` routing publish below is never gated — it drives execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;
  const startedAt = Date.now();

  const output = prevResult.status === 'success' ? prevResult.output : undefined;
  const waiting = { status: 'waiting' as const, payload: output, startedAt };
  const waitingStepsPath = { ...activeStepsPath, [step.id]: executionPath };
  await runStorage.writeStepResult({
    stepId: step.id,
    result: waiting,
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
  await runStorage.updateHeader({
    status: 'running',
    activePaths: executionPath,
    activeStepsPath: waitingStepsPath,
  });

  // Create a proper RequestContext from the plain object passed in ProcessorArgs
  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);

  const duration = await stepExecutor.resolveSleepUntil({
    workflowId,
    step,
    runId,
    stepResults,
    requestContext: reqContext,
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
    actor,
  });

  if (emitStepEvents) {
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
  }

  endSleepOnTimer(
    pubsub,
    logger,
    {
      workflowId,
      runId,
      executionPath,
      resumeSteps,
      timeTravel,
      restart,
      resumeData,
      parentWorkflow,
      stepResults: { ...stepResults, [step.id]: waiting },
      activeStepsPath: waitingStepsPath,
      prevResult: { output, startedAt },
      requestContext,
      actor,
      perStep,
      state,
      outputOptions,
    },
    duration,
  );
}
