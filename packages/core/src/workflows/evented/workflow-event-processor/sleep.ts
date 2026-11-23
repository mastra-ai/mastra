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
  data: Omit<ProcessorArgs, 'workflow' | 'prevResult'> & {
    prevResult: { output: unknown; startedAt: number; metadata?: { startedBy: string } };
  },
  duration: number,
) {
  setLongTimeout(() => {
    const { output } = data.prevResult;
    const prevResult = { status: 'success' as const, payload: output, ...data.prevResult, endedAt: Date.now() };
    pubsub
      .publish('workflows', { type: 'workflow.step.end', runId: data.runId, data: { ...data, prevResult } })
      .catch(error =>
        // No delivery exists to retry this publish: the run stays waiting until it is restarted, as when the broker is down.
        logger?.error('Failed to publish the end of a finished sleep', { runId: data.runId, error }),
      );
  }, duration);
}

/**
 * Saves a starting sleep as `waiting`. With `startedBy` (a store that guards
 * step starts) the sleep is an occurrence like a started step: the write is
 * start-guarded, and its timer's `workflow.step.end` completes it through the
 * step end every step uses. A redelivered start whose sleep already finished
 * is rejected and acknowledged: its timer's end, not this start, continues the
 * run (unlike a step, whose start reclaims a finished result). A start
 * redelivered while the sleep is still `waiting` re-arms the timer; the
 * completion guard lets only one of its ends complete the sleep.
 */
async function saveWaitingSleep(
  runStorage: RunStorage,
  stepId: string,
  startedBy: string | undefined,
  {
    executionPath,
    stepResults,
    activeStepsPath,
    prevResult,
    requestContext,
  }: Pick<ProcessorArgs, 'executionPath' | 'stepResults' | 'activeStepsPath' | 'prevResult' | 'requestContext'>,
) {
  const output = prevResult.status === 'success' ? prevResult.output : undefined;
  const waiting = {
    status: 'waiting' as const,
    payload: output,
    startedAt: Date.now(),
    ...(startedBy && { metadata: { startedBy } }),
  };
  const waitingStepsPath = { ...activeStepsPath, [stepId]: executionPath };
  await runStorage.writeStepResult({
    stepId,
    result: waiting,
    requestContext: withoutAuthToken(requestContext ?? {}),
    ...(startedBy && {
      startGuard: { eventId: startedBy, expectedStartedBy: stepResults[stepId]?.metadata?.startedBy },
    }),
  });
  await runStorage.updateHeader({
    status: 'running',
    activePaths: executionPath,
    activeStepsPath: waitingStepsPath,
  });
  return { output, waiting, waitingStepsPath };
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
    startedBy,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    runStorage: RunStorage;
    logger?: IMastraLogger;
    /** The delivery's event id when the store guards this start (see `saveWaitingSleep`). */
    startedBy?: string;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
  },
) {
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
  // `workflows` routing publishes below are never gated — they drive execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;
  const { output, waiting, waitingStepsPath } = await saveWaitingSleep(runStorage, step.id, startedBy, {
    executionPath,
    stepResults,
    activeStepsPath,
    prevResult,
    requestContext,
  });

  if (emitStepEvents) {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-waiting',
        payload: { id: step.id, status: 'waiting', payload: output, startedAt: waiting.startedAt },
      },
    });
  }

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
      prevResult: { output, startedAt: waiting.startedAt, ...(waiting.metadata && { metadata: waiting.metadata }) },
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
    startedBy,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    runStorage: RunStorage;
    logger?: IMastraLogger;
    /** The delivery's event id when the store guards this start (see `saveWaitingSleep`). */
    startedBy?: string;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
  },
) {
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
  // `workflows` routing publish below is never gated — it drives execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;

  const { output, waiting, waitingStepsPath } = await saveWaitingSleep(runStorage, step.id, startedBy, {
    executionPath,
    stepResults,
    activeStepsPath,
    prevResult,
    requestContext,
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
          payload: output,
          startedAt: waiting.startedAt,
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
      prevResult: { output, startedAt: waiting.startedAt, ...(waiting.metadata && { metadata: waiting.metadata }) },
      requestContext,
      actor,
      perStep,
      state,
      outputOptions,
    },
    duration,
  );
}
