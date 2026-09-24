import { randomUUID } from 'node:crypto';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createStep as coreCreateStep, type AnyWorkflow } from '@mastra/core/workflows';
import { task } from '@renderinc/sdk/workflows';
import type { TaskContext, TaskDefinition } from '@renderinc/sdk/workflows';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { init, createMemoryPersistence } from './index.js';
import type { ProviderRun, RenderOptions, RenderTransport } from './index.js';
import { registerRenderTasks } from './worker.js';
import { json } from './protocol.js';
import { getRenderTaskContext } from './runtime.js';

function harness(options: Partial<RenderOptions> = {}) {
  let tasks: ReadonlyMap<string, TaskDefinition<[unknown], unknown>>;
  const runs = new Map<string, ProviderRun>();
  const dispatched: string[] = [];
  const context: TaskContext = {
    async run(definition, ...args) {
      dispatched.push(definition.name);
      return structuredClone(await definition.func(context, ...structuredClone(args)));
    },
  };
  const transport: RenderTransport = {
    async start(slug, input) {
      const id = randomUUID();
      runs.set(id, { id, status: 'pending' });
      const definition = tasks.get(slug.split('/').at(-1)!);
      if (!definition) throw new Error('No registered root');
      void Promise.resolve().then(async () => {
        runs.set(id, { id, status: 'running' });
        try {
          const result = await definition.func(context, structuredClone(input));
          if (runs.get(id)?.status !== 'canceled')
            runs.set(id, { id, status: 'completed', results: [structuredClone(result)] });
        } catch (error) {
          runs.set(id, { id, status: 'failed', error });
        }
      });
      return id;
    },
    async get(id) {
      return runs.get(id)!;
    },
    async cancel(id) {
      runs.set(id, { id, status: 'canceled' });
    },
  };
  const factories = init({
    workflowSlug: 'tests',
    buildId: 'test-build',
    persistence: createMemoryPersistence(),
    transport,
    requestContextKeys: ['locale'],
    pollIntervalMs: 10,
    ...options,
  });
  return {
    ...factories,
    transport,
    dispatched,
    runs,
    register(workflow: AnyWorkflow) {
      const mastra = new Mastra({ workflows: { workflow }, logger: false });
      tasks = registerRenderTasks({ mastra });
      return tasks;
    },
  };
}

