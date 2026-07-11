import type { StepFlowEntry } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
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
    if (nestedStep?.type === 'step') {
      //if restart, only run the step if it's in the active steps path
      if (restart) {
        pathsToRun[nestedStep.step.id] = !!restart.activeStepsPath[nestedStep.step.id];
      } else {
        pathsToRun[nestedStep.step.id] = true;
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
    step.steps?.map(async (nestedStep, idx) => {
      if (!pathsToRun[nestedStep.step.id]) {
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

  let onlyStepToRun: Extract<StepFlowEntry, { type: 'step' }> | undefined;

  if (perStep) {
    const stepsToRun = step.steps.filter((_, idx) => truthyIdxs[idx]);
    onlyStepToRun = stepsToRun[0];
  }

  if (onlyStepToRun) {
    const stepIndex = step.steps.findIndex(step => step.step.id === onlyStepToRun.step.id);
    activeStepsPath[onlyStepToRun.step.id] = executionPath.concat([stepIndex]);
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
      step.steps.map(async (step, idx) => {
        if (truthyIdxs[idx]) {
          if (step?.type === 'step') {
            activeStepsPath[step.step.id] = executionPath.concat([idx]);
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
