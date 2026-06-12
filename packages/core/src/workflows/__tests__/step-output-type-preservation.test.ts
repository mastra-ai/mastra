/**
 * Step-output type preservation across the full workflow execution path.
 *
 * The codec unit tests prove a payload survives a single `encode → decode`
 * cycle. This suite proves the same set of types survives the full workflow
 * runtime path that production agents traverse: step result → snapshot
 * persist → step result lookup → final `result.steps[id].output`.
 *
 * We run every case against both engines:
 *
 *   - default engine: snapshot path goes through `cloneRunData` in
 *     `InMemoryStore` (no codec).
 *   - evented engine: snapshot path goes through the WEP and an
 *     `EventEmitterPubSub` (in-process — also no codec; the codec only
 *     activates at the `UnixSocketPubSub` boundary, see s2 for that).
 *
 * The contract is identical on both: types must be preserved end-to-end.
 * That's what makes the agentic loop safe to migrate onto the evented
 * engine — every payload that flows into `result.steps[id].output` must
 * keep its prototype and value identity for both default and evented
 * consumers downstream.
 *
 * Note: this suite does NOT exercise the codec — the codec is unit-tested
 * exhaustively in `events/codec/codec.test.ts` and exercised cross-process
 * in `events/__tests__/evented-codec-multiprocess.test.ts` (s2). This suite
 * covers the complementary path: in-process snapshot preservation.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep } from '../workflow';
import { createWorkflow } from '../create';

type Engine = { name: 'default' | 'evented'; evented: boolean };

const ENGINES: Engine[] = [
  { name: 'default', evented: false },
  { name: 'evented', evented: true },
];

/**
 * Build a one-step workflow whose single step returns `payload`. The result's
 * step output is the round-tripped value.
 */
async function runWorkflowReturning(payload: unknown) {
  const step = createStep({
    id: 'emit',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async () => ({ value: payload }),
  });

  const workflow = createWorkflow({
    id: 'one-step',
    inputSchema: z.any(),
    outputSchema: z.any(),
  })
    .then(step)
    .commit();

  const mastra = new Mastra({
    workflows: { 'one-step': workflow },
    storage: new InMemoryStore(),
    logger: false,
  });
  // Re-bind the workflow to the per-test Mastra so its workers (if any) start.
  workflow.__registerMastra(mastra);

  const run = await workflow.createRun();
  const result = await run.start({ inputData: {} });

  if (result.status !== 'success') {
    throw new Error(`workflow did not succeed: ${result.status}`);
  }
  // The `emit` step output is `{ value: payload }`.
  return (result.steps['emit'] as { status: 'success'; output: { value: unknown } }).output.value;
}

describe.each(ENGINES)('step-output type preservation ($name engine)', ({ evented }) => {
  beforeEach(() => {
    if (evented) process.env.MASTRA_EVENTED_EXECUTION = 'true';
  });
  afterEach(() => {
    delete process.env.MASTRA_EVENTED_EXECUTION;
  });

  it('preserves Date instances (instance identity restored, getTime intact)', async () => {
    const d = new Date('2024-06-15T12:34:56.789Z');
    const out = (await runWorkflowReturning(d)) as Date;
    expect(out).toBeInstanceOf(Date);
    expect(out.getTime()).toBe(d.getTime());
  });

  it('preserves Error instances (name, message, stack, custom fields)', async () => {
    class MyError extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.name = 'MyError';
        this.code = code;
      }
    }
    const err = new MyError('boom', 'E_BOOM');
    const out = (await runWorkflowReturning(err)) as Error & { code?: string };
    expect(out).toBeInstanceOf(Error);
    expect(out.message).toBe('boom');
    expect(out.name).toBe('MyError');
    expect(out.code).toBe('E_BOOM');
  });

  it('preserves Map instances (key/value pairs, methods callable)', async () => {
    const m = new Map<string, number>([
      ['a', 1],
      ['b', 2],
    ]);
    const out = (await runWorkflowReturning(m)) as Map<string, number>;
    expect(out).toBeInstanceOf(Map);
    expect(out.get('a')).toBe(1);
    expect(out.get('b')).toBe(2);
    expect(out.size).toBe(2);
  });

  it('preserves Set instances (member identity, methods callable)', async () => {
    const s = new Set<string>(['x', 'y', 'z']);
    const out = (await runWorkflowReturning(s)) as Set<string>;
    expect(out).toBeInstanceOf(Set);
    expect(out.has('x')).toBe(true);
    expect(out.has('y')).toBe(true);
    expect(out.has('z')).toBe(true);
    expect(out.size).toBe(3);
  });

  it('preserves RegExp instances (source + flags, .test() works)', async () => {
    const re = /foo.*bar/gi;
    const out = (await runWorkflowReturning(re)) as RegExp;
    expect(out).toBeInstanceOf(RegExp);
    expect(out.source).toBe('foo.*bar');
    expect(out.flags).toBe('gi');
    expect(out.test('FOOXYZBAR')).toBe(true);
  });

  it('preserves URL instances (.href stable, parts accessible)', async () => {
    const url = new URL('https://example.com/path?q=1#h');
    const out = (await runWorkflowReturning(url)) as URL;
    expect(out).toBeInstanceOf(URL);
    expect(out.href).toBe(url.href);
    expect(out.host).toBe('example.com');
    expect(out.pathname).toBe('/path');
  });

  it('preserves BigInt values', async () => {
    const b = 12345678901234567890n;
    const out = (await runWorkflowReturning(b)) as bigint;
    expect(typeof out).toBe('bigint');
    expect(out).toBe(b);
  });

  it('preserves explicitly-undefined fields in plain objects', async () => {
    // JSON drops `headers: undefined`; the workflow path must keep it (e.g.
    // model response fields like `providerMetadata`, `usage.cacheRead`).
    const payload = { headers: undefined, value: 7 };
    const out = (await runWorkflowReturning(payload)) as { headers?: unknown; value: number };
    expect('headers' in out).toBe(true);
    expect(out.headers).toBeUndefined();
    expect(out.value).toBe(7);
  });

  it('preserves nested mixed payloads (Map of Dates of Errors)', async () => {
    const inner = new Error('nested');
    const m = new Map<string, { when: Date; why: Error }>([['k', { when: new Date(0), why: inner }]]);
    const out = (await runWorkflowReturning(m)) as Map<string, { when: Date; why: Error }>;
    expect(out).toBeInstanceOf(Map);
    const entry = out.get('k')!;
    expect(entry.when).toBeInstanceOf(Date);
    expect(entry.when.getTime()).toBe(0);
    expect(entry.why).toBeInstanceOf(Error);
    expect(entry.why.message).toBe('nested');
  });

  it('preserves self-referential cycles without throwing', async () => {
    // The codec replaces cycles with null on the second visit (see
    // codec.test.ts); the in-process clone path tracks via WeakMap and
    // restores the cycle. Either way, the workflow must not throw.
    const a: any = { name: 'a' };
    a.self = a;
    const out = (await runWorkflowReturning(a)) as { name: string; self?: unknown };
    expect(out.name).toBe('a');
    // The self-reference may be the same object (default engine via WeakMap)
    // or null (codec engine). Both are acceptable per the codec contract.
    expect(out.self === out || out.self === null).toBe(true);
  });
});
