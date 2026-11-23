import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RequestContext } from '../../../di';
import { getErrorFromUnknown } from '../../../error';
import type { PubSub } from '../../../events';
import type { IMastraLogger } from '../../../logger';
import type { RunStorage } from '../../run-storage';
import { setLongTimeout } from '../../utils';
import { withoutAuthToken } from '../helpers';
import type { StepExecutor } from '../step-executor';
import { getStepId } from './utils';
import type { ProcessorArgs } from '.';

/**
 * Run a sleep's finish on its timer. The timer fires outside any event
 * delivery, so a rejection there would leave the run `waiting` with nobody
 * to retry it. Fail the run instead, the way the processor fails an event
 * whose handler threw: `workflow.fail` is a delivered event, retried by the
 * transport and dropped for a run canceled meanwhile.
 */
function setSleepTimer(
  pubsub: PubSub,
  run: Pick<
    ProcessorArgs,
    | 'workflowId'
    | 'runId'
    | 'resumeSteps'
    | 'stepResults'
    | 'resumeData'
    | 'parentWorkflow'
    | 'requestContext'
    | 'actor'
  >,
  logger: IMastraLogger | undefined,
  finish: () => Promise<void>,
  duration: number,
) {
  setLongTimeout(() => {
    void finish().catch(error =>
      pubsub
        .publish('workflows', {
          type: 'workflow.fail',
          runId: run.runId,
          data: {
            ...run,
            executionPath: [],
            prevResult: { status: 'failed', error: getErrorFromUnknown(error).toJSON() },
            activeStepsPath: {},
          },
        })
        .catch(publishError =>
          logger?.error('Sleep timer could not finish or fail its run; the run stays waiting', {
            runId: run.runId,
            error,
            publishError,
          }),
        ),
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

  await runStorage.writeStepResult({
    stepId: step.id,
    result: {
      status: 'waiting',
      payload: prevResult.status === 'success' ? prevResult.output : undefined,
      startedAt,
    },
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
  await runStorage.updateHeader({
    status: 'running',
    activePaths: executionPath,
    activeStepsPath: { ...activeStepsPath, [step.id]: executionPath },
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

  setSleepTimer(
    pubsub,
    { workflowId, runId, resumeSteps, stepResults, resumeData, parentWorkflow, requestContext, actor },
    logger,
    async () => {
      // The timer outlives cancel: keep a canceled run's sleep unfinished and silent.
      if ((await runStorage.loadHeader())?.status === 'canceled') return;
      const output = prevResult.status === 'success' ? prevResult.output : undefined;
      const result = { status: 'success' as const, payload: output, output, startedAt, endedAt: Date.now() };
      await runStorage.writeStepResult({
        stepId: step.id,
        result,
        requestContext: withoutAuthToken(requestContext ?? {}),
      });

      if (emitStepEvents) {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-result',
            payload: { id: step.id, ...result },
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
          stepResults: { ...stepResults, [step.id]: result },
          prevResult,
          resumeData,
          parentWorkflow,
          activeStepsPath,
          requestContext,
          actor,
          perStep,
        },
      });
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

  await runStorage.writeStepResult({
    stepId: step.id,
    result: {
      status: 'waiting',
      payload: prevResult.status === 'success' ? prevResult.output : undefined,
      startedAt,
    },
    requestContext: withoutAuthToken(requestContext ?? {}),
  });
  await runStorage.updateHeader({
    status: 'running',
    activePaths: executionPath,
    activeStepsPath: { ...activeStepsPath, [step.id]: executionPath },
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

  setSleepTimer(
    pubsub,
    { workflowId, runId, resumeSteps, stepResults, resumeData, parentWorkflow, requestContext, actor },
    logger,
    async () => {
      // The timer outlives cancel: keep a canceled run's sleep unfinished and silent.
      if ((await runStorage.loadHeader())?.status === 'canceled') return;
      const output = prevResult.status === 'success' ? prevResult.output : undefined;
      const result = { status: 'success' as const, payload: output, output, startedAt, endedAt: Date.now() };
      await runStorage.writeStepResult({
        stepId: step.id,
        result,
        requestContext: withoutAuthToken(requestContext ?? {}),
      });

      if (emitStepEvents) {
        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-result',
            payload: { id: step.id, ...result },
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
          stepResults: { ...stepResults, [step.id]: result },
          prevResult,
          resumeData,
          parentWorkflow,
          activeStepsPath,
          requestContext,
          actor,
          perStep,
        },
      });
    },
    duration,
  );
}
