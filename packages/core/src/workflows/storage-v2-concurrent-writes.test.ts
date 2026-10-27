import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

type Storage = InstanceType<typeof MockStore>;

// Branches of a parallel block, the matching arms of a branch, and foreach iterations write to
// the same run at the same time. These tests run those workflows against stores with the
// timing of real ones and check that storage ends up right: right after the block (what a
// restart would load if the process died there) and at the end of the run.

const TRIALS = 10;

const num = z.object({ n: z.number() });
const out = z.object({ n: z.number(), by: z.string() });
const marks = z.record(z.string(), z.boolean());

/** Seeded, so a failing trial can be run again. */
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(1);
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * A step that returns `{ n: n + 1, by: id }`. With `check`, its input schema checks the input
 * against another service (an async refinement taking `check` ms, or 1-10ms when `true`). With
 * `mark`, it records itself in workflow state.
 */
function branchStep(id: string, { check, mark }: { check?: boolean | number; mark?: boolean } = {}) {
  return createStep({
    id,
    inputSchema: check
      ? num.refine(async () => {
          await sleep(check === true ? between(1, 10) : check);
          return true;
        })
      : num,
    outputSchema: out,
    stateSchema: marks,
    execute: async ({ inputData, state, setState }) => {
      if (mark) await setState({ ...state, [id]: true });
      return { n: inputData.n + 1, by: id };
    },
  });
}

type StoredRun = Awaited<ReturnType<NonNullable<Storage['stores']['workflows']>['loadWorkflowRun']>>;

/** Reads the stored run right after the block, which is what a restart would load if the process died there. */
function afterBlockStep(storage: Storage, workflowName: string, crashPoints: Map<string, CrashPoint>) {
  return createStep({
    id: 'after-block',
    inputSchema: z.any(),
    outputSchema: z.any(),
    stateSchema: marks,
    execute: async ({ inputData, runId, state }) => {
      const stored = await storage.stores.workflows!.loadWorkflowRun({ workflowName, runId, successfulSteps: 'full' });
      crashPoints.set(runId, { stored, state: structuredClone(state) });
      return inputData;
    },
  });
}

interface CrashPoint {
  stored: StoredRun;
  state: Record<string, boolean>;
}

/** Two entries after the block, so the block's results have been evicted and are read back from storage. */
function readBackStep(stepIds: string[]) {
  return createStep({
    id: 'read-back',
    inputSchema: z.any(),
    outputSchema: z.any(),
    execute: async ({ getStepResultAsync }) =>
      Object.fromEntries(await Promise.all(stepIds.map(async id => [id, await getStepResultAsync(id)]))),
  });
}

interface Scenario {
  inputData: unknown;
  /** The block's steps and their outputs */
  expected: Record<string, unknown>;
  /** Workflow state after the block */
  expectedState: Record<string, boolean>;
  block: (workflow: any) => any;
}

const answer = (by: string) => ({ n: 1, by });

const scenarios: Record<string, Scenario> = {
  'parallel steps': {
    inputData: { n: 0 },
    expected: { a: answer('a'), b: answer('b'), c: answer('c'), d: answer('d') },
    expectedState: { a: true, b: true },
    block: workflow =>
      workflow.parallel([
        branchStep('a', { mark: true }),
        branchStep('b', { mark: true }),
        branchStep('c'),
        branchStep('d'),
      ]),
  },
  'parallel steps, two checking their input against a service': {
    inputData: { n: 0 },
    expected: { a: answer('a'), b: answer('b'), c: answer('c'), d: answer('d') },
    expectedState: { a: true, b: true },
    block: workflow =>
      workflow.parallel([
        branchStep('a', { mark: true }),
        branchStep('b', { mark: true }),
        branchStep('c', { check: true }),
        branchStep('d', { check: true }),
      ]),
  },
  'branch with every arm matching, two checking their input against a service': {
    inputData: { n: 0 },
    expected: { a: answer('a'), b: answer('b'), c: answer('c'), d: answer('d') },
    expectedState: { a: true, b: true },
    block: workflow =>
      workflow.branch([
        [async () => true, branchStep('a', { mark: true })],
        [async () => true, branchStep('b', { mark: true })],
        [async () => true, branchStep('c', { check: true })],
        [async () => true, branchStep('d', { check: true })],
      ]),
  },
  'foreach with concurrency 3, checking each item against a service': {
    inputData: Array.from({ length: 6 }, () => ({ n: 0 })),
    expected: { item: Array.from({ length: 6 }, () => answer('item')) },
    expectedState: {},
    block: workflow => workflow.foreach(branchStep('item', { check: true }), { concurrency: 3 }),
  },
};

