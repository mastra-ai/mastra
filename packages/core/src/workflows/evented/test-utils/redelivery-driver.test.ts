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

/** `workflow.step.end` events the driver has seen, so tests can prove a dropped duplicate emitted none. */
function stepEndCount(driver: RedeliveryDriver) {
  return driver.events.filter(e => e.type === 'workflow.step.end').length;
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
      const at = new Date(1000);
      const data = {
        workflowId: 'wf',
        runId: 'capture-run',
        executionPath: [0],
        nested: { n: 1 },
        list: [{ n: 1 }],
        at,
      };
      await driver.pubsub.publish('workflows', { type: 'workflow.step.run', runId: 'capture-run', data });

      data.nested.n = 2;
      data.list[0]!.n = 2;
      data.executionPath.push(9);
      at.setTime(2000);

      const [captured] = driver.stepRuns({ spec: 'wf@0', runId: 'capture-run' });
      expect(captured).toBeDefined();
      expect(captured!.data).not.toBe(data);
      expect(captured!.data).toMatchObject({ executionPath: [0], nested: { n: 1 }, list: [{ n: 1 }] });
      expect(captured!.data.at).not.toBe(at);
      expect(captured!.data.at.getTime()).toBe(1000);
      expect(captured!.id).toEqual(expect.any(String));
      expect(captured!.deliveryAttempt).toBe(1);

      // A self-referencing payload clones with the cycle intact instead of
      // recursing forever.
      const cyclic: any = { workflowId: 'wf', runId: 'cyclic-run', executionPath: [0] };
      cyclic.self = cyclic;
      await driver.pubsub.publish('workflows', { type: 'workflow.step.run', runId: 'cyclic-run', data: cyclic });
      const [capturedCyclic] = driver.stepRuns({ spec: 'wf@0', runId: 'cyclic-run' });
      expect(capturedCyclic!.data.self).toBe(capturedCyclic!.data);
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
      for (const spec of ['no-match-wf@', 'no-match-wf@0,', 'no-match-wf@,0', 'no-match-wf@0,,1', '@0', 'wf@-1']) {
        await expect(driver.redeliver({ spec })).rejects.toThrow(/Invalid redelivery spec/);
      }
      // A second live driver would fight over the global processor spy.
      expect(() => new RedeliveryDriver()).toThrow(/Only one RedeliveryDriver/);
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

  it('rejects misuse and settles a step-end wait that is queued before the event', async () => {
    const execute = vi.fn(async () => ({ done: true }));
    const workflow = singleStepWorkflow('late-end-wf', execute);
    const driver = new RedeliveryDriver();

    expect(() => driver.assertEvented(undefined as any)).toThrow(/only supported on the evented engine/);
    for (const spec of ['late-end-wf@', '@', 'late-end-wf@x', 'late-end-wf@0,']) {
      expect(() => driver.stepRuns({ spec })).toThrow(/Invalid redelivery spec/);
      expect(() => driver.deliveryCount({ spec })).toThrow(/Invalid redelivery spec/);
    }

    const match = { spec: 'late-end-wf@0', runId: 'late-end-run' };
    // Queued before the event exists, then settled by the real step.end.
    const ended = driver.waitForStepEnd(match);

    await withMastra(driver, { workflows: { [workflow.id]: workflow } }, async () => {
      const run = await workflow.createRun({ runId: 'late-end-run' });
      expect((await run.start({ inputData: {} })).status).toBe('success');
      await expect(ended).resolves.toMatchObject({ type: 'workflow.step.end' });
      expect(driver.deliveryCount(match)).toBe(1);
    });

    // withMastra disposes the driver: redelivery is now a hard error and the
    // single-live-driver slot is free again for the next test.
    await expect(driver.redeliver(match)).rejects.toThrow(/disposed/);
    const next = new RedeliveryDriver();
    next.dispose();
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

      const endedBefore = stepEndCount(driver);
      const { event, handled } = await driver.redeliver(match);
      expect(event.deliveryAttempt).toBe(2);
      expect(event.id).toBe(driver.stepRuns(match)[0]!.id);
      expect(handled).toHaveLength(1);
      expect(handled.map(h => h.event.deliveryAttempt)).toEqual([2]);
      expect(handled.every(h => h.event.id === event.id && h.result.ok)).toBe(true);
      expect(driver.deliveryCount(match)).toBe(2);
      expect(execute).toHaveBeenCalledTimes(1);
      // The duplicate was dropped silently, so it published no step.end.
      expect(stepEndCount(driver)).toBe(endedBefore);

      const workflowsStore = (await storage.getStore('workflows'))!;
      const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
      expect((snapshot!.context as any).step1).toMatchObject({ status: 'suspended', suspendPayload });

      const resumed = await run.resume({ step: 'step1', resumeData: { approved: true } });
      expect(resumed.status).toBe('success');
      expect((resumed as any).result).toEqual({ approved: true });
      expect(execute).toHaveBeenCalledTimes(2);
    });
  });

  it('replays through publish like the durability harness, with a fresh id and attempt 1', async () => {
    const execute = vi.fn(async ({ suspend, resumeData }: any) => {
      if (!resumeData) {
        await suspend({ reason: 'needs-approval' });
        return {};
      }
      return { approved: resumeData.approved };
    });
    const workflow = singleStepWorkflow('driver-publish-wf', execute);
    const driver = new RedeliveryDriver();

    await withMastra(driver, { workflows: { [workflow.id]: workflow } }, async () => {
      const runId = 'driver-publish-run';
      const match = { spec: 'driver-publish-wf@0', runId };
      const run = await workflow.createRun({ runId });
      expect((await run.start({ inputData: {} })).status).toBe('suspended');

      const original = driver.stepRuns(match)[0]!;
      const endedBefore = stepEndCount(driver);
      const { event, handled } = await driver.redeliver(match, { viaPublish: true });

      // The harness re-published, so the duplicate is a new event, not a
      // same-id redelivery: publish mints an id and forces attempt 1.
      expect(event.id).not.toBe(original.id);
      expect(event.deliveryAttempt).toBe(1);
      expect(event.data).toMatchObject({ workflowId: workflow.id, runId, executionPath: [0] });
      expect(handled).toHaveLength(1);
      expect(handled[0]!.event.id).toBe(event.id);
      // The processor saw the transport's own attempt — no re-apply here.
      expect(handled[0]!.event.deliveryAttempt).toBe(1);
      expect(handled[0]!.result.ok).toBe(true);
      expect(driver.deliveryCount(match)).toBe(2);
      // A suspended step is dropped whatever its id, so even a fresh event
      // does not re-execute it or emit a step.end.
      expect(execute).toHaveBeenCalledTimes(1);
      expect(stepEndCount(driver)).toBe(endedBefore);

      const resumed = await run.resume({ step: 'step1', resumeData: { approved: true } });
      expect(resumed.status).toBe('success');
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
      try {
        await started.promise;
        expect(stepEndCount(driver)).toBe(0);

        // The fence keys on the original event id. A non-default attempt proves
        // the injected deliveryAttempt survives group delivery's own counter.
        const { handled } = await driver.redeliver(match, { deliveryAttempt: 3 });
        expect(handled).toHaveLength(1);
        expect(handled.map(h => h.event.deliveryAttempt)).toEqual([3]);
        expect(handled.every(h => h.result.ok)).toBe(true);
        expect(driver.deliveryCount(match)).toBe(2);
        expect(execute).toHaveBeenCalledTimes(1);
        // Fenced while running: the duplicate produced no step.end.
        expect(stepEndCount(driver)).toBe(0);
      } finally {
        gate.resolve();
      }
      expect((await result).status).toBe('success');
      await driver.waitForStepEnd(match);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(stepEndCount(driver)).toBe(1);
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
    let toolExecutions = 0;
    const echo = createTool({
      id: 'echo',
      description: 'echo',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => {
        toolExecutions++;
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

        const endedBefore = stepEndCount(driver);
        const { event, handled } = await driver.redeliver(toolStep);
        expect(handled).toHaveLength(1);
        expect(event.data).toMatchObject({ workflowId: 'durable-agentic-execution', executionPath: [3, 0] });
        expect(driver.deliveryCount(toolStep)).toBe(2);
        expect(driver.deliveryCount({ spec: 'durable-agentic-execution@3,0' })).toBe(2);
        // Fenced while the tool step was running, so no extra step.end.
        expect(stepEndCount(driver)).toBe(endedBefore);

        gate.resolve();
        await consumed;
        await driver.waitForStepEnd(toolStep);
        // The duplicate did not reach the tool, and did not cost a model call.
        expect(toolExecutions).toBe(1);
        expect(calls).toBe(2);
      } finally {
        gate.resolve();
        cleanup();
      }
    });
  }, 30_000);
});
