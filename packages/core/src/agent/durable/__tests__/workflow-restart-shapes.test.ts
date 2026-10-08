// The T65 (`wf-restart-shapes`) restart cells that are green on this SHA. A workflow is cut off with
// part of its work already committed, restarted from a copy of its rows in a fresh module graph, and
// must finish correctly without re-running what was already saved.
//
// Two harness conditions are represented. `wf-evented-restart` parks a step or write and restarts:
// `sequential`, `parallel`, `conditional`, `foreach`, `foreach-gap`, `empty-path`. `wf-default` is the
// harness's in-process reference on the default engine, and contributes the shapes whose default-engine
// restart is also green: `sequential`, `parallel`, `conditional`, `state`, `finished`,
// `nested-done`, `nested-pending`. `empty-path` is evented-only — the default engine never saves a
// `running` snapshot with no active step, so the harness leaves that shape out of `wf-default` too.
//
// Shape restarts that are still red on this SHA are recorded as evidence in
// `.mastracode/plans/cor-1382-restart-helper.proof/sigkill-only-repro.scratch.test.ts`, to land with
// their owning fixes; none of them is skipped here. On the evented engine: `state` (COR-1352) parks
// in a step like `sequential` but loses the finished step's mark, and
// `finished`/`nested-done`/`nested-pending` (COR-1333/1351/1348) are interrupted between two persisted
// states rather than inside a step. On the default engine `foreach` re-runs
// completed item 1 (COR-1350), and `foreach-gap` cannot be cut at all: the interruption point the
// shape needs (`item`'s partial output array) is never written, so the harness does not exercise it
// either. These cells assert current behaviour, so a shape the harness's `RESULTS.md` table records
// as failing but that restarts cleanly here is committed as a passing cell; the recorded table is a
// baseline question for the harness, not a reason to leave a green cell out.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { DEFAULT_TIMEOUT_MS, createGate, createRestartScenario, findRow } from './restart-harness';
import type { Checkpoint, CoreGraph, Gate } from './restart-harness';

const N = z.object({ n: z.number() });

type Entry = { generation: number; step: string; event: string; input?: any };
type Engine = 'default' | 'evented';

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gates first: a parked step must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

const ctxOf = (snapshot: any, step: string) => snapshot?.context?.[step];

/** The harness builds one shape definition per engine and swaps the workflow factories. */
function factories(core: CoreGraph, engine: Engine): { createStep: any; createWorkflow: any } {
  return engine === 'default'
    ? { createStep: core.createStep, createWorkflow: core.createWorkflow }
    : { createStep: core.createEventedStep, createWorkflow: core.createEventedWorkflow };
}

function steps(core: CoreGraph, engine: Engine, log: Entry[], generation: number, gate: Gate) {
  const { createStep } = factories(core, engine);
  return (id: string, block = false) =>
    createStep({
      id,
      inputSchema: N,
      outputSchema: N,
      execute: async ({ inputData }: any) => {
        log.push({ generation, step: id, event: 'start', input: inputData });
        if (block && generation === 1) await gate.wait();
        log.push({ generation, step: id, event: 'commit' });
        return { n: inputData.n + 1 };
      },
    } as any);
}

