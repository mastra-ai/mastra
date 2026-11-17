import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../../agent';
import { createEventedAgent } from '../../agent/durable/create-evented-agent';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows/evented';
import { outsideStorageScope } from '../../workflows/evented/workflow-event-processor/storage-scope';
import type { StepExecutionParams } from '../types';
import { InProcessStrategy } from './in-process-strategy';

const numberSchema = z.object({ n: z.number() });

function createNestedWorkflows() {
  const double = createStep({
    id: 'double',
    inputSchema: numberSchema,
    outputSchema: numberSchema,
    execute: async ({ inputData }) => ({ n: inputData.n * 2 }),
  });
  const inner = createWorkflow({ id: 'inner', inputSchema: numberSchema, outputSchema: numberSchema })
    .then(double)
    .commit();
  const outer = createWorkflow({ id: 'outer', inputSchema: numberSchema, outputSchema: numberSchema })
    .then(inner)
    .commit();
  return { inner, outer };
}

function stepParams(overrides: Partial<StepExecutionParams>): StepExecutionParams {
  return {
    workflowId: 'inner',
    runId: 'run-1',
    stepId: 'double',
    executionPath: [0],
    stepResults: {},
    state: {},
    requestContext: {},
    input: { n: 2 },
    ...overrides,
  };
}

/**
 * Sends the orchestration worker's step requests to `InProcessStrategy`, the
 * strategy the server's step-execution route uses, after a JSON round trip,
 * as a standalone worker with `MASTRA_STEP_EXECUTION_URL` would.
 */
function executeStepsRemotely(mastra: Mastra) {
  vi.stubEnv('MASTRA_STEP_EXECUTION_URL', 'http://api.test/api');
  const server = new InProcessStrategy({ mastra });
  const requests: Array<{ workflowId: string; body: Record<string, any> }> = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const [, , workflowId, , runId] = new URL(String(input)).pathname.split('/').filter(Boolean);
    const body = JSON.parse(String(init?.body));
    requests.push({ workflowId: decodeURIComponent(workflowId!), body });
    try {
      // A real server handles the request outside the dispatching processor's storage scope.
      const result = await outsideStorageScope(() =>
        server.executeStep({
          ...body,
          workflowId: decodeURIComponent(workflowId!),
          runId: decodeURIComponent(runId!),
        }),
      );
      return new Response(JSON.stringify(result), { status: 200 });
    } catch (error) {
      return new Response(JSON.stringify({ error: (error as Error).message }), { status: 404 });
    }
  });
  return requests;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('InProcessStrategy workflow resolution', () => {
  it('resolves a nested workflow step through its parent workflow', async () => {
    const { outer } = createNestedWorkflows();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    const result = await new InProcessStrategy({ mastra }).executeStep(
      stepParams({ parentWorkflow: { workflowId: 'outer', runId: 'run-1', executionPath: [0] } }),
    );

    expect(result).toMatchObject({ status: 'success', output: { n: 4 } });
  });

  it('resolves a nested workflow whose parent is registered under a different key', async () => {
    const { outer } = createNestedWorkflows();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { outerAlias: outer } });

    const result = await new InProcessStrategy({ mastra }).executeStep(
      stepParams({ parentWorkflow: { workflowId: 'outer', runId: 'run-1', executionPath: [0] } }),
    );

    expect(result).toMatchObject({ status: 'success', output: { n: 4 } });
  });

  it('resolves a step of an internal workflow', async () => {
    const { inner } = createNestedWorkflows();
    const mastra = new Mastra({ logger: false, storage: new MockStore() });
    mastra.__registerInternalWorkflow(inner);

    const result = await new InProcessStrategy({ mastra }).executeStep(stepParams({}));

    expect(result).toMatchObject({ status: 'success', output: { n: 4 } });
  });

  it('does not run a different workflow when the parent path leads elsewhere', async () => {
    const { inner } = createNestedWorkflows();
    const other = createWorkflow({ id: 'other', inputSchema: numberSchema, outputSchema: numberSchema })
      .then(
        createStep({
          id: 'double',
          inputSchema: numberSchema,
          outputSchema: numberSchema,
          execute: async () => ({ n: -1 }),
        }),
      )
      .commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: numberSchema, outputSchema: numberSchema })
      .then(other)
      .commit();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { inner, outer } });

    await expect(
      new InProcessStrategy({ mastra }).executeStep(
        stepParams({ parentWorkflow: { workflowId: 'outer', runId: 'run-1', executionPath: [0] } }),
      ),
    ).rejects.toThrow('could not resolve step "double" at executionPath [0] in workflow "inner"');
  });

  it('checks every workflow id along a deeper parent chain', async () => {
    const { inner } = createNestedWorkflows();
    const middle = createWorkflow({ id: 'middle', inputSchema: numberSchema, outputSchema: numberSchema })
      .then(inner)
      .commit();
    const outer = createWorkflow({ id: 'outer', inputSchema: numberSchema, outputSchema: numberSchema })
      .then(middle)
      .commit();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });
    const strategy = new InProcessStrategy({ mastra });
    const parentWorkflow = (middleId: string) => ({
      workflowId: middleId,
      runId: 'run-1',
      executionPath: [0],
      parentWorkflow: { workflowId: 'outer', runId: 'run-1', executionPath: [0] },
    });

    await expect(strategy.executeStep(stepParams({ parentWorkflow: parentWorkflow('middle') }))).resolves.toMatchObject(
      { status: 'success', output: { n: 4 } },
    );
    await expect(strategy.executeStep(stepParams({ parentWorkflow: parentWorkflow('not-middle') }))).rejects.toThrow(
      'could not resolve step "double"',
    );
  });

  it('reports the step when the parent path does not lead to a workflow', async () => {
    const { outer } = createNestedWorkflows();
    const mastra = new Mastra({ logger: false, storage: new MockStore(), workflows: { outer } });

    await expect(
      new InProcessStrategy({ mastra }).executeStep(
        stepParams({ parentWorkflow: { workflowId: 'outer', runId: 'run-1', executionPath: [5] } }),
      ),
    ).rejects.toThrow('could not resolve step "double" at executionPath [0] in workflow "inner"');
  });
});

