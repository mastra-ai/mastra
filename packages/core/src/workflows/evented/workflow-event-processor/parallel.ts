import EventEmitter from 'node:events';
import type { StepFlowEntry } from '../..';
import { RequestContext } from '../../../di';
import type { PubSub } from '../../../events';
import type { StepExecutor } from '../step-executor';
import type { ProcessorArgs } from '.';

export async function processWorkflowParallel(
  {
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resumeSteps,
    timeTravel,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    perStep,
  }: ProcessorArgs,
  {
    pubsub,
    step,
  }: {
    pubsub: PubSub;
    step: Extract<StepFlowEntry, { type: 'parallel' }>;
  },
) {
  for (let i = 0; i < step.steps.length; i++) {
    const nestedStep = step.steps[i];
    if (nestedStep?.type === 'step') {
      activeSteps[nestedStep.step.id] = true;
      if (perStep) {
        break;
      }
    }
  }

  await Promise.all(
    step.steps
      ?.filter(step => activeSteps[step.step.id])
      .map(async (_step, idx) => {
        return pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: {
            workflowId,
            runId,
            executionPath: executionPath.concat([idx]),
            resumeSteps,
            stepResults,
            prevResult,
            resumeData,
            timeTravel,
            parentWorkflow,
            activeSteps,
            requestContext,
            perStep,
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
    activeSteps,
    resumeSteps,
    timeTravel,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    perStep,
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
  const idxs = await stepExecutor.evaluateConditions({
    workflowId,
    step,
    runId,
    stepResults,
    // TODO: implement state
    state: {},
    emitter: new EventEmitter() as any, // TODO
    requestContext: new RequestContext(), // TODO
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
    activeSteps[onlyStepToRun.step.id] = true;
    const stepIndex = step.steps.findIndex(step => step.step.id === onlyStepToRun.step.id);
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
        prevResult,
        resumeData,
        parentWorkflow,
        activeSteps,
        requestContext,
        perStep,
      },
    });
  } else {
    await Promise.all(
      step.steps.map(async (step, idx) => {
        if (truthyIdxs[idx]) {
          if (step?.type === 'step') {
            activeSteps[step.step.id] = true;
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
              prevResult,
              resumeData,
              parentWorkflow,
              activeSteps,
              requestContext,
              perStep,
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
              activeSteps,
              requestContext,
              perStep,
            },
          });
        }
      }),
    );
  }
}