function buildShape(
  core: CoreGraph,
  engine: Engine,
  id: string,
  shape: ShapeName,
  log: Entry[],
  generation: number,
  gate: Gate,
) {
  const { createStep, createWorkflow } = factories(core, engine);
  const step = steps(core, engine, log, generation, gate);
  const wf = (opts: { input?: any; output?: any; state?: any } = {}): any =>
    createWorkflow({
      id,
      inputSchema: opts.input ?? N,
      outputSchema: opts.output ?? N,
      ...(opts.state ? { state: opts.state } : {}),
    } as any);
  switch (shape) {
    case 'sequential':
      return wf().then(step('first')).then(step('block', true)).then(step('last')).commit();
    case 'parallel': {
      const join = createStep({
        id: 'join',
        inputSchema: z.object({ left: N, right: N }),
        outputSchema: N,
        execute: async ({ inputData }: any) => ({ n: inputData.left.n + inputData.right.n }),
      } as any);
      return wf()
        .then(step('first'))
        .then(step('block', true))
        .parallel([step('left'), step('right')])
        .then(join)
        .commit();
    }
    case 'conditional':
      return wf({ output: z.object({ big: N.optional(), small: N.optional() }) })
        .then(step('first'))
        .then(step('block', true))
        .branch([
          [async ({ inputData }: any) => inputData.n >= 3, step('big')],
          [async ({ inputData }: any) => inputData.n < 3, step('small')],
        ] as any)
        .commit();
    case 'foreach':
    case 'foreach-gap': {
      const item = createStep({
        id: 'item',
        inputSchema: N,
        outputSchema: N,
        execute: async ({ inputData }: any) => {
          log.push({ generation, step: 'item', event: 'start', input: inputData });
          if (generation === 1 && inputData.n === 2) await gate.wait();
          return { n: inputData.n * 10 };
        },
      });
      const sum = createStep({
        id: 'sum',
        inputSchema: z.array(N),
        outputSchema: N,
        execute: async ({ inputData }: any) => ({ n: inputData.reduce((a: number, b: any) => a + b.n, 0) }),
      });
      return createWorkflow({ id, inputSchema: z.array(N), outputSchema: N })
        .foreach(item, { concurrency: 1 })
        .then(sum)
        .commit();
    }
    case 'state': {
      const S = z.object({ marks: z.array(z.string()).default([]) });
      const mark = (sid: string, block = false) =>
        createStep({
          id: sid,
          inputSchema: N,
          outputSchema: N,
          stateSchema: S,
          execute: async ({ inputData, state, setState }: any) => {
            log.push({ generation, step: sid, event: 'start', input: inputData });
            if (block && generation === 1) await gate.wait();
            await setState({ marks: [...(state?.marks ?? []), sid] });
            log.push({ generation, step: sid, event: 'commit' });
            return { n: inputData.n + 1 };
          },
        } as any);
      const report = createStep({
        id: 'report',
        inputSchema: N,
        outputSchema: z.object({ n: z.number(), marks: z.array(z.string()) }),
        stateSchema: S,
        execute: async ({ inputData, state }: any) => ({ n: inputData.n, marks: state?.marks ?? [] }),
      } as any);
      return wf({ output: z.object({ n: z.number(), marks: z.array(z.string()) }), state: S })
        .then(mark('first') as any)
        .then(mark('block', true) as any)
        .then(report as any)
        .commit();
    }
    case 'finished':
      return wf().then(step('first')).then(step('second')).then(step('last')).commit();
    case 'nested-done':
    case 'nested-pending': {
      const nested = createWorkflow({ id: `${id}-nested`, inputSchema: N, outputSchema: N })
        .then(step('inner'))
        .commit();
      return wf()
        .then(step('first'))
        .then(nested as any)
        .then(step('last'))
        .commit();
    }
    case 'empty-path':
      // No parked step: the cut lands on the start save, before `first` is saved.
      return wf().then(step('first')).then(step('last')).commit();
  }
}

type ShapeName =
  | 'sequential'
  | 'parallel'
  | 'conditional'
  | 'foreach'
  | 'foreach-gap'
  | 'state'
  | 'finished'
  | 'nested-done'
  | 'nested-pending'
  | 'empty-path';
type ShapeSpec = {
  input: any;
  expect: (r: any) => boolean;
  reruns?: string[];
  never?: string[];
  rerunItems?: number[];
  reenter?: { step: string; n: number };
  /** Park this step, then restart from the gate checkpoint. */
  blockStep?: string;
  /** No parked step: restart from the first captured write whose root snapshot matches. */
  cut?: (snapshot: any) => boolean;
  /** Cut inside a write instead: park the first write whose snapshot matches. */
  hold?: { nested?: boolean; when: (snapshot: any) => boolean };
};

