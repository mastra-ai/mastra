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
    activeSteps.push(executionPath.concat([i]));
  }

  await Promise.all(
    step.steps.map(async (_step, idx) => {
      return pubsub.publish('workflows', {
        type: 'workflow.step.run',
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
  console.log('conditional found');
  const idxs = await stepExecutor.evaluateConditions({
    step,
    runId,
    stepResults,
    emitter: new EventEmitter() as any, // TODO
    runtimeContext: new RuntimeContext(), // TODO
    input: prevResult?.status === 'success' ? prevResult.output : undefined,
    resumeData,
  });
  console.log('conditional idxs', idxs);

  const truthyIdxs: Record<number, boolean> = {};
  for (let i = 0; i < idxs.length; i++) {
    activeSteps.push(executionPath.concat([idxs[i]!]));
    truthyIdxs[idxs[i]!] = true;
  }

  await Promise.all(
    step.steps.map(async (_step, idx) => {
      if (truthyIdxs[idx]) {
        console.log('suhh: running conditional step', executionPath.concat([idx]));
        return pubsub.publish('workflows', {
          type: 'workflow.step.run',
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
        console.log('suhh: skipping conditional step', executionPath.concat([idx]));
        return pubsub.publish('workflows', {
          type: 'workflow.step.end',
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