interface Timing {
  commit: number;
  reply: number;
}

/** How long a write takes to commit and to reply. `undefined` commits and replies at once. */
type WriteTiming = (write: RecordedWrite) => Timing | undefined;

const storeTimings: Record<string, WriteTiming | undefined> = {
  // The in-memory store applies a write when it's called and replies right away.
  'in-memory': undefined,
  // A networked store where the writes to one run are serialized (pg locks the run's row) and
  // each reply is sent when its write commits. A write waits 1-8ms for a connection and the
  // network, so writes can commit in a different order than they were issued, but they reply in
  // the order they commit.
  'networked, replies in commit order': () => ({ commit: between(1, 8), reply: 1 }),
  // The same, but a reply can also take 0-8ms, so replies can arrive in a different order than
  // the writes committed.
  'networked, replies in any order': () => ({ commit: between(1, 8), reply: between(0, 8) }),
};

interface RecordedWrite {
  runId: string;
  checkpoint: boolean;
  status: string;
  steps: Record<string, string>;
  state: boolean;
  /** Ticks of one clock, so the three events of every write can be ordered against each other */
  issued: number;
  committed: number;
  replied: number;
}

/** Delays the store's storage v2 writes by `timing` and records when each one was issued, committed and replied to. */
function timeWrites(storage: Storage, timing: WriteTiming | undefined): RecordedWrite[] {
  const store = storage.stores.workflows!;
  const writes: RecordedWrite[] = [];
  let clock = 0;
  for (const method of ['writeWorkflowRunCheckpoint', 'appendWorkflowRunEntries'] as const) {
    const original = store[method].bind(store) as (args: any) => Promise<void>;
    store[method] = async (args: Parameters<(typeof store)[typeof method]>[0]) => {
      const write: RecordedWrite = {
        runId: args.runId,
        checkpoint: method === 'writeWorkflowRunCheckpoint',
        status: args.header.status,
        steps: Object.fromEntries(
          Object.entries(args.steps).map(([stepId, result]) => [stepId, (result as { status: string }).status]),
        ),
        state: args.state !== undefined,
        issued: clock++,
        committed: -1,
        replied: -1,
      };
      writes.push(write);
      const delays = timing?.(write);
      if (delays) await sleep(delays.commit);
      // The in-memory store applies a write before its first await.
      const applied = original(args);
      write.committed = clock++;
      await applied;
      if (delays) await sleep(delays.reply);
      write.replied = clock++;
    };
  }
  return writes;
}

/**
 * Checks the rule that keeps overlapping writes from undoing each other: a write issued while an
 * earlier one is in flight never overlaps a checkpoint, and the two don't carry the same step or
 * both carry state. Each reported problem is a write that could commit first and be overwritten.
 */
function overlapProblems(writes: RecordedWrite[]): string[] {
  const problems: string[] = [];
  for (const later of writes) {
    for (const earlier of writes) {
      if (!(earlier.issued < later.issued && later.issued < earlier.replied)) continue;
      const pair = `writes ${earlier.issued} and ${later.issued}`;
      if (earlier.checkpoint || later.checkpoint) problems.push(`${pair} overlap, and one is a checkpoint`);
      for (const stepId of Object.keys(later.steps)) {
        if (stepId in earlier.steps) problems.push(`${pair} overlap, and both carry ${stepId}`);
      }
      if (earlier.state && later.state) problems.push(`${pair} overlap, and both carry state`);
    }
  }
  return problems;
}

function wrongSteps(
  steps: Record<string, { status?: string; output?: unknown } | undefined> | undefined,
  expected: Record<string, unknown>,
): string[] {
  return Object.entries(expected).flatMap(([stepId, output]) => {
    const result = steps?.[stepId];
    if (result?.status === 'success' && isDeepStrictEqual(result.output, output)) return [];
    return [`${stepId} is ${result?.status ?? 'missing'} with output ${JSON.stringify(result?.output)}`];
  });
}

