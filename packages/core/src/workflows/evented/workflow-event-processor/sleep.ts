import type { StepFlowEntry, WorkflowRunState, WorkflowSleepTimer } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import { MASTRA_AUTH_TOKEN_KEY } from '../../../request-context';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { StepExecutor } from '../step-executor';
import { getStepId } from './utils';
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
      requestContext: currentState?.requestContext,
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

function sanitizeRequestContext(requestContext: Record<string, any> | undefined): Record<string, any> {
  const sanitized = { ...(requestContext ?? {}) };
  delete sanitized[MASTRA_AUTH_TOKEN_KEY];
  return sanitized;
}

async function updateSleepTimers({
  workflowsStore,
  workflowId,
  runId,
  update,
  requestContext,
}: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  update: (sleepTimers: Record<string, WorkflowSleepTimer>) => Record<string, WorkflowSleepTimer>;
  requestContext?: Record<string, any>;
}) {
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  if (!snapshot || typeof snapshot === 'string') {
    throw new Error(`Workflow snapshot not found for runId ${runId}`);
  }

  const updated = await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: snapshot.status,
      sleepTimers: update(snapshot.sleepTimers ?? {}),
      ...(requestContext ? { requestContext } : {}),
      expectedStatus: snapshot.status,
    },
  });

  return updated !== undefined;
}

async function persistSleepTimer(args: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timer: WorkflowSleepTimer;
  requestContext: Record<string, any>;
}) {
  return updateSleepTimers({
    ...args,
    update: sleepTimers => ({ ...sleepTimers, [args.timer.id]: args.timer }),
  });
}

async function removeSleepTimer(args: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timerId: string;
}) {
  await updateSleepTimers({
    ...args,
    update: sleepTimers => {
      const updated = { ...sleepTimers };
      delete updated[args.timerId];
      return updated;
    },
  });
}

export function schedulePersistedSleepTimer({
  pubsub,
  workflowsStore,
  workflowId,
  runId,
  timer,
  onError,
}: {
  pubsub: PubSub;
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timer: WorkflowSleepTimer;
  onError?: (error: unknown) => void;
}) {
  const callback = async () => {
    const { continuation } = timer;
    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    if (!snapshot || typeof snapshot === 'string') {
      throw new Error(`Workflow snapshot not found for runId ${runId}`);
    }
    if (snapshot.status !== 'running' || !snapshot.sleepTimers?.[timer.id]) {
      return;
    }
    const output = continuation.prevResult.status === 'success' ? continuation.prevResult.output : undefined;

    if (timer.emitStepEvents) {
      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-result',
          payload: {
            id: timer.stepId,
            status: 'success',
            payload: output,
            output,
            startedAt: timer.startedAt,
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
            id: timer.stepId,
            metadata: {},
          },
        },
      });
    }

    await pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        workflowId,
        runId,
        ...continuation,
        stepResults: snapshot.context,
        activeStepsPath: snapshot.activeStepsPath,
        requestContext: snapshot.requestContext,
        state: (snapshot.context as any).__state ?? snapshot.value ?? {},
      },
    });

    await removeSleepTimer({ workflowsStore, workflowId, runId, timerId: timer.id });
  };

  setTimeout(
    () =>
      void callback().catch(error => {
        onError?.(error);
      }),
    Math.max(0, timer.dueAt - Date.now()),
  );
}

async function processSleep(
  args: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
    workflowsStore,
    onError,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleep' | 'sleepUntil' }>;
    workflowsStore: WorkflowsStorage;
    onError?: (error: unknown) => void;
  },
) {
  const {
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    resumeSteps,
    timeTravel,
    restart,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    actor,
    perStep,
    outputOptions,
  } = args;
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

  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);
  const resolveArgs = {
    workflowId,
    step: step as any,
    runId,
    stepResults,
    requestContext: reqContext,
    input: prevResult.status === 'success' ? prevResult.output : undefined,
    resumeData,
    actor,
  };
  const duration =
    step.type === 'sleep'
      ? await stepExecutor.resolveSleep(resolveArgs)
      : await stepExecutor.resolveSleepUntil(resolveArgs);
  const timer: WorkflowSleepTimer = {
    id: `${step.id}:${executionPath.join('.')}`,
    stepId: step.id,
    startedAt,
    dueAt: startedAt + Math.max(0, duration),
    emitStepEvents,
    continuation: {
      executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
      resumeSteps,
      timeTravel,
      restart,
      prevResult: prevResult as WorkflowSleepTimer['continuation']['prevResult'],
      resumeData,
      parentWorkflow,
      actor,
      perStep,
      outputOptions,
    },
  };

  const persisted = await persistSleepTimer({
    workflowsStore,
    workflowId,
    runId,
    timer,
    requestContext: sanitizeRequestContext(requestContext),
  });
  if (!persisted) {
    return;
  }
  schedulePersistedSleepTimer({ pubsub, workflowsStore, workflowId, runId, timer, onError });
}

export async function processWorkflowSleep(
  args: ProcessorArgs,
  dependencies: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
    workflowsStore: WorkflowsStorage;
    onError?: (error: unknown) => void;
  },
) {
  return processSleep(args, dependencies);
}

export async function processWorkflowSleepUntil(
  args: ProcessorArgs,
  dependencies: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
    workflowsStore: WorkflowsStorage;
    onError?: (error: unknown) => void;
  },
) {
  return processSleep(args, dependencies);
}
