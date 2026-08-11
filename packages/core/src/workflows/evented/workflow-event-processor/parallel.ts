import type { SingleStepEntry, StepFlowEntry } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import { getSingleStepEntryId } from '../../utils';
import { resolveCurrentState } from '../helpers';
import type { StepExecutor } from '../step-executor';
import type { ProcessorArgs } from '.';

export async function processWorkflowParallel(
  {
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
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    step,
  }: {
    pubsub: PubSub;
    step: Extract<StepFlowEntry, { type: 'parallel' }>;
  },
) {
  const pathsToRun: Record<string, boolean> = {};
  // Get current state from stepResults or passed state
  const currentState = resolveCurrentState({ stepResults, state });
  for (let i = 0; i < step.steps.length; i++) {
    const nestedStep = step.steps[i];
    if (nestedStep) {
      const nestedStepId = getSingleStepEntryId(nestedStep);
      //if restart, only run the step if it's in the active steps path
      if (restart) {
        pathsToRun[nestedStepId] = !!restart.activeStepsPath[nestedStepId];
      } else {
        pathsToRun[nestedStepId] = true;
      }
      if (perStep) {
        break;
      }
    }
  }

  await Promise.all(
    // Iterate the full steps array and guard inside so `idx` stays the branch's
    // real index. Filtering first and using the post-filter index would route a
    // restart to the wrong branch when the active branches are not a zero-based
    // contiguous prefix (mirrors `processWorkflowConditional` below).
    step.steps?.map(async (child, idx) => {
      if (!pathsToRun[getSingleStepEntryId(child)]) {
        return;
      }
      return pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: restart ? executionPath.slice(0, -1).concat([idx]) : executionPath.concat([idx]),
          resumeSteps,
          stepResults,
          prevResult,
          resumeData,
          timeTravel,
          restart: restart ? { ...restart, isParallelOrConditionalRestarted: true } : undefined,
          parentWorkflow,
          activeStepsPath,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
      });
    }),
  );
}

export async function processWorkflowConditional(
  {
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
    perStep,
    state,
    outputOptions,
  }: ProcessorArgs,
  {
    pubsub,
    stepExecutor,
    step,
  }: {
    pubsub: PubSub;
    stepExecutor: StepExecutor;
    step: Extract<StepFlowEntry, { type: 'conditional' }>;
  },
) {
  // Get current state from stepResults or passed state
  const currentState = resolveCurrentState({ stepResults, state });

  // Create a proper RequestContext from the plain object passed in ProcessorArgs
  const reqContext = new RequestContext(Object.entries(requestContext ?? {}) as any);

  const idxs = await stepExecutor.evaluateConditions({
    workflowId,
    step,
    runId,
    stepResults,
    state: currentState,
    requestContext: reqContext,
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });

  const truthyIdxs: Record<number, boolean> = {};
  for (let i = 0; i < idxs.length; i++) {
    truthyIdxs[idxs[i]!] = true;
  }

  let onlyStepToRun: SingleStepEntry | undefined;

  if (perStep) {
    const stepsToRun = step.steps.filter((_, idx) => truthyIdxs[idx]);
    onlyStepToRun = stepsToRun[0];
  }

  if (onlyStepToRun) {
    const onlyStepToRunId = getSingleStepEntryId(onlyStepToRun);
    const stepIndex = step.steps.findIndex(child => getSingleStepEntryId(child) === onlyStepToRunId);
    activeStepsPath[onlyStepToRunId] = executionPath.concat([stepIndex]);
    await pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        workflowId,
        runId,
        executionPath: executionPath.concat([stepIndex]),
        resumeSteps,
        stepResults,
        timeTravel,
        restart,
        prevResult,
        resumeData,
        parentWorkflow,
        activeStepsPath,
        requestContext,
        perStep,
        state: currentState,
        outputOptions,
      },
    });
  } else {
    await Promise.all(
      step.steps.map(async (child, idx) => {
        if (truthyIdxs[idx]) {
          if (child) {
            activeStepsPath[getSingleStepEntryId(child)] = executionPath.concat([idx]);
          }
          return pubsub.publish('workflows', {
            type: 'workflow.step.run',
            runId,
            data: {
              workflowId,
              runId,
              executionPath: executionPath.concat([idx]),
              resumeSteps,
              stepResults,
              timeTravel,
              restart: restart ? { ...restart, isParallelOrConditionalRestarted: true } : undefined,
              prevResult,
              resumeData,
              parentWorkflow,
              activeStepsPath,
              requestContext,
              perStep,
              state: currentState,
              outputOptions,
            },
          });
        } else {
          return pubsub.publish('workflows', {
            type: 'workflow.step.end',
            runId,
            data: {
              workflowId,
              runId,
              executionPath: executionPath.concat([idx]),
              resumeSteps,
              stepResults,
              prevResult: { status: 'skipped' },
              resumeData,
              parentWorkflow,
              activeStepsPath,
              requestContext,
              perStep,
              state: currentState,
              outputOptions,
            },
          });
        }
      }),
    );
  }
}
