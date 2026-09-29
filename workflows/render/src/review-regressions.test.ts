import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStep } from '@mastra/core/workflows';
import { createPostgresPersistence, createMemoryPersistence, init } from './index.js';
import { json } from './protocol.js';
import { executeRemoteStep, pureContext } from './context.js';
import * as manifests from './manifest.js';
import { workflowBindings } from './provider.js';
import { createAdmission } from '../examples/editorial-review/admission.js';

const database = vi.hoisted(() => ({
  pools: [] as any[],
  active: [] as { run_id: string }[],
  settled: [] as string[],
  inserted: [] as string[],
}));
vi.mock('pg', async () => {
  const { EventEmitter } = await import('node:events');
  class Pool extends EventEmitter {
    query = vi.fn(async (sql: string, args: unknown[] = []) => {
      if (sql.startsWith('SELECT run_id')) return { rows: database.active };
      if (sql.startsWith('UPDATE mastra_render_admissions')) database.settled.push(String(args[1]));
      if (sql.startsWith('INSERT INTO mastra_render_admissions')) database.inserted.push(String(args[1]));
      if (sql.includes('AS global_rate'))
        return { rows: [{ global_rate: '0', owner_rate: '0', global_active: '0', owner_active: '0' }] };
      return { rows: [], rowCount: 0 };
    });
    connect = async () => ({ query: this.query, release() {} });
    end = async () => {};
    constructor() {
      super();
      database.pools.push(this);
    }
  }
  return { Pool };
});
beforeEach(() => {
  database.pools = [];
  database.active = [];
  database.settled = [];
  database.inserted = [];
});
afterEach(() => vi.restoreAllMocks());

it.each(['persistence', 'admission'])('handles idle %s connection errors without masking query errors', async kind => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const store =
    kind === 'persistence'
      ? createPostgresPersistence({})
      : createAdmission({ connectionString: 'test', namespace: 'test', getStatus: async () => null });
  const pool = database.pools[0];
  try {
    expect(() => pool.emit('error', new Error('idle connection terminated'))).not.toThrow();
    expect(log).toHaveBeenCalled();
    const query = () => ('get' in store ? store.get('w', 'r') : store.reserve('r', 'owner', {}));
    await query();
    pool.query.mockRejectedValueOnce(new Error('query unavailable'));
    await expect(query()).rejects.toThrow('query unavailable');
  } finally {
    await store.close();
  }
});

it('preserves plain object behavior and own prototype-related JSON keys', () => {
  const original = JSON.parse('{"x":1,"nested":{"__proto__":{"polluted":true},"constructor":"data"}}');
  const copy = json(original) as typeof original;
  expect(copy.hasOwnProperty('x')).toBe(true);
  expect(String(copy)).toBe('[object Object]');
  expect(copy instanceof Object).toBe(true);
  expect(Object.getPrototypeOf(copy.nested)).toBe(Object.prototype);
  expect(Object.getOwnPropertyDescriptor(copy.nested, '__proto__')).toEqual({
    value: { polluted: true },
    enumerable: true,
    writable: true,
    configurable: true,
  });
  expect(copy.nested.constructor).toBe('data');
  expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  expect(JSON.stringify(copy)).toBe(JSON.stringify(original));
});

it('preserves ordinary object methods in remote and pure Mastra contexts', async () => {
  const schema = z.object({ x: z.number() });
  const check = (value: any) => {
    expect(value.hasOwnProperty('x')).toBe(true);
    expect(value.constructor).toBe(Object);
    expect(String(value)).toBe('[object Object]');
  };
  const step = createStep({
    id: 'plain',
    inputSchema: schema,
    outputSchema: schema,
    stateSchema: schema,
    execute: async ({ inputData, state, getInitData, getStepResult }) => {
      [inputData, state, getInitData(), getStepResult('prior')].forEach(check);
      expect(() => {
        (state as any).x = 99;
      }).toThrow();
      return inputData;
    },
  });
  const envelope = {
    version: 1 as const,
    workflowId: 'w',
    runId: 'r',
    buildId: 'b',
    manifest: 'm',
    stepKey: 'plain',
    executionKey: 'plain',
    input: { x: 1 },
    state: { x: 2 },
    initialInput: { x: 3 },
    priorOutputs: { prior: { x: 4 } },
    requestContext: {},
    readOnly: true,
  };
  const result = await executeRemoteStep(
    step as unknown as Parameters<typeof executeRemoteStep>[0],
    envelope,
    undefined,
    [],
  );
  expect(result.output).toEqual({ x: 1 });
  const pure = pureContext({
    inputData: { x: 1 },
    state: { x: 2 },
    getInitData: () => ({ x: 3 }),
    getStepResult: () => ({ x: 4 }),
  });
  [pure.inputData, pure.state, pure.getInitData(), pure.getStepResult()].forEach(check);
  expect(() => {
    pure.inputData.x = 5;
  }).toThrow();
});