const SHAPES: Record<ShapeName, ShapeSpec> = {
  sequential: {
    input: { n: 1 },
    expect: (r: any) => r?.n === 4,
    reruns: ['first'],
    reenter: { step: 'block', n: 2 },
  },
  parallel: { input: { n: 1 }, expect: (r: any) => r?.n === 8, reruns: ['first'] },
  conditional: {
    input: { n: 1 },
    expect: (r: any) => r?.big?.n === 4 && !r?.small,
    reruns: ['first'],
    never: ['small'],
  },
  foreach: {
    input: [{ n: 1 }, { n: 2 }, { n: 3 }],
    expect: (r: any) => r?.n === 60,
    rerunItems: [1],
    blockStep: 'item',
  },
  'foreach-gap': {
    input: [{ n: 1 }, { n: 2 }, { n: 3 }],
    expect: (r: any) => r?.n === 60,
    rerunItems: [1],
    // COR-1350: item 1 was saved, but item 2 was only a null placeholder and never started.
    hold: { when: (s: any) => ctxOf(s, 'item')?.output?.[0] != null && ctxOf(s, 'item')?.output?.[1] === null },
  },
  state: {
    input: { n: 1 },
    expect: (r: any) => r?.n === 3 && JSON.stringify(r?.marks) === JSON.stringify(['first', 'block']),
    reruns: ['first'],
  },
  finished: {
    input: { n: 1 },
    expect: (r: any) => r?.n === 4,
    reruns: ['first', 'second'],
    reenter: { step: 'last', n: 3 },
    // COR-1354: `second` had succeeded, `last` had not started.
    hold: { when: (s: any) => ctxOf(s, 'second')?.status === 'success' && !ctxOf(s, 'last') },
  },
  'nested-done': {
    input: { n: 1 },
    expect: (r: any) => r?.n === 4,
    reruns: ['first', 'inner'],
    // COR-1351: the nested run finished but its parent had not saved the outcome yet.
    hold: { nested: true, when: (s: any) => s?.status === 'success' },
  },
  'nested-pending': {
    input: { n: 1 },
    expect: (r: any) => r?.n === 4,
    reruns: ['first'],
    // COR-1348: the nested run was created but had not started.
    hold: { nested: true, when: (s: any) => s?.status === 'pending' },
  },
  'empty-path': {
    input: { n: 1 },
    expect: (r: any) => r?.n === 3,
    // COR-1353: the root is saved `running` with no active step and `first` not yet saved.
    cut: (s: any) => s?.status === 'running' && !(s.activePaths ?? []).length && !ctxOf(s, 'first'),
  },
};

/** Which shapes restart cleanly on each engine (see the file header for the red ones). */
const GREEN: Record<Engine, ShapeName[]> = {
  default: ['sequential', 'parallel', 'conditional', 'state', 'finished', 'nested-done', 'nested-pending'],
  evented: ['sequential', 'parallel', 'conditional', 'foreach', 'foreach-gap', 'empty-path'],
};

describe('T65 wf-restart-shapes in a fresh module graph', () => {
  for (const engine of ['default', 'evented'] as Engine[]) {
    for (const shapeName of GREEN[engine]) {
      const shape = SHAPES[shapeName];
      it(`${engine} / ${shapeName}: restarts from the interrupted snapshot and does not re-run completed steps`, async () => {
        const id = `t65-${engine}-${shapeName}`;
        const runId = `t65-run-${engine}-${shapeName}`;
        const log: Entry[] = [];
        const gate = createGate();
        const scenario = createRestartScenario({
          kind: 'workflow',
          runId,
          hold: shape.hold
            ? { workflowName: shape.hold.nested ? `${id}-nested` : undefined, when: shape.hold.when }
            : undefined,
          build: ({ core, generation }) => buildShape(core, engine, id, shapeName, log, generation, gate),
        });
        scenarios.push(scenario);
        const original = await scenario.start(async ({ workflow }) => {
          const run = await workflow.createRun({ runId });
          return run.start({ inputData: shape.input });
        });

        let checkpoint: Checkpoint;
        if (shape.hold) {
          // The engine is parked inside a write, so nothing can be persisted after the matched one.
          const held = await Promise.race([original.held!.then(() => true), original.settled.then(() => false)]);
          expect(held, 'not exercised: the write the shape cuts at never happened').toBe(true);
          checkpoint = await original.checkpoint();
          original.releaseHold();
        } else if (shape.cut) {
          // No parked step: graph 1 runs to the end, and the cut is the first captured write whose
          // root snapshot is the interrupted state. A restart from that copy is the kill landing there.
          await original.settled;
          const hit = original.checkpoints.find(c => shape.cut!(findRow(c, id, runId)?.snapshot));
          expect(hit, 'not exercised: no write captured the interrupted state').toBeDefined();
          checkpoint = hit!;
        } else {
          // Only the gated shapes park a step, so the gate is registered there.
          gates.push(gate);
          const reached = await Promise.race([gate.reached.then(() => true), original.settled.then(() => false)]);
          expect(reached, 'not exercised: run ended before the gate').toBe(true);
          // The step is parked; wait until its entry is persisted as in-flight. Evented foreach marks
          // the entry success and keeps a null slot for the item still running, so it has its own probe.
          await vi.waitFor(
            async () => {
              const entry = ctxOf(
                findRow(await original.checkpoint(), id, runId)?.snapshot,
                shape.blockStep ?? 'block',
              );
              if (shape.blockStep === 'item')
                expect(entry?.output?.[0] != null && entry?.output?.[1] === null).toBe(true);
              else expect(entry?.status).toBe('running');
            },
            { timeout: DEFAULT_TIMEOUT_MS },
          );
          checkpoint = await original.checkpoint();
        }
        expect(findRow(checkpoint, id, runId)?.snapshot.status).toBe('running');

        const { result } = await scenario.restart(checkpoint);
        const starts = (step: string) => log.filter(e => e.generation === 2 && e.step === step && e.event === 'start');

        expect(result.status).toBe('success');
        expect(
          shape.expect(result.result),
          `result is correct for ${engine} / ${shapeName}: ${JSON.stringify(result.result)}`,
        ).toBe(true);
        if (shape.reenter) {
          expect(starts(shape.reenter.step).length, `interrupted step re-entered once`).toBe(1);
          expect(starts(shape.reenter.step)[0]!.input?.n).toBe(shape.reenter.n);
        }
        for (const done of shape.reruns ?? []) expect(starts(done).length, `\`${done}\` not re-run`).toBe(0);
        for (const never of shape.never ?? []) {
          expect(
            log.some(e => e.step === never && e.event === 'start'),
            `untaken branch \`${never}\` never ran`,
          ).toBe(false);
        }
        for (const n of shape.rerunItems ?? []) {
          expect(starts('item').filter(e => e.input?.n === n).length, `completed foreach item n=${n} not re-run`).toBe(
            0,
          );
        }
        if (shapeName === 'foreach-gap') {
          expect(
            starts('item')
              .map(entry => entry.input?.n)
              .sort(),
          ).toEqual([2, 3]);
        }
      }, 60_000);
    }
  }
});

