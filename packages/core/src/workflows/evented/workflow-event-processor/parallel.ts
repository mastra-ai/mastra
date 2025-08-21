import EventEmitter from 'events';
import type { StepFlowEntry } from '../..';
import { RuntimeContext } from '../../../di';
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
    prevResult,
    resumeData,
    parentWorkflow,
    runtimeContext,
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
    }
  }

  await Promise.all(
    step.steps.map(async (_step, idx) => {
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
          parentWorkflow,
          activeSteps,
          runtimeContext,
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
    step: Extract<StepFlowEntry, { type: 'conditional' }>;
  },
) {
  const idxs = await stepExecutor.evaluateConditions({
    workflowId,
    step,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });

  const truthyIdxs: Record<number, boolean> = {};
  for (let i = 0; i < idxs.length; i++) {
    truthyIdxs[idxs[i]!] = true;
  }

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
            prevResult,
            resumeData,
            parentWorkflow,
            activeSteps,
            runtimeContext,
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
            runtimeContext,
          },
        });
      }
    }),
  );
}