it('compiles lazily, retries failed compilation and caches per binding after commit', () => {
  const compile = vi.spyOn(manifests, 'compileManifest');
  const h = init({ workflowSlug: 'test', buildId: 'b', persistence: createMemoryPersistence() });
  const step = h.createStep({
    id: 'step',
    inputSchema: z.number(),
    outputSchema: z.number(),
    execute: async ({ inputData }) => inputData,
  });
  const w = h.createWorkflow({ id: 'one', inputSchema: z.number(), outputSchema: z.number() }).then(step);
  const binding = workflowBindings.get(w)!;
  expect(compile).not.toHaveBeenCalled();
  expect(() => binding.manifest()).toThrow('Commit workflow');
  w.commit();
  const first = binding.manifest();
  expect(binding.manifest()).toBe(first);
  expect(compile).toHaveBeenCalledTimes(2);
  const other = h.createWorkflow({ id: 'two', inputSchema: z.number(), outputSchema: z.number() }).then(step).commit();
  expect(workflowBindings.get(other)!.manifest().hash).not.toBe(first.hash);
  expect(compile).toHaveBeenCalledTimes(3);
});

it('shares bounded reconciliation across submissions and settles only terminal runs', async () => {
  database.active = Array.from({ length: 8 }, (_, i) => ({ run_id: String(i) }));
  let active = 0,
    peak = 0,
    calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const admission = createAdmission({
    connectionString: 'test',
    namespace: 'n',
    getStatus: async id => {
      active++;
      calls++;
      peak = Math.max(peak, active);
      try {
        await gate;
        return (
          (
            { 0: 'success', 1: 'failed', 2: 'canceled', 3: 'running', 4: 'submission-unknown' } as Record<
              string,
              string
            >
          )[id] ?? null
        );
      } finally {
        active--;
      }
    },
  });
  const pending = Promise.all([admission.reserve('a', 'owner', {}), admission.reserve('b', 'owner', {})]);
  try {
    await vi.waitFor(() => expect(active).toBe(3), { timeout: 300 });
  } finally {
    release();
    await pending;
    await admission.close();
  }
  expect(peak).toBe(3);
  expect(calls).toBe(8);
  expect(database.settled.sort()).toEqual(['0', '1', '2']);
});

it('drains failed reconciliation, fails admission closed and can retry safely', async () => {
  database.active = [{ run_id: 'bad' }, { run_id: 'slow' }, { run_id: 'unknown' }];
  let release!: () => void,
    finished = false,
    failed = true;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const admission = createAdmission({
    connectionString: 'test',
    namespace: 'n',
    getStatus: async id => {
      if (failed && id === 'bad') throw new Error('provider unavailable');
      if (failed && id === 'slow') await gate;
      return null;
    },
  });
  const attempt = admission.reserve('a', 'owner', {}).then(
    () => {
      throw new Error('admission unexpectedly succeeded');
    },
    error => {
      finished = true;
      return error;
    },
  );
  await new Promise(resolve => setTimeout(resolve, 20));
  try {
    expect(finished).toBe(false);
  } finally {
    release();
  }
  expect((await attempt).message).toBe('provider unavailable');
  expect(database.inserted).toEqual([]);
  expect(database.settled).toEqual([]);
  failed = false;
  expect(await admission.reserve('a', 'owner', {})).toBe(true);
  await admission.close();
});
