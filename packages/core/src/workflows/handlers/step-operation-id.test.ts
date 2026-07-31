import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../di';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { DefaultExecutionEngine } from '../default';
import type { ExecutionContext, StepResult } from '../types';

class RecordingExecutionEngine extends DefaultExecutionEngine {
  readonly operationIds: string[] = [];

  override async wrapDurableOperation<T>(operationId: string, operationFn: () => Promise<T>): Promise<T> {
    this.operationIds.push(operationId);
    return operationFn();
  }

  override async createStepSpan(params: Parameters<DefaultExecutionEngine['createStepSpan']>[0]): Promise<undefined> {
    this.operationIds.push(params.operationId);
    return undefined;
  }

  override async endStepSpan(params: Parameters<DefaultExecutionEngine['endStepSpan']>[0]): Promise<void> {
    this.operationIds.push(params.operationId);
  }
}

describe('step durable operation IDs', () => {
  it('distinguishes loop iterations and the resumed iteration', async () => {
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const stepId = 'loop-step';
    const engine = new RecordingExecutionEngine({ mastra: undefined });
    const stepResults = {} as Record<string, StepResult<any, any, any, any>>;
    let executions = 0;
    const executionContext: ExecutionContext = {
      workflowId,
      runId,
      executionPath: [0],
      stepExecutionPath: [],
      activeStepsPath: {},
      suspendedPaths: {},
      resumeLabels: {},
      retryConfig: { attempts: 0, delay: 0 },
      state: {},
    };
    const step = {
      id: stepId,
      inputSchema: z.any(),
      outputSchema: z.object({ iteration: z.number() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspend }: any) => {
        executions++;
        if (executions === 2 && !resumeData) {
          await suspend({ reason: 'approval' });
        }
        return { iteration: resumeData ? 2 : executions };
      },
    };
    const params = {
      workflowId,
      runId,
      entry: {
        type: 'loop' as const,
        step,
        condition: async ({ inputData }: any) => inputData.iteration === 2,
        loopType: 'dountil' as const,
      },
      prevStep: { type: 'step' as const, step },
      prevOutput: null,
      stepResults,
      serializedStepGraph: [],
      executionContext,
      pubsub: new EventEmitterPubSub(),
      abortController: new AbortController(),
      requestContext: new RequestContext(),
      tracingContext: {},
    };

    const suspended = await engine.executeLoop(params);
    expect(suspended.status).toBe('suspended');

    const resumed = await engine.executeLoop({
      ...params,
      resume: {
        steps: [stepId],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [0],
      },
    });
    expect(resumed.status).toBe('success');

    expect(new Set(engine.operationIds).size).toBe(engine.operationIds.length);
    expect(engine.operationIds).toContain(
      'workflow.test-workflow.run.test-run.step.loop-step.path.[0].iteration.2.resume.span.start',
    );
    expect(engine.operationIds).toContain('workflow.test-workflow.step.loop-step.path.[0].iteration.2.resume');
  });
});
