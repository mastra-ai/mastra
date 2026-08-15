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
  it('keeps legacy operation IDs for an ordinary one-shot step', async () => {
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const stepId = 'one-shot-step';
    const engine = new RecordingExecutionEngine({ mastra: undefined });
    const step = {
      id: stepId,
      inputSchema: z.any(),
      outputSchema: z.any(),
      execute: async ({ inputData }: any) => inputData,
    };

    await engine.executeStep({
      workflowId,
      runId,
      step,
      prevOutput: { value: 'input' },
      stepResults: {},
      serializedStepGraph: [],
      executionContext: createExecutionContext(workflowId, runId),
      pubsub: new EventEmitterPubSub(),
      abortController: new AbortController(),
      requestContext: new RequestContext(),
      tracingContext: {},
    });

    expect(engine.operationIds).toEqual([
      'workflow.test-workflow.run.test-run.step.one-shot-step.span.start',
      'workflow.test-workflow.run.test-run.step.one-shot-step.running_ev',
      'workflow.test-workflow.run.test-run.path.[0].stepUpdate.start',
      'workflow.test-workflow.step.one-shot-step',
      'workflow.test-workflow.run.test-run.step.one-shot-step.emit_result',
      'workflow.test-workflow.run.test-run.step.one-shot-step.span.end',
    ]);
  });

  it('distinguishes loop iterations and repeated resumes of the same iteration', async () => {
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const stepId = 'loop-step';
    const engine = new RecordingExecutionEngine({ mastra: undefined });
    const stepResults = {} as Record<string, StepResult<any, any, any, any>>;
    let executions = 0;
    const executionContext = createExecutionContext(workflowId, runId);
    const step = {
      id: stepId,
      inputSchema: z.any(),
      outputSchema: z.object({ iteration: z.number() }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspend }: any) => {
        executions++;
        if (executions === 2 || executions === 3) {
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
        step: { type: 'step' as const, step },
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
    expect((suspended as any).suspendPayload.__workflow_meta.resumeGeneration).toBe(0);

    const suspendedAgain = await engine.executeLoop({
      ...params,
      resume: {
        steps: [stepId],
        stepResults,
        resumePayload: { approved: true },
        resumePath: [0],
      },
    });
    expect(suspendedAgain.status).toBe('suspended');
    expect((suspendedAgain as any).suspendPayload.__workflow_meta.resumeGeneration).toBe(1);

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
      'workflow.test-workflow.run.test-run.step.loop-step.path.[0].iteration.2.resume.1.span.start',
    );
    expect(engine.operationIds).toContain(
      'workflow.test-workflow.run.test-run.step.loop-step.path.[0].iteration.2.resume.2.span.start',
    );
    expect(engine.operationIds).toContain('workflow.test-workflow.step.loop-step.path.[0].iteration.2.resume.1');
    expect(engine.operationIds).toContain('workflow.test-workflow.step.loop-step.path.[0].iteration.2.resume.2');
  });

  it.each([
    {
      payloadType: 'array',
      suspendSchema: z.array(z.string()),
      suspendPayload: ['first', 'second'],
    },
    {
      payloadType: 'scalar',
      suspendSchema: z.string(),
      suspendPayload: 'approval required',
    },
    {
      payloadType: 'date',
      suspendSchema: z.date(),
      suspendPayload: new Date('2026-08-11T12:00:00.000Z'),
    },
  ])('preserves $payloadType suspend payloads when resuming', async ({ suspendSchema, suspendPayload }) => {
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const stepId = 'suspend-payload-step';
    const engine = new RecordingExecutionEngine({ mastra: undefined });
    const executionContext = createExecutionContext(workflowId, runId);
    let receivedSuspendData: unknown;
    const step = {
      id: stepId,
      inputSchema: z.any(),
      outputSchema: z.any(),
      suspendSchema,
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspendData, suspend }: any) => {
        if (!resumeData) {
          await suspend(suspendPayload);
          return undefined;
        }

        receivedSuspendData = suspendData;
        return suspendData;
      },
    };
    const params = {
      workflowId,
      runId,
      step,
      prevOutput: null,
      serializedStepGraph: [],
      executionContext,
      pubsub: new EventEmitterPubSub(),
      abortController: new AbortController(),
      requestContext: new RequestContext(),
      tracingContext: {},
    };

    const suspended = await engine.executeStep({ ...params, stepResults: {} });
    expect(suspended.result.status).toBe('suspended');

    const resumed = await engine.executeStep({
      ...params,
      stepResults: suspended.stepResults,
      resume: {
        steps: [stepId],
        stepResults: suspended.stepResults,
        resumePayload: { approved: true },
        resumePath: [0],
      },
    });

    expect(resumed.result.status).toBe('success');
    expect(receivedSuspendData).toEqual(suspendPayload);
    expect((resumed.result as any).output).toEqual(suspendPayload);
  });

  it('distinguishes concurrent foreach items even when their values repeat', async () => {
    const workflowId = 'test-workflow';
    const runId = 'test-run';
    const stepId = 'foreach-step';
    const engine = new RecordingExecutionEngine({ mastra: undefined });
    const step = {
      id: stepId,
      inputSchema: z.string(),
      outputSchema: z.string(),
      execute: async ({ inputData }: any) => inputData,
    };

    const result = await engine.executeForeach({
      workflowId,
      runId,
      entry: { type: 'foreach', step: { type: 'step', step }, opts: { concurrency: 3 } },
      prevStep: { type: 'step', step },
      prevOutput: ['same-value', 'same-value', 'same-value'],
      stepResults: {},
      serializedStepGraph: [],
      executionContext: createExecutionContext(workflowId, runId),
      pubsub: new EventEmitterPubSub(),
      abortController: new AbortController(),
      requestContext: new RequestContext(),
      tracingContext: {},
    });

    expect(result).toMatchObject({ status: 'success', output: ['same-value', 'same-value', 'same-value'] });
    expect(new Set(engine.operationIds).size).toBe(engine.operationIds.length);
    expect(engine.operationIds).toEqual(
      expect.arrayContaining([
        'workflow.test-workflow.step.foreach-step.path.[0].foreach.0',
        'workflow.test-workflow.step.foreach-step.path.[0].foreach.1',
        'workflow.test-workflow.step.foreach-step.path.[0].foreach.2',
      ]),
    );
  });
});

function createExecutionContext(workflowId: string, runId: string): ExecutionContext {
  return {
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
}
