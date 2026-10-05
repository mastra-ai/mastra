import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createStep, createWorkflow } from '..';
import { Agent } from '../../../agent/agent';
import { createEventedAgent } from '../../../agent/durable/create-evented-agent';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { MockStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { createWorkflow as createDefaultWorkflow } from '../../create';
import { RedeliveryDriver, TOOL_STEP_PATH } from './redelivery-driver';

const looseObject = z.looseObject({});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function singleStepWorkflow(id: string, execute: (args: any) => Promise<any>) {
  const step1 = createStep({ id: 'step1', execute, inputSchema: looseObject, outputSchema: looseObject });
  return createWorkflow({ id, inputSchema: looseObject, outputSchema: looseObject, steps: [step1] })
    .then(step1)
    .commit();
}

async function withMastra<T>(
  driver: RedeliveryDriver,
  config: { workflows?: Record<string, any>; agents?: Record<string, any>; storage?: any; startWorkers?: boolean },
  fn: (mastra: Mastra) => Promise<T>,
): Promise<T> {
  const mastra = new Mastra({
    logger: false,
    storage: config.storage ?? new MockStore(),
    workflows: config.workflows,
    agents: config.agents,
    pubsub: driver.pubsub,
  });
  if (config.startWorkers !== false) await mastra.startWorkers();
  try {
    return await fn(mastra);
  } finally {
    await mastra.stopWorkers();
    driver.dispose();
  }
}

describe('RedeliveryDriver', () => {
  it('captures a clone taken at publish time', async () => {
    const driver = new RedeliveryDriver();
    try {
      const data = { workflowId: 'wf', runId: 'capture-run', executionPath: [0], nested: { n: 1 }, list: [{ n: 1 }] };
      await driver.pubsub.publish('workflows', { type: 'workflow.step.run', runId: 'capture-run', data });

      data.nested.n = 2;
      data.list[0]!.n = 2;
      data.executionPath.push(9);

      const [captured] = driver.stepRuns({ spec: 'wf@0', runId: 'capture-run' });
      expect(captured).toBeDefined();
      expect(captured!.data).not.toBe(data);
      expect(captured!.data).toMatchObject({ executionPath: [0], nested: { n: 1 }, list: [{ n: 1 }] });
      expect(captured!.id).toEqual(expect.any(String));
      expect(captured!.deliveryAttempt).toBe(1);
    } finally {
      driver.dispose();
    }
  });

  it('fails loudly when the spec never matched or nothing consumed the duplicate', async () => {
    const execute = vi.fn(async () => ({ done: true }));
    const workflow = singleStepWorkflow('no-match-wf', execute);
    const driver = new RedeliveryDriver();

    const neverEnds = driver.waitForStepEnd({ spec: 'no-match-wf@7' });
    const neverEndsResult = neverEnds.then(
      () => 'resolved',
      (error: Error) => error.message,
    );

    await withMastra(driver, { workflows: { [workflow.id]: workflow } }, async () => {
      const run = await workflow.createRun({ runId: 'no-match-run' });
      expect((await run.start({ inputData: {} })).status).toBe('success');

      // Wrong path, wrong workflow id, wrong run, malformed spec.
      await expect(driver.redeliver({ spec: 'no-match-wf@7' })).rejects.toThrow(/No captured workflow.step.run/);
      await expect(driver.redeliver({ spec: 'other-wf@0' })).rejects.toThrow(/No captured workflow.step.run/);
      await expect(driver.redeliver({ spec: 'no-match-wf@0', runId: 'other-run' })).rejects.toThrow(
        /No captured workflow.step.run/,
      );
      await expect(driver.redeliver({ spec: 'no-match-wf@' })).rejects.toThrow(/Invalid redelivery spec/);
      expect(driver.deliveryCount({ spec: 'no-match-wf@0', runId: 'no-match-run' })).toBe(1);
      expect(execute).toHaveBeenCalledTimes(1);
    });

    // Disposing settles the pending wait as a failure, never a success.
    await expect(neverEndsResult).resolves.toMatch(/never observed/);

    // A capture with no running worker to consume the duplicate also throws.
    const idle = new RedeliveryDriver();
    await withMastra(idle, { startWorkers: false }, async () => {
      await idle.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId: 'idle-run',
        data: { workflowId: 'idle-wf', runId: 'idle-run', executionPath: [0] },
      });
      await expect(idle.redeliver({ spec: 'idle-wf@0' })).rejects.toThrow(/not consumed/);
    });
  });

  it('rejects workflows that are not on the evented engine', () => {
    const driver = new RedeliveryDriver();
    try {
      const step = createStep({
        id: 's',
        execute: async () => ({}),
        inputSchema: looseObject,
        outputSchema: looseObject,
      });
      const defaultWorkflow = createDefaultWorkflow({
        id: 'default-wf',
        inputSchema: looseObject,
        outputSchema: looseObject,
      })
        .then(step as any)
        .commit();
      expect(() => driver.assertEvented(defaultWorkflow)).toThrow(/only supported on the evented engine/);
      expect(() => driver.assertEvented(singleStepWorkflow('evented-wf', async () => ({})))).not.toThrow();
    } finally {
      driver.dispose();
    }
  });

  it('drops a redelivered step.run for a suspended step and the run still resumes', async () => {
    const suspendPayload = { reason: 'needs-approval' };
    const execute = vi.fn(async ({ suspend, resumeData }: any) => {
      if (!resumeData) {
        await suspend(suspendPayload);
        return {};
      }
      return { approved: resumeData.approved };
    });
    const workflow = singleStepWorkflow('driver-suspended-wf', execute);
    const storage = new MockStore();
    const driver = new RedeliveryDriver();

    await withMastra(driver, { workflows: { [workflow.id]: workflow }, storage }, async () => {
      driver.assertEvented(workflow);
      const runId = 'driver-suspended-run';
      const match = { spec: 'driver-suspended-wf@0', runId };
      const run = await workflow.createRun({ runId });
      expect((await run.start({ inputData: {} })).status).toBe('suspended');
      await expect(driver.waitForStepEnd(match)).resolves.toMatchObject({ type: 'workflow.step.end' });

      const { event, results } = await driver.redeliver(match);
      expect(event.deliveryAttempt).toBe(2);
      expect(event.id).toBe(driver.stepRuns(match)[0]!.id);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.ok)).toBe(true);
      expect(driver.deliveryCount(match)).toBe(2);
      expect(execute).toHaveBeenCalledTimes(1);

      const workflowsStore = (await storage.getStore('workflows'))!;
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
      expect((snapshot!.context as any).step1).toMatchObject({ status: 'suspended', suspendPayload });

      const resumed = await run.resume({ step: 'step1', resumeData: { approved: true } });
      expect(resumed.status).toBe('success');
      expect((resumed as any).result).toEqual({ approved: true });
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  it('fences a redelivered step.run while the step is still running', async () => {
    const started = deferred();
    const gate = deferred();
    const execute = vi.fn(async () => {
      started.resolve();
      await gate.promise;
      return { done: true };
    });
    const workflow = singleStepWorkflow('driver-running-wf', execute);
    const driver = new RedeliveryDriver();

    await withMastra(driver, { workflows: { [workflow.id]: workflow } }, async () => {
      const runId = 'driver-running-run';
      const match = { spec: 'driver-running-wf@0', runId };
      const run = await workflow.createRun({ runId });
      const result = run.start({ inputData: {} });
      await started.promise;

      const { results } = await driver.redeliver(match);
      expect(results.length).toBeGreaterThan(0);
      expect(results.every(r => r.ok)).toBe(true);
      expect(driver.deliveryCount(match)).toBe(2);
      expect(execute).toHaveBeenCalledTimes(1);

      gate.resolve();
      expect((await result).status).toBe('success');
      await driver.waitForStepEnd(match);
      expect(execute).toHaveBeenCalledTimes(1);
    });
  });

  it('addresses the durable agent tool step as tool-step', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        const parts: any[] =
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'tool-call', toolCallId: 'tc-1', toolName: 'echo', input: JSON.stringify({ q: 'x' }) },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'ok' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
              ];
        return {
          stream: convertArrayToReadableStream(parts),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    }) as unknown as LanguageModelV2;

    // Hold the tool open so the duplicate lands while the step is running;
    // what a duplicate of a *completed* tool step does is F4 (COR-1307).
    const started = deferred();
    const gate = deferred();
    const echo = createTool({
      id: 'echo',
      description: 'echo',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        started.resolve();
        await gate.promise;
        return { ok: true };
      },
    });
    const agent = createEventedAgent({
      agent: new Agent({ id: 'driver-agent', name: 'driver-agent', instructions: 'Use echo.', model, tools: { echo } }),
    });
    const driver = new RedeliveryDriver();

    await withMastra(driver, { agents: { 'driver-agent': agent }, storage: new InMemoryStore() }, async () => {
      driver.assertEvented(agent.getWorkflow() as { engineType?: string });
      const { output, cleanup } = await agent.stream('hi');
      try {
        const consumed = output.consumeStream();
        await started.promise;

        const toolStep = { spec: 'tool-step' };
        expect(driver.stepRuns(toolStep)).toHaveLength(1);
        expect(driver.stepRuns(toolStep)[0]!.data).toMatchObject({
          workflowId: 'durable-agentic-execution',
          executionPath: [...TOOL_STEP_PATH],
        });

        const { event, results } = await driver.redeliver(toolStep);
        expect(results.length).toBeGreaterThan(0);
        expect(event.data).toMatchObject({ workflowId: 'durable-agentic-execution', executionPath: [3, 0] });
        expect(driver.deliveryCount(toolStep)).toBe(2);
        expect(driver.deliveryCount({ spec: 'durable-agentic-execution@3,0' })).toBe(2);

        gate.resolve();
        await consumed;
        await driver.waitForStepEnd(toolStep);
      } finally {
        gate.resolve();
        cleanup();
      }
    });
  }, 30_000);
});