describe('storage v2 writes that overlap', () => {
  let seed = 0;
  for (const [storeName, timing] of Object.entries(storeTimings)) {
    for (const [workflowName, scenario] of Object.entries(scenarios)) {
      const cellSeed = ++seed;
      it(`${workflowName}, on a ${storeName} store`, { timeout: 60_000 }, async () => {
        random = mulberry32(cellSeed);
        const storage = new MockStore();
        const writes = timeWrites(storage, timing);
        const crashPoints = new Map<string, CrashPoint>();
        const id = 'concurrent';
        const blockIds = Object.keys(scenario.expected);
        const workflow = scenario
          .block(
            createWorkflow({
              id,
              inputSchema: z.any(),
              outputSchema: z.any(),
              stateSchema: marks,
              options: { storageVersion: 2 },
            }),
          )
          .then(afterBlockStep(storage, id, crashPoints))
          .then(readBackStep(blockIds))
          .commit();
        new Mastra({ logger: false, storage, workflows: { [id]: workflow } });

        const problems: string[] = [];

        for (let trial = 0; trial < TRIALS; trial++) {
          const runId = `run-${trial}`;
          const run = await workflow.createRun({ runId });
          const result = await run
            .start({ inputData: scenario.inputData, initialState: {} })
            .catch((error: unknown) => ({ status: 'threw', error }) as const);

          const overlapping = overlapProblems(writes.filter(write => write.runId === runId));
          if (overlapping.length) problems.push(`${runId}: ${overlapping.join('; ')}`);

          const crashPoint = crashPoints.get(runId);
          const afterBlock = crashPoint
            ? [
                ...wrongSteps(crashPoint.stored?.steps, scenario.expected),
                ...(isDeepStrictEqual(crashPoint.stored?.state, crashPoint.state)
                  ? []
                  : [`state is ${JSON.stringify(crashPoint.stored?.state)}, not ${JSON.stringify(crashPoint.state)}`]),
              ]
            : ['the step after the block never ran'];

          const stored = await storage.stores.workflows!.loadWorkflowRun({
            workflowName: id,
            runId,
            successfulSteps: 'full',
          });
          const atEnd =
            result.status === 'threw'
              ? [`the run threw: ${result.error instanceof Error ? result.error.message : String(result.error)}`]
              : result.status !== 'success'
                ? [`the run ${result.status}`]
                : [
                    ...(isDeepStrictEqual(result.result, scenario.expected)
                      ? []
                      : [`read back ${JSON.stringify(result.result)}`]),
                    ...wrongSteps(result.steps as any, scenario.expected).map(problem => `result: ${problem}`),
                    ...wrongSteps(stored?.steps, scenario.expected).map(problem => `stored: ${problem}`),
                    ...(isDeepStrictEqual(stored?.state, scenario.expectedState)
                      ? []
                      : [`stored state is ${JSON.stringify(stored?.state)}`]),
                  ];

          if (afterBlock.length) problems.push(`${runId}, right after the block: ${afterBlock.join('; ')}`);
          if (atEnd.length) problems.push(`${runId}, at the end: ${atEnd.join('; ')}`);
        }

        expect(problems).toEqual([]);
      });
    }
  }
});

describe('a slow first checkpoint', () => {
  // A run's first running write is a checkpoint, replacing every entry stored for the run. Here it
  // takes 30ms to commit while every other write commits at once. If it were in flight with the
  // block's start writes, `b` could finish, `c`'s start write (after checking its input for 5ms)
  // could store `b`'s result, and then the checkpoint would commit over it.
  const blocks: Record<string, (workflow: any) => any> = {
    // `parallel` marks every branch running before starting them; `branch` doesn't.
    parallel: workflow => workflow.parallel([branchStep('a'), branchStep('b'), branchStep('c', { check: 5 })]),
    branch: workflow =>
      workflow.branch([
        [async () => true, branchStep('a')],
        [async () => true, branchStep('b')],
        [async () => true, branchStep('c', { check: 5 })],
      ]),
  };

  for (const [blockName, block] of Object.entries(blocks)) {
    it(`doesn't replace the results the block's writes store, in ${blockName}`, async () => {
      const storage = new MockStore();
      timeWrites(storage, write =>
        write.checkpoint && write.status === 'running' ? { commit: 30, reply: 0 } : undefined,
      );
      const crashPoints = new Map<string, CrashPoint>();
      const id = 'first-checkpoint';
      const expected = { a: answer('a'), b: answer('b'), c: answer('c') };
      const workflow = block(
        createWorkflow({
          id,
          inputSchema: z.any(),
          outputSchema: z.any(),
          stateSchema: marks,
          options: { storageVersion: 2 },
        }),
      )
        .then(afterBlockStep(storage, id, crashPoints))
        .then(readBackStep(Object.keys(expected)))
        .commit();
      new Mastra({ logger: false, storage, workflows: { [id]: workflow } });

      const run = await workflow.createRun({ runId: 'run' });
      const result = await run.start({ inputData: { n: 0 }, initialState: {} }).catch((error: unknown) => error);

      expect(wrongSteps(crashPoints.get('run')?.stored?.steps, expected)).toEqual([]);
      expect(result).toMatchObject({ status: 'success', result: expected });
    });
  }
});
