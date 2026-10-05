// The `wf-evented-restart` cells of harness T65 (`wf-restart-shapes`) that are green on this SHA:
// an evented workflow is cut off in a parked step, restarted from a copy of its rows in a fresh
// module graph, and must finish correctly without re-running steps that already completed.
//
// Every green `wf-evented-restart` shape the helper can cut is here: `sequential`, `parallel`,
// `conditional` and `foreach` park in a step (gate checkpoint), and `empty-path` is cut at the
// every-write checkpoint where the interrupted state first appears in storage. The five red shapes
// on this SHA stay as recorded evidence in
// `.mastracode/plans/cor-1382-restart-helper.proof/sigkill-only-repro.scratch.test.ts`, to land with
// their owning fixes: `state` (COR-1352) parks in a step like `sequential` but does not survive the
// restart, and `finished`/`foreach-gap`/`nested-done`/`nested-pending` (COR-1333/1350/1351/1348) are
// interrupted between two persisted states rather than inside a step.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGate, createRestartScenario, findRow } from './restart-harness';
import type { Checkpoint, CoreGraph, Gate } from './restart-harness';

const N = z.object({ n: z.number() });

type Entry = { generation: number; step: string; event: string; input?: any };

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gates first: a parked step must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

const ctxOf = (snapshot: any, step: string) => snapshot?.context?.[step];

function steps(core: CoreGraph, log: Entry[], generation: number, gate: Gate) {
  return (id: string, block = false) =>
    core.createEventedStep({
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
  id: string,
  shape: 'sequential' | 'parallel' | 'conditional' | 'foreach' | 'empty-path',
  log: Entry[],
  generation: number,
  gate: Gate,
) {
  const step = steps(core, log, generation, gate);
  const wf = (opts: { input?: any; output?: any } = {}) =>
    core.createEventedWorkflow({ id, inputSchema: opts.input ?? N, outputSchema: opts.output ?? N } as any);
  switch (shape) {
    case 'sequential':
      return wf().then(step('first')).then(step('block', true)).then(step('last')).commit();
    case 'parallel': {
      const join = core.createEventedStep({
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
    case 'foreach': {
      const item = core.createEventedStep({
        id: 'item',
        inputSchema: N,
        outputSchema: N,
        execute: async ({ inputData }: any) => {
          log.push({ generation, step: 'item', event: 'start', input: inputData });
          if (generation === 1 && inputData.n === 2) await gate.wait();
          return { n: inputData.n * 10 };
        },
      });
      const sum = core.createEventedStep({
        id: 'sum',
        inputSchema: z.array(N),
        outputSchema: N,
        execute: async ({ inputData }: any) => ({ n: inputData.reduce((a: number, b: any) => a + b.n, 0) }),
      });
      return core
        .createEventedWorkflow({ id, inputSchema: z.array(N), outputSchema: N })
        .foreach(item, { concurrency: 1 })
        .then(sum)
        .commit();
    }
    case 'empty-path':
      // No parked step: the cut lands on the start save, before `first` is saved.
      return wf().then(step('first')).then(step('last')).commit();
  }
}

type ShapeName = 'sequential' | 'parallel' | 'conditional' | 'foreach' | 'empty-path';
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
  'empty-path': {
    input: { n: 1 },
    expect: (r: any) => r?.n === 3,
    // COR-1353: the root is saved `running` with no active step and `first` not yet saved.
    cut: (s: any) => s?.status === 'running' && !(s.activePaths ?? []).length && !ctxOf(s, 'first'),
  },
};

const SHAPE_ENTRIES = Object.entries(SHAPES) as [ShapeName, ShapeSpec][];

describe('T65 wf-evented-restart shapes in a fresh module graph', () => {
  for (const [shapeName, shape] of SHAPE_ENTRIES) {
    it(`${shapeName}: restarts from the interrupted snapshot and does not re-run completed steps`, async () => {
      const id = `t65-${shapeName}`;
      const runId = `t65-run-${shapeName}`;
      const log: Entry[] = [];
      const gate = createGate();
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        build: ({ core, generation }) => buildShape(core, id, shapeName, log, generation, gate),
      });
      scenarios.push(scenario);
      const original = await scenario.start(async ({ workflow }) => {
        const run = await workflow.createRun({ runId });
        return run.start({ inputData: shape.input });
      });

      let checkpoint: Checkpoint;
      if (shape.cut) {
        // No parked step: graph 1 runs to the end, and the cut is the first captured write whose root
        // snapshot is the interrupted state. A restart from that copy is the kill landing there.
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
        await vi.waitFor(async () => {
          const entry = ctxOf(findRow(await original.checkpoint(), id, runId)?.snapshot, shape.blockStep ?? 'block');
          if (shape.blockStep === 'item') expect(entry?.output?.[0] != null && entry?.output?.[1] === null).toBe(true);
          else expect(entry?.status).toBe('running');
        });
        checkpoint = await original.checkpoint();
      }
      expect(findRow(checkpoint, id, runId)?.snapshot.status).toBe('running');

      const { result } = await scenario.restart(checkpoint);
      const starts = (step: string) => log.filter(e => e.generation === 2 && e.step === step && e.event === 'start');

      expect(result.status).toBe('success');
      expect(shape.expect(result.result), `result is correct for ${shapeName}: ${JSON.stringify(result.result)}`).toBe(
        true,
      );
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
        expect(starts('item').filter(e => e.input?.n === n).length, `completed foreach item n=${n} not re-run`).toBe(0);
      }
    }, 60_000);
  }
});