describe('remote step execution for nested workflows', () => {
  it('runs a nested evented workflow and sends only the parent chain', async () => {
    const { outer } = createNestedWorkflows();
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { outer },
    });
    const requests = executeStepsRemotely(mastra);
    await mastra.startWorkers();

    try {
      const run = await outer.createRun();
      const result = await run.start({ inputData: { n: 2 } });

      expect(result).toMatchObject({ status: 'success', result: { n: 4 } });
      expect(requests).toHaveLength(1);
      expect(requests[0]!.workflowId).toBe('inner');
      expect(requests[0]!.body.parentWorkflow).toEqual({
        workflowId: 'outer',
        runId: run.runId,
        executionPath: [0],
      });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('runs an evented agent whose model and tool steps execute remotely', async () => {
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        const hasToolResult = JSON.stringify(prompt).includes('"type":"tool-result"');
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream<any>([
            { type: 'stream-start', warnings: [] },
            ...(hasToolResult
              ? [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'C costs 89' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage },
                ]
              : [
                  {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call-1',
                    toolName: 'searchPrice',
                    input: '{"vendor":"C"}',
                  },
                  { type: 'finish', finishReason: 'tool-calls', usage },
                ]),
          ]),
        };
      },
    });
    const searchPrice = createTool({
      id: 'search-price',
      description: 'Get the price of a vendor',
      inputSchema: z.object({ vendor: z.string() }),
      execute: async () => ({ price: 89 }),
    });
    const pubsub = new EventEmitterPubSub();
    const pricer = createEventedAgent({
      agent: new Agent({
        id: 'pricer',
        name: 'pricer',
        instructions: 'Look up prices.',
        model,
        tools: { searchPrice },
      }),
      pubsub,
    });
    const mastra = new Mastra({ logger: false, storage: new MockStore(), pubsub, agents: { pricer } });
    const requests = executeStepsRemotely(mastra);
    await mastra.startWorkers();

    try {
      const result = await pricer.generate('How much is C?');

      expect(result.text).toBe('C costs 89');
      expect(result.toolResults).toEqual([
        expect.objectContaining({ payload: expect.objectContaining({ result: { price: 89 } }) }),
      ]);
      expect(requests.some(request => request.workflowId === 'durable-agentic-execution')).toBe(true);
    } finally {
      await mastra.stopWorkers();
    }
  });
});

describe('remote step execution on storage v2', () => {
  const looseObject = z.looseObject({});

  function storageV2Workflow(id: string, readA: (params: any) => Promise<unknown>) {
    return createWorkflow({
      id,
      inputSchema: looseObject,
      outputSchema: z.any(),
      stateSchema: z.object({ count: z.number().optional() }),
      options: { storageVersion: 2 },
    })
      .then(
        createStep({
          id: 'a',
          inputSchema: looseObject,
          outputSchema: z.object({ n: z.number() }),
          stateSchema: z.object({ count: z.number().optional() }),
          execute: async ({ setState }) => {
            await setState({ count: 1 });
            return { n: 1 };
          },
        }),
      )
      .then(
        createStep({
          id: 'b',
          inputSchema: z.object({ n: z.number() }),
          outputSchema: z.any(),
          stateSchema: z.object({ count: z.number().optional() }),
          execute: readA,
        }),
      )
      .commit();
  }

  async function runRemotely(workflow: ReturnType<typeof storageV2Workflow>) {
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    const requests = executeStepsRemotely(mastra);
    await mastra.startWorkers();
    try {
      const run = await workflow.createRun();
      return { result: await run.start({ inputData: {} }), requests };
    } finally {
      await mastra.stopWorkers();
    }
  }

  it('sends the storage version, so the remote step reads results and state asynchronously', async () => {
    const { result, requests } = await runRemotely(
      storageV2Workflow('remote-async-reads', async ({ getStepResultAsync, getState }) => ({
        a: await getStepResultAsync('a'),
        state: await getState(),
      })),
    );

    expect(result).toMatchObject({ status: 'success', result: { a: { n: 1 }, state: { count: 1 } } });
    expect(requests.map(request => request.body.storageVersion)).toEqual([2, 2]);
  });

  it('makes sync getStepResult and state throw in remotely executed v2 steps', async () => {
    const syncResult = await runRemotely(
      storageV2Workflow('remote-sync-result', async ({ getStepResult }) => getStepResult('a')),
    );
    expect(syncResult.result.status).toBe('failed');
    expect((syncResult.result as any).error.message).toMatch(/Use `await getStepResultAsync\("a"\)` instead/);

    const syncState = await runRemotely(storageV2Workflow('remote-sync-state', async ({ state }) => state));
    expect(syncState.result.status).toBe('failed');
    expect((syncState.result as any).error.message).toMatch(/getState\(\)/);
  });
});