describe('provider feasibility and graph behavior', () => {
  it('executes the root locally and business steps through the child context', async () => {
    const h = harness();
    const first = h.createStep({
      id: 'first',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData + 1,
    });
    const second = h.createStep({
      id: 'second',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData, getStepResult, getInitData }) => {
        expect(getStepResult(first)).toBe(7);
        expect(getInitData()).toBe(6);
        expect(getRenderTaskContext()).toBeDefined();
        return inputData * 2;
      },
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(first)
      .then(second)
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 6 });
    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.result).toBe(14);
    expect(h.dispatched).toHaveLength(2);
    expect(workflow.runs.size).toBe(0);
  });

  it('preserves sequential state and request-context updates', async () => {
    const h = harness();
    const stateSchema = z.object({ prepared: z.boolean() });
    const first = h.createStep({
      id: 'prepare',
      inputSchema: z.number(),
      outputSchema: z.number(),
      stateSchema,
      execute: async ({ inputData, setState, requestContext }) => {
        await setState({ prepared: true });
        requestContext.set('locale', 'fr');
        return inputData + 1;
      },
    });
    const last = h.createStep({
      id: 'read',
      inputSchema: z.number(),
      outputSchema: z.string(),
      stateSchema,
      execute: async ({ state, requestContext, inputData }) =>
        `${state.prepared}:${requestContext.get('locale')}:${inputData}`,
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.string(), stateSchema })
      .then(first)
      .then(last)
      .commit();
    h.register(workflow);
    const result = await (
      await workflow.createRun()
    ).start({
      inputData: 3,
      initialState: { prepared: false },
      requestContext: new RequestContext<unknown>([['locale', 'en']]),
    });
    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.result).toBe('true:fr:4');
  });

  it('keeps mappings local and preserves parallel graph output', async () => {
    const h = harness();
    const a = h.createStep({
      id: 'double',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData * 2,
    });
    const b = h.createStep({
      id: 'triple',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData * 3,
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .parallel([a, b])
      .map(async ({ inputData }) => inputData.double + inputData.triple)
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 7 });
    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.result).toBe(35);
    expect(h.dispatched).toHaveLength(2);
  });

  it('rejects invalid input before submission and prevents duplicate run submission', async () => {
    const h = harness();
    const step = h.createStep({
      id: 'identity',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    h.register(workflow);
    const run = await workflow.createRun();
    await expect(run.start({ inputData: 'bad' as unknown as number })).rejects.toThrow();
    expect(h.dispatched).toHaveLength(0);
    await run.start({ inputData: 2 });
    await expect(run.start({ inputData: 2 })).rejects.toThrow('already exists');
  });

  it('executes only matching branches', async () => {
    const h = harness();
    const a = h.createStep({
      id: 'positive',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData * 2,
    });
    const b = h.createStep({
      id: 'negative',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => -inputData,
    });
    const workflow = h
      .createWorkflow({
        id: randomUUID(),
        inputSchema: z.number(),
        outputSchema: z.object({ positive: z.number().optional(), negative: z.number().optional() }),
      })
      .branch([
        [async ({ inputData }) => inputData > 0, a],
        [async ({ inputData }) => inputData < 0, b],
      ])
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 3 });
    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.result).toEqual({ positive: 6 });
    expect(h.dispatched).toHaveLength(1);
  });

  it.each([{ input: [] }, { input: [4, 1, 3, 2] }])(
    'preserves foreach ordering and bounds remote fan-out for $input',
    async ({ input }) => {
      const h = harness({ maxConcurrentSteps: 2 });
      let active = 0;
      let peak = 0;
      const step = h.createStep({
        id: 'double',
        inputSchema: z.number(),
        outputSchema: z.number(),
        execute: async ({ inputData }) => {
          active++;
          peak = Math.max(peak, active);
          await new Promise(resolve => setTimeout(resolve, inputData * 4));
          active--;
          return inputData * 2;
        },
      });
      const workflow = h
        .createWorkflow({ id: randomUUID(), inputSchema: z.array(z.number()), outputSchema: z.array(z.number()) })
        .foreach(step, { concurrency: 4 })
        .commit();
      h.register(workflow);
      const result = await (await workflow.createRun()).start({ inputData: input });
      expect(result.status).toBe('success');
      if (result.status === 'success') expect(result.result).toEqual(input.map(value => value * 2));
      expect(peak).toBeLessThanOrEqual(2);
      expect(h.dispatched).toHaveLength(input.length);
    },
  );

  it.each(['state', 'context'] as const)('rejects shared %s writes inside parallel steps', async mode => {
    const h = harness();
    const stateSchema = z.object({ count: z.number() });
    const step = h.createStep({
      id: 'write',
      inputSchema: z.number(),
      outputSchema: z.number(),
      stateSchema,
      execute: async ({ inputData, setState, requestContext }) => {
        if (mode === 'state') await setState({ count: 1 });
        else requestContext.set('locale', 'fr');
        return inputData;
      },
    });
    const workflow = h
      .createWorkflow({
        id: randomUUID(),
        inputSchema: z.number(),
        outputSchema: z.object({ write: z.number() }),
        stateSchema,
      })
      .parallel([step])
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 1, initialState: { count: 0 } });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') {
      expect(result.error.message).toContain('mutation');
      const failed = result.steps.write;
      expect(failed?.status).toBe('failed');
      if (failed?.status === 'failed') expect(failed.error).toBeInstanceOf(Error);
    }
  });

  it('rejects mutation in local mapping functions', async () => {
    const h = harness();
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .map(async ({ inputData, requestContext }) => {
        requestContext.set('locale', 'fr');
        return inputData;
      })
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 1 });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error.message).toContain('mutation');
    expect(h.dispatched).toHaveLength(0);
  });

  it('guards unsupported controls on steps made with the core factory', async () => {
    const h = harness();
    const step = coreCreateStep({
      id: 'suspend',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData, suspend }) => {
        await suspend({});
        return inputData;
      },
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 1 });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error.message).toContain('suspend');
  });

  it('allows a remote Mastra step to chain a native Render task', async () => {
    const h = harness();
    const native = task({ name: `native-${randomUUID()}` }, async (_context, value: number) => value + 10);
    const step = h.createStep({
      id: 'native-call',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => getRenderTaskContext().run(native, inputData),
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    h.register(workflow);
    const result = await (await workflow.createRun()).start({ inputData: 1 });
    expect(result.status).toBe('success');
    if (result.status === 'success') expect(result.result).toBe(11);
    expect(h.dispatched).toHaveLength(2);
  });

  it('does not return buffered success after the provider cancels the root', async () => {
    const h = harness();
    const step = h.createStep({
      id: 'identity',
      inputSchema: z.number(),
      outputSchema: z.number(),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = h
      .createWorkflow({ id: randomUUID(), inputSchema: z.number(), outputSchema: z.number() })
      .then(step)
      .commit();
    h.register(workflow);
    const originalGet = h.transport.get;
    h.transport.get = async id => {
      const record = await originalGet(id);
      return record.status === 'completed' ? { id, status: 'canceled' } : record;
    };
    const result = await (await workflow.createRun()).start({ inputData: 1 });
    expect(result.status).toBe('failed');
    if (result.status === 'failed') expect(result.error.name).toBe('AbortError');
  });
});

describe('JSON transport', () => {
  it.each([undefined, NaN, Infinity, new Date(), () => 1, [undefined], { x: undefined }])(
    'rejects lossy input %s',
    value => {
      expect(() => json(value)).toThrow();
    },
  );
  it('rejects cycles and oversized UTF-8 arguments', () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => json(cyclic)).toThrow('cycle');
    expect(() => json('☃'.repeat(100), 'input', 200)).toThrow('byte');
  });
  it('does not leak a task context to callers', () => {
    expect(() => getRenderTaskContext()).toThrow('outside');
  });
});
