import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { DefaultStepResult } from '../stream/aisdk/v5/output-helpers';
import { createWorkflow } from './create';
import { serializeWorkflowSnapshotValue } from './snapshot-serialization';
import { validateStepResumeData } from './utils';
import { createStep } from './workflow';

describe('workflow snapshot size', () => {
  const falsyResumePayloadCases = [
    ['false', false],
    ['0', 0],
    ['null', null],
    ['empty string', ''],
  ] as const;

  it('does not carry a previous loop iteration output into a later suspended step snapshot', async () => {
    const storage = new MockStore();
    const largePayload = `large-loop-payload:${'x'.repeat(64 * 1024)}`;
    let executionCount = 0;

    const loopStep = createStep({
      id: 'loop-step',
      inputSchema: z.object({
        iteration: z.number(),
        payload: z.string().optional(),
      }),
      outputSchema: z.object({
        iteration: z.number(),
        payload: z.string(),
      }),
      suspendSchema: z.object({ reason: z.string() }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        executionCount++;

        if (executionCount === 2 && !resumeData) {
          await suspend({ reason: 'Need approval' });
          return {
            iteration: inputData.iteration,
            payload: inputData.payload ?? largePayload,
          };
        }

        return {
          iteration: inputData.iteration + 1,
          payload: largePayload,
        };
      },
    });

    const workflow = createWorkflow({
      id: 'snapshot-size-loop',
      inputSchema: z.object({
        iteration: z.number(),
        payload: z.string().optional(),
      }),
      outputSchema: z.object({
        iteration: z.number(),
        payload: z.string(),
      }),
      options: { validateInputs: false },
    })
      .dowhile(loopStep, async ({ inputData }) => inputData.iteration < 2)
      .commit();

    new Mastra({
      logger: false,
      storage,
      workflows: { 'snapshot-size-loop': workflow },
    });

    const run = await workflow.createRun({ runId: 'snapshot-size-loop-run' });
    const result = await run.start({ inputData: { iteration: 0 } });

    expect(result.status).toBe('suspended');

    const workflowsStore = await storage.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'snapshot-size-loop',
      runId: 'snapshot-size-loop-run',
    });
    const stepResult = snapshot?.context?.['loop-step'];

    expect(stepResult?.status).toBe('suspended');
    expect(stepResult).not.toHaveProperty('output');
    expect(stepResult).not.toHaveProperty('endedAt');
  });

  it.each(falsyResumePayloadCases)(
    'preserves %s resume payloads when rebuilding resumed step state',
    async (_, resumePayload) => {
      const storage = new MockStore();

      const approvalStep = createStep({
        id: 'approval-step',
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.any() }),
        suspendSchema: z.object({ reason: z.string() }),
        resumeSchema: z.union([z.literal(false), z.literal(0), z.null(), z.literal('')]),
        execute: async ({ resumeData, suspend }) => {
          if (resumeData === undefined) {
            await suspend({ reason: 'Need approval' });
            return { value: false };
          }

          return { value: resumeData };
        },
      });

      const workflow = createWorkflow({
        id: `snapshot-size-falsy-resume-${String(resumePayload)}`,
        inputSchema: z.object({}),
        outputSchema: z.object({ value: z.any() }),
        options: { validateInputs: false },
      })
        .then(approvalStep)
        .commit();

      new Mastra({
        logger: false,
        storage,
        workflows: { [workflow.id]: workflow },
      });

      const run = await workflow.createRun({ runId: `snapshot-size-falsy-resume-${String(resumePayload)}-run` });
      const suspended = await run.start({ inputData: {} });
      expect(suspended.status).toBe('suspended');

      const resumed = await run.resume({ resumeData: resumePayload });
      expect(resumed).toMatchObject({
        status: 'success',
        result: { value: resumePayload },
      });

      const workflowsStore = await storage.getStore('workflows');
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: `snapshot-size-falsy-resume-${String(resumePayload)}-run`,
      });
      const stepResult = snapshot?.context?.['approval-step'];

      expect(stepResult).toMatchObject({
        status: 'success',
        resumePayload,
        output: { value: resumePayload },
      });
      expect(stepResult?.resumedAt).toEqual(expect.any(Number));
    },
  );

  it('preserves toJSON-backed user outputs while serializing workflow snapshots', async () => {
    const storage = new MockStore();
    const url = new URL('https://example.com/snapshot-output');

    const urlStep = createStep({
      id: 'url-step',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      execute: async () => url,
    });

    const suspendStep = createStep({
      id: 'suspend-step',
      inputSchema: z.any(),
      outputSchema: z.object({ ok: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      execute: async ({ suspend }) => {
        await suspend({ reason: 'Need approval' });
        return { ok: true };
      },
    });

    const workflow = createWorkflow({
      id: 'snapshot-size-to-json-output',
      inputSchema: z.object({}),
      outputSchema: z.object({ ok: z.boolean() }),
      options: { validateInputs: false },
    })
      .then(urlStep)
      .then(suspendStep)
      .commit();

    new Mastra({
      logger: false,
      storage,
      workflows: { 'snapshot-size-to-json-output': workflow },
    });

    const run = await workflow.createRun({ runId: 'snapshot-size-to-json-output-run' });
    const result = await run.start({ inputData: {} });
    expect(result.status).toBe('suspended');

    const workflowsStore = await storage.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'snapshot-size-to-json-output',
      runId: 'snapshot-size-to-json-output-run',
    });

    expect(snapshot?.context?.['url-step']?.output).toBe(url.toJSON());
  });

  it('serializes final workflow snapshot results without changing live step result JSON output', async () => {
    const storage = new MockStore();
    const messages = [
      { role: 'assistant', content: [{ type: 'text', text: 'first' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'second' }] },
    ];

    const agentStep = createStep({
      id: 'agent-step',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      execute: async () => ({
        steps: [
          new DefaultStepResult({
            content: [{ type: 'text', text: 'second' }] as any,
            finishReason: 'stop' as any,
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } as any,
            warnings: [],
            request: {},
            response: {
              id: 'response-1',
              timestamp: new Date(0),
              modelId: 'model',
              messages,
            } as any,
            providerMetadata: undefined,
            serializedResponseMessages: [messages[1]] as any,
          }),
        ],
      }),
    });

    const workflow = createWorkflow({
      id: 'snapshot-size-final-result',
      inputSchema: z.object({}),
      outputSchema: z.any(),
      options: { validateInputs: false },
    })
      .then(agentStep)
      .commit();

    new Mastra({
      logger: false,
      storage,
      workflows: { 'snapshot-size-final-result': workflow },
    });

    const run = await workflow.createRun({ runId: 'snapshot-size-final-result-run' });
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    if (result.status !== 'success') throw new Error('Expected workflow to succeed');
    expect(JSON.parse(JSON.stringify(result.result)).steps[0].response.messages).toHaveLength(2);

    const workflowsStore = await storage.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: 'snapshot-size-final-result',
      runId: 'snapshot-size-final-result-run',
    });

    expect(snapshot?.result?.steps[0].response.messages).toEqual([messages[1]]);
    expect(snapshot?.context?.['agent-step']?.output.steps[0].response.messages).toEqual([messages[1]]);
  });

  it('preserves plain object toJSON hooks while serializing workflow snapshots', () => {
    const userOutput = {
      secret: 'do-not-store',
      toJSON: () => ({ publicValue: 'stored' }),
    };

    expect(serializeWorkflowSnapshotValue({ output: userOutput })).toEqual({
      output: { publicValue: 'stored' },
    });
  });

  it('serializes toJSON methods that return the source object without treating them as circular', () => {
    const userOutput = {
      value: 'stored',
      toJSON() {
        return this;
      },
    };

    expect(serializeWorkflowSnapshotValue({ output: userOutput })).toEqual({
      output: { value: 'stored' },
    });
    expect(JSON.stringify(serializeWorkflowSnapshotValue({ output: userOutput }))).toBe(
      JSON.stringify({ output: { value: 'stored' } }),
    );
  });

  it('serializes enumerable class fields with circular references safely', () => {
    class UserOutput {
      value = 'stored';
      self: unknown;

      constructor() {
        this.self = this;
      }
    }

    expect(serializeWorkflowSnapshotValue({ output: new UserOutput() })).toEqual({
      output: { value: 'stored', self: '[Circular]' },
    });
  });

  it.each(falsyResumePayloadCases)('validates %s resume payloads as explicit resume data', async (_, resumeData) => {
    const step = createStep({
      id: 'falsy-resume-validation-step',
      inputSchema: z.object({}),
      outputSchema: z.object({ value: z.any() }),
      resumeSchema: z.union([z.literal(false), z.literal(0), z.null(), z.literal('')]),
      execute: async ({ resumeData }) => ({ value: resumeData }),
    });

    await expect(validateStepResumeData({ resumeData, step })).resolves.toEqual({
      resumeData,
      validationError: undefined,
    });
  });

  it('does not call user-defined toWorkflowSnapshot methods during snapshot serialization', () => {
    const userOutput = {
      value: 'preserve me',
      toWorkflowSnapshot: () => {
        throw new Error('user serializer should not be called');
      },
    };

    expect(serializeWorkflowSnapshotValue({ output: userOutput })).toMatchObject({
      output: { value: 'preserve me' },
    });
  });

  it('replaces circular references with a JSON-safe marker during snapshot serialization', () => {
    const value: Record<string, any> = { name: 'cycle' };
    value.self = value;

    expect(serializeWorkflowSnapshotValue(value)).toEqual({
      name: 'cycle',
      self: '[Circular]',
    });
  });
});
