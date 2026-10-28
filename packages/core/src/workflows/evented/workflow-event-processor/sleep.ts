import type { StepFlowEntry, WorkflowRunState } from '../..';
import { RequestContext } from '../../../di';
import { getErrorFromUnknown } from '../../../error';
import type { PubSub } from '../../../events';
import { SpanType, executionFailureTermination } from '../../../observability';
import type { TracingContext } from '../../../observability';
import type { WorkflowsStorage } from '../../../storage/domains/workflows';
import { workflowTermination, completeWorkflowSpan } from '../../execution-outcome';
import { getControlFlowIdentityAttributes } from '../../handlers/control-flow';
import { withoutAuthToken } from '../helpers';

import type { StepExecutor } from '../step-executor';
import { getStepId } from './utils';
import type { ProcessorArgs } from '.';

async function startWaitSpan(
  step: Extract<StepFlowEntry, { type: 'sleep' | 'sleepUntil' }>,
  tracingContext?: TracingContext,
) {
  const parent = tracingContext?.currentSpan;
  const span = parent?.createChildSpan({
    type: SpanType.WORKFLOW_SLEEP,
    outcome: null,
    name:
      step.type === 'sleep'
        ? `sleep: ${step.duration ? `${step.duration}ms` : 'dynamic'}`
        : `sleepUntil: ${step.date ? step.date.toISOString() : 'dynamic'}`,
    attributes: {
      ...getControlFlowIdentityAttributes(step),
      sleepType: step.fn ? 'dynamic' : 'fixed',
      ...(step.type === 'sleep' ? { durationMs: step.duration } : { untilDate: step.date }),
    },
  });
  const finish = (completion: Parameters<typeof completeWorkflowSpan>[1]) => completeWorkflowSpan(span, completion);
  return {
    span,
    async complete() {
      await finish({ end: workflowTermination({ status: 'success' }) });
    },
    async fail(error: unknown) {
      await finish({ error: { ...executionFailureTermination(error), error: getErrorFromUnknown(error) } });
    },
  };
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
    workflowsStore,
    step,
    tracingContext,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    tracingContext?: TracingContext;
    workflowsStore?: WorkflowsStorage;
    step: Extract<StepFlowEntry, { type: 'sleep' }>;
  },
) {
  const tracing = await startWaitSpan(step, tracingContext);
  try {
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

    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId: step.id,
      result: {
        status: 'waiting',
        payload: prevResult.status === 'success' ? prevResult.output : undefined,
        startedAt,
      },
      requestContext: withoutAuthToken(requestContext ?? {}),
    });
    await workflowsStore?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: 'running',
        activePaths: executionPath,
        activeStepsPath: { ...activeStepsPath, [step.id]: executionPath },
      },
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
      tracingContext: { currentSpan: tracing.span },
    });

    tracing.span?.update({ attributes: { durationMs: Math.max(0, duration) } });
    setTimeout(
      async () => {
        await tracing.complete();

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
      },
      duration < 0 ? 0 : duration,
    );
  } catch (error) {
    await tracing.fail(error);
    throw error;
  }
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
    workflowsStore,
    step,
    tracingContext,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    tracingContext?: TracingContext;
    workflowsStore?: WorkflowsStorage;
    step: Extract<StepFlowEntry, { type: 'sleepUntil' }>;
  },
) {
  const tracing = await startWaitSpan(step, tracingContext);
  try {
    // Step-lifecycle watch events honor `emitStepEvents: false` (#21529); the
    // `workflows` routing publish below is never gated — it drives execution.
    const emitStepEvents = workflow.options.emitStepEvents !== false;
    const startedAt = Date.now();

    await workflowsStore?.updateWorkflowResults({
      workflowName: workflowId,
      runId,
      stepId: step.id,
      result: {
        status: 'waiting',
        payload: prevResult.status === 'success' ? prevResult.output : undefined,
        startedAt,
      },
      requestContext: withoutAuthToken(requestContext ?? {}),
    });
    await workflowsStore?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: 'running',
        activePaths: executionPath,
        activeStepsPath: { ...activeStepsPath, [step.id]: executionPath },
      },
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
      tracingContext: { currentSpan: tracing.span },
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

    tracing.span?.update({ attributes: { durationMs: Math.max(0, duration) } });
    setTimeout(
      async () => {
        await tracing.complete();

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
      },
      duration < 0 ? 0 : duration,
    );
  } catch (error) {
    await tracing.fail(error);
    throw error;
  }
}