it('evented foreach restarts the recorded child run without replaying its completed steps', async () => {
  const id = 'foreach-child-restart';
  const runId = 'foreach-child-restart-run';
  const log: Entry[] = [];
  const gate = createGate();
  gates.push(gate);
  const scenario = createRestartScenario({
    kind: 'workflow',
    runId,
    build: ({ core, generation }) => {
      const { createStep, createWorkflow } = factories(core, 'evented');
      const first = createStep({
        id: 'child-first',
        inputSchema: N,
        outputSchema: N,
        execute: async ({ inputData }: any) => {
          log.push({ generation, step: 'child-first', event: 'start', input: inputData });
          return { n: inputData.n + 1 };
        },
      });
      const last = createStep({
        id: 'child-last',
        inputSchema: N,
        outputSchema: N,
        execute: async ({ inputData }: any) => {
          log.push({ generation, step: 'child-last', event: 'start', input: inputData });
          if (generation === 1 && inputData.n === 3) await gate.wait();
          return { n: inputData.n + 1 };
        },
      });
      const child = createWorkflow({ id: `${id}-child`, inputSchema: N, outputSchema: N })
        .then(first)
        .then(last)
        .commit();
      return createWorkflow({ id, inputSchema: z.array(N), outputSchema: z.array(N) })
        .foreach(child, { concurrency: 1 })
        .commit();
    },
  });
  scenarios.push(scenario);
  const original = await scenario.start(async ({ workflow }) => {
    const run = await workflow.createRun({ runId });
    return run.start({ inputData: [{ n: 1 }, { n: 2 }] });
  });
  expect(await Promise.race([gate.reached.then(() => true), original.settled.then(() => false)])).toBe(true);
  const checkpoint = await original.checkpoint();
  const parent = findRow(checkpoint, id, runId)!.snapshot;
  expect(parent.activeStepsPath[`${id}-child`]).toEqual([0, 1]);
  expect(ctxOf(parent, `${id}-child`).output).toEqual([{ n: 3 }, null]);
  const childRunId = ctxOf(parent, `${id}-child`).metadata.nestedRunId;
  expect(childRunId).toBeTruthy();
  expect(ctxOf(findRow(checkpoint, `${id}-child`, childRunId)!.snapshot, 'child-first').status).toBe('success');
  const { result } = await scenario.restart(checkpoint);
  expect(result.status).toBe('success');
  expect(result.result).toEqual([{ n: 3 }, { n: 4 }]);
  expect(log.filter(e => e.generation === 2 && e.step === 'child-first')).toEqual([]);
  expect(log.filter(e => e.generation === 2 && e.step === 'child-last').map(e => e.input)).toEqual([{ n: 3 }]);
}, 60_000);
