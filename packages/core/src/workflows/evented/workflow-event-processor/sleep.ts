import { randomUUID } from 'node:crypto';
import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { WorkflowsStorage } from '../../../storage/domains/workflows/base';
import type { StepExecutor } from '../step-executor';
import { getStepId } from './utils';
import type { ProcessorArgs } from '.';

const sleepTimerHandles = new WeakMap<PubSub, Set<ReturnType<typeof setTimeout>>>();

function scheduleSleepTimer(pubsub: PubSub, callback: () => Promise<void>, delay: number): void {
  let handles = sleepTimerHandles.get(pubsub);
  if (!handles) {
    handles = new Set();
    sleepTimerHandles.set(pubsub, handles);
  }
  const handle = setTimeout(() => {
    handles!.delete(handle);
    void callback();
  }, delay);
  handles.add(handle);
}

export function clearLocalSleepTimers(pubsub: PubSub): void {
  const handles = sleepTimerHandles.get(pubsub);
  if (!handles) return;
  for (const handle of handles) clearTimeout(handle);
  handles.clear();
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

async function persistSleepTimer({
  workflowsStore,
  workflowId,
  runId,
  timer,
}: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timer: NonNullable<WorkflowRunState['sleepTimers']>[string];
}) {
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  if (!snapshot || typeof snapshot === 'string') {
    throw new Error(`Workflow snapshot not found for runId ${runId}`);
  }

  await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: snapshot.status,
      sleepTimers: {
        ...(snapshot.sleepTimers ?? {}),
        [timer.id]: timer,
      },
      expectedStatus: snapshot.status,
    },
  });
}

async function claimSleepTimer({
  workflowsStore,
  workflowId,
  runId,
  timerId,
}: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timerId: string;
}) {
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const timer = snapshot?.sleepTimers?.[timerId];
  if (!timer || timer.status !== 'pending') return;

  const claimToken = randomUUID();
  const updated = await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: snapshot.status,
      sleepTimers: {
        ...snapshot.sleepTimers,
        [timerId]: { ...timer, status: 'claimed', claimToken, claimedAt: Date.now() },
      },
      expectedStatus: snapshot.status,
      expectedSleepTimer: { id: timerId, status: 'pending' },
    },
  });

  return updated ? claimToken : undefined;
}

async function releaseSleepTimer({
  workflowsStore,
  workflowId,
  runId,
  timerId,
  claimToken,
}: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timerId: string;
  claimToken: string;
}) {
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  const timer = snapshot?.sleepTimers?.[timerId];
  if (!snapshot || !timer) return;
  await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: snapshot.status,
      sleepTimers: {
        ...snapshot.sleepTimers,
        [timerId]: { ...timer, status: 'pending', claimToken: undefined, claimedAt: undefined },
      },
      expectedStatus: snapshot.status,
      expectedSleepTimer: { id: timerId, status: 'claimed', claimToken },
    },
  });
}

async function completeSleepTimer({
  workflowsStore,
  workflowId,
  runId,
  timerId,
  claimToken,
}: {
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timerId: string;
  claimToken: string;
}) {
  const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
  if (!snapshot?.sleepTimers?.[timerId]) return;
  const sleepTimers = { ...snapshot.sleepTimers };
  delete sleepTimers[timerId];
  await workflowsStore.updateWorkflowState({
    workflowName: workflowId,
    runId,
    opts: {
      status: snapshot.status,
      sleepTimers,
      expectedStatus: snapshot.status,
      expectedSleepTimer: { id: timerId, status: 'claimed', claimToken },
    },
  });
}

export function recoverWorkflowSleepTimer({
  pubsub,
  workflowsStore,
  workflowId,
  runId,
  timer,
  emitStepEvents,
}: {
  pubsub: PubSub;
  workflowsStore: WorkflowsStorage;
  workflowId: string;
  runId: string;
  timer: NonNullable<WorkflowRunState['sleepTimers']>[string];
  emitStepEvents: boolean;
}): void {
  scheduleSleepTimer(
    pubsub,
    async () => {
      const claimToken = await claimSleepTimer({ workflowsStore, workflowId, runId, timerId: timer.id });
      if (!claimToken) return;

      try {
        const { continuation } = timer;
        if (emitStepEvents) {
          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: {
              type: 'workflow-step-result',
              payload: {
                id: timer.stepId,
                status: 'success',
                payload: continuation.prevResult.status === 'success' ? continuation.prevResult.output : undefined,
                output: continuation.prevResult.status === 'success' ? continuation.prevResult.output : undefined,
                startedAt: timer.startedAt,
                endedAt: Date.now(),
              },
            },
          });
          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: { type: 'workflow-step-finish', payload: { id: timer.stepId, metadata: {} } },
          });
        }

        await pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: { workflowId, runId, ...continuation },
        });
        await completeSleepTimer({ workflowsStore, workflowId, runId, timerId: timer.id, claimToken });
      } catch (error) {
        await releaseSleepTimer({ workflowsStore, workflowId, runId, timerId: timer.id, claimToken });
        throw error;
      }
    },
    Math.max(0, timer.dueAt - Date.now()),
  );
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
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
    workflowsStore,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
    workflowsStore: WorkflowsStorage;
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
  const delay = Math.max(0, duration);
  const timerId = `${step.id}:${executionPath.join('.')}`;
  await persistSleepTimer({
    workflowsStore,
    workflowId,
    runId,
    timer: {
      id: timerId,
      stepId: step.id,
      kind: 'sleep',
      startedAt,
      dueAt: startedAt + delay,
      status: 'pending',
      continuation: {
        executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
        stepResults: stepResults as any,
        activeStepsPath,
        resumeSteps,
        prevResult: prevResult as any,
        requestContext,
        timeTravel,
        restart,
        resumeData,
        parentWorkflow,
        actor,
        perStep,
      },
    },
  });

  scheduleSleepTimer(
    pubsub,
    async () => {
      const claimToken = await claimSleepTimer({ workflowsStore, workflowId, runId, timerId });
      if (!claimToken) return;

      try {
        if (emitStepEvents) {
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
        }

        await pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: {
            workflowId,
            runId,
            executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
            resumeSteps,
            timeTravel,
            restart,
            stepResults,
            prevResult,
            resumeData,
            parentWorkflow,
            activeStepsPath,
            requestContext,
            actor,
            perStep,
          },
        });
        await completeSleepTimer({ workflowsStore, workflowId, runId, timerId, claimToken });
      } catch (error) {
        await releaseSleepTimer({ workflowsStore, workflowId, runId, timerId, claimToken });
        throw error;
      }
    },
    delay,
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
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
    workflowsStore,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
    workflowsStore: WorkflowsStorage;
  },
) {
  // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
  // `workflows` routing publish below is never gated — it drives execution.
  const emitStepEvents = workflow.options.emitStepEvents !== false;
  const startedAt = Date.now();

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
  const delay = Math.max(0, duration);
  const timerId = `${step.id}:${executionPath.join('.')}`;
  await persistSleepTimer({
    workflowsStore,
    workflowId,
    runId,
    timer: {
      id: timerId,
      stepId: step.id,
      kind: 'sleepUntil',
      startedAt,
      dueAt: startedAt + delay,
      status: 'pending',
      continuation: {
        executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
        stepResults: stepResults as any,
        activeStepsPath,
        resumeSteps,
        prevResult: prevResult as any,
        requestContext,
        timeTravel,
        restart,
        resumeData,
        parentWorkflow,
        actor,
        perStep,
      },
    },
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

  scheduleSleepTimer(
    pubsub,
    async () => {
      const claimToken = await claimSleepTimer({ workflowsStore, workflowId, runId, timerId });
      if (!claimToken) return;

      try {
        if (emitStepEvents) {
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
        }

        await pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: {
            workflowId,
            runId,
            executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
            resumeSteps,
            timeTravel,
            restart,
            stepResults,
            prevResult,
            resumeData,
            parentWorkflow,
            activeStepsPath,
            requestContext,
            actor,
            perStep,
          },
        });
        await completeSleepTimer({ workflowsStore, workflowId, runId, timerId, claimToken });
      } catch (error) {
        await releaseSleepTimer({ workflowsStore, workflowId, runId, timerId, claimToken });
        throw error;
      }
    },
    delay,
  );
}
