/**
 * A restart of a run that crashed while one `foreach` item was being resumed must hand that
 * item's resume data to that item only. Items that were still suspended, or never reached, must
 * not receive it: in an agent loop each item is a tool call waiting for its own approval.
 *
 * Each case suspends the items, resumes some of them through the `Mastra` instance that suspended
 * the run or through a second instance on the same storage, copies what storage holds while a
 * resumed item runs (or at a chosen write), and restarts from that copy in a fresh module graph.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createGate, createRestartScenario, findRow } from '../agent/durable/__tests__/restart-harness';
import type { Checkpoint, CoreGraph, Gate, HoldWrite } from '../agent/durable/__tests__/restart-harness';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { copyRunTables, interceptWrites, restoreRunTables, runTablesOf } from './test-utils/run-tables';
import type { RunTables } from './test-utils/run-tables';
import { createStep } from './workflow';

type Call = { k: number; resumeData: unknown; suspendData: unknown };
type Seen = Call & { generation: number };

const ITEMS = [{ k: 0 }, { k: 1 }, { k: 2 }];
const ITEM = z.object({ k: z.number() });
const APPROVED = { approved: true };
/** A call that received its own approval and its own suspend payload. */
const resumed = (k: number): Call => ({ k, resumeData: APPROVED, suspendData: { ask: k } });
/** A call that started the item fresh. */
const fresh = (k: number): Call => ({ k, resumeData: undefined, suspendData: undefined });

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

function newGate() {
  const gate = createGate();
  gates.push(gate);
  return gate;
}

/** The calls generation `generation` made after `from`, by item. */
const calls = (seen: Seen[], generation: number, from = 0): Call[] =>
  seen
    .slice(from)
    .filter(s => s.generation === generation)
    .map(({ generation: _, ...call }) => call)
    .sort((a, b) => a.k - b.k);

type Ctx = {
  id: string;
  generation: number;
  seen: Seen[];
  gate: Gate;
  concurrency: number;
  /** Runs inside input validation (of the approval step, or of the nested workflow per item). */
  validate: (input: any) => Promise<void>;
};

/** An approval step: suspends until resumed; a resumed call in generation `blockIn` waits on `gate`. */
function approvalStep(
  createStepFn: any,
  {
    id,
    generation,
    seen,
    gate,
    validate,
    blockIn = 1,
  }: Omit<Ctx, 'id' | 'concurrency'> & { id: string; blockIn?: number },
) {
  return createStepFn({
    id,
    inputSchema: ITEM.refine(async input => {
      await validate(input);
      return true;
    }),
    outputSchema: z.object({ k: z.number(), approved: z.boolean() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ ask: z.number() }),
    execute: async ({ inputData, resumeData, suspendData, suspend }: any) => {
      seen.push({ generation, k: inputData.k, resumeData, suspendData });
      if (resumeData === undefined) return suspend({ ask: inputData.k }, { resumeLabel: `item-${inputData.k}` });
      if (generation === blockIn) await gate.wait();
      return { k: inputData.k, approved: resumeData.approved };
    },
  });
}

const statusesOf = (steps: any, stepId: string): string[] =>
  steps[stepId].suspendPayload.__workflow_meta.foreachOutput.map((r: any) => r?.status);

type Shape = {
  build(core: CoreGraph, ctx: Ctx): any;
  inputData: unknown;
  /** Where the resumed foreach's running record is stored: workflow name, step id. */
  record(id: string): [string, string];
  /** The approval foreach's item statuses after `result`; absent where they aren't one list. */
  statuses?(args: { id: string; runId: string; result: any; graph: any }): Promise<string[]>;
};

const leaf: Shape = {
  build: (core, ctx) =>
    core
      .createWorkflow({ id: ctx.id, inputSchema: z.array(ITEM), outputSchema: z.any() })
      .foreach(approvalStep(core.createStep, { ...ctx, id: 'approve' }), { concurrency: ctx.concurrency })
      .commit(),
  inputData: ITEMS,
  record: id => [id, 'approve'],
  statuses: async ({ result }) => statusesOf(result.steps, 'approve'),
};

/** A foreach whose items are nested workflows with one approval step each. */
const nestedBody: Shape = {
  build: (core, ctx) =>
    core
      .createWorkflow({ id: ctx.id, inputSchema: z.array(ITEM), outputSchema: z.any() })
      .foreach(
        core
          .createWorkflow({ id: `${ctx.id}-child`, inputSchema: ITEM, outputSchema: z.any() })
          .then(approvalStep(core.createStep, { ...ctx, id: 'ask' }))
          .commit(),
        { concurrency: 3 },
      )
      .commit(),
  inputData: ITEMS,
  record: id => [id, `${id}-child`],
  statuses: async ({ id, result }) => statusesOf(result.steps, `${id}-child`),
};

/** A foreach of approval steps inside a nested workflow: the shape of a durable agent's tool calls. */
const inChild: Shape = {
  build: (core, ctx) =>
    core
      .createWorkflow({ id: ctx.id, inputSchema: z.array(ITEM), outputSchema: z.any() })
      .then(
        core
          .createWorkflow({ id: `${ctx.id}-child`, inputSchema: z.array(ITEM), outputSchema: z.any() })
          .foreach(approvalStep(core.createStep, { ...ctx, id: 'approve' }), { concurrency: 3 })
          .commit(),
      )
      .commit(),
  inputData: ITEMS,
  record: id => [`${id}-child`, 'approve'],
  statuses: async ({ id, runId, graph }) => {
    const child = await graph.workflows.loadWorkflowSnapshot({ workflowName: `${id}-child`, runId });
    return statusesOf(child.context, 'approve');
  },
};

/**
 * A foreach whose items are nested workflows that each run their own concurrent foreach. Outer
 * items 0 and 1 suspend and outer item 2 is never reached; the label names inner item 1 of outer
 * item 0.
 */
const foreachOfInChild: Shape = {
  build: (core, ctx) =>
    core
      .createWorkflow({ id: ctx.id, inputSchema: z.array(z.array(ITEM)), outputSchema: z.any() })
      .foreach(
        core
          .createWorkflow({
            id: `${ctx.id}-child`,
            inputSchema: z.array(ITEM).refine(async items => {
              await ctx.validate(items);
              return true;
            }),
            outputSchema: z.any(),
          })
          .foreach(approvalStep(core.createStep, { ...ctx, id: 'approve', validate: async () => {} }), {
            concurrency: 2,
          })
          .commit(),
        { concurrency: 2 },
      )
      .commit(),
  inputData: [
    [{ k: 0 }, { k: 1 }],
    [{ k: 2 }, { k: 3 }],
    [{ k: 4 }, { k: 5 }],
  ],
  record: id => [id, `${id}-child`],
};

/**
 * On the restart, the input validation of the item `holds` picks waits until item `index` of the
 * foreach `step` has suspended. Items share the foreach's record in memory, and that sibling's
 * suspension replaces it while the resumed item is still validating.
 */
type Race = { holds: (input: any) => boolean; step: (id: string) => string; index: number };
const leafRace: Race = { holds: input => input.k === 1, step: () => 'approve', index: 2 };
const outerRace: Race = { holds: input => input[0]?.k === 0, step: id => `${id}-child`, index: 2 };

/** A crash in the window before the nested run stores its resumed foreach. */
type Window = { hold: (id: string) => HoldWrite; claimed: boolean; unclaim?: boolean };
/** The parent has stored its resumed nested step; the nested run is still suspended. */
const beforeClaim: Window = {
  claimed: false,
  hold: id => ({
    when: snapshot =>
      snapshot.context?.[`${id}-child`]?.status === 'running' &&
      (snapshot.context[`${id}-child`] as any).resumePayload !== undefined,
  }),
};
/** The nested run has claimed its resume. */
const afterClaim: Window = {
  claimed: true,
  hold: id => ({
    workflowName: `${id}-child`,
    when: snapshot => snapshot.status === 'running' && snapshot.context?.approve?.status === 'suspended',
  }),
};
/**
 * The outer foreach's running record doesn't hold its items back, so the cut parks the nested
 * run's claim; a crash just before it leaves the same rows with the nested run still suspended.
 */
const beforeClaimOfItem: Window = { ...afterClaim, claimed: false, unclaim: true };

type Row = {
  name: string;
  shape: Shape;
  resume: (child: string) => Record<string, unknown>;
  /** Suspend through a second `Mastra` instance on the same storage. */
  elsewhere?: boolean;
  concurrency?: number;
  /** Without a window: cut once this many resumed items are running. */
  waiters?: number;
  window?: Window;
  race?: Race;
};

const byIndex = (k: number) => () => ({ step: 'approve', forEachIndex: k });
const byLabel = (k: number) => () => ({ label: `item-${k}` });
const nestedByIndex = (k: number) => (child: string) => ({ step: [child, 'approve'], forEachIndex: k });

/** Runs a row's graph 1 up to its cut and copies storage there. */
async function crash(id: string, row: Row) {
  const runId = `${id}-run`;
  const child = `${id}-child`;
  const seen: Seen[] = [];
  const gate = newGate();
  const validation = newGate();
  const build = (core: CoreGraph, generation: number) =>
    row.shape.build(core, {
      id,
      generation,
      seen,
      gate,
      concurrency: row.concurrency ?? 3,
      validate: async input => {
        if (generation === 2 && row.race?.holds(input)) await validation.wait();
      },
    });
  const scenario = createRestartScenario({
    kind: 'workflow',
    runId,
    build: ({ core, generation }) => build(core, generation),
    hold: row.window?.hold(id),
  });
  scenarios.push(scenario);
  const original = await scenario.start(async ({ core, storage, workflow }) => {
    let suspender = workflow;
    if (row.elsewhere) {
      suspender = build(core, 0);
      new core.Mastra({ logger: false, storage, workflows: { [suspender.id]: suspender } });
    }
    const started = await (await suspender.createRun({ runId })).start({ inputData: row.shape.inputData });
    expect(started.status).toBe('suspended');
    return (await workflow.createRun({ runId })).resume({ ...row.resume(child), resumeData: APPROVED });
  });
  if (row.window) await original.held;
  else await vi.waitFor(() => expect(gate.waiters).toBe(row.waiters ?? 1));

  // The resumed record a restart reads: the foreach's, or the parent's nested step in a window.
  const [workflowName, stepId] = row.window ? [id, child] : row.shape.record(id);
  const resuming = (c: Checkpoint) => {
    const snapshot = findRow(c, workflowName, runId)?.snapshot;
    const record = snapshot?.context?.[stepId] as any;
    // Outside a window, also once the run records the step as active, which is what a restart reruns.
    return (
      record?.status === 'running' &&
      record.resumePayload !== undefined &&
      (!!row.window || !!snapshot?.activeStepsPath?.[stepId])
    );
  };
  // In a window, graph 1 is parked in the chosen write; otherwise the first write that stored the
  // resumed record (later writes while items run can store the run without its active step).
  const checkpoint = (row.window ? await original.checkpoint() : original.checkpoints.find(resuming))!;
  expect(!!checkpoint && resuming(checkpoint), 'a stored running record with the resume payload').toBe(true);
  if (row.window) {
    // Nested runs whose foreach is still stored suspended; the claimed one is `running`.
    const parked = checkpoint.rows.filter(
      r => r.workflowName === child && (r.snapshot.context as any).approve?.status === 'suspended',
    );
    if (row.window.unclaim) for (const r of parked) r.snapshot.status = 'suspended';
    expect(parked.filter(r => r.snapshot.status === 'running')).toHaveLength(row.window.claimed ? 1 : 0);
    expect(calls(seen, 1).filter(c => c.resumeData !== undefined)).toEqual([]);
  }

  const restart = async () => {
    const { result, graph } = await scenario.restart(checkpoint, {
      watch: event => {
        const payload = event.payload;
        const { race } = row;
        if (!race || event.type !== 'workflow-step-progress') return;
        if (payload?.id === race.step(id) && payload.currentIndex === race.index) {
          expect(payload.iterationStatus).toBe('suspended');
          validation.release();
        }
      },
    });
    const stored = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
    expect(JSON.stringify([result, stored])).not.toMatch(/foreachResumeTarget|nestedResumeTarget/);
    const statuses = (r: any) => row.shape.statuses?.({ id, runId, result: r, graph });
    const resume = (args: Record<string, unknown>) =>
      graph.workflow.createRun({ runId }).then((r: any) => r.resume(args));
    return { result, graph, stored, statuses, resume };
  };
  const record = () => findRow(checkpoint, workflowName, runId)!.snapshot.context[stepId] as any;
  return { seen, restart, record, child };
}

const S = 'suspended';
const OK = 'success';

describe('restart while a resumed foreach item runs', () => {
  it.each<Row & { gen2: Call[]; statuses: string[] }>([
    {
      name: 'leaf foreach, item 1 resumed by index through a second instance',
      shape: leaf,
      resume: byIndex(1),
      elsewhere: true,
      gen2: [resumed(1)],
      statuses: [S, OK, S],
    },
    {
      name: 'leaf foreach, item 1 resumed by label through the instance that suspended it',
      shape: leaf,
      resume: byLabel(1),
      gen2: [resumed(1)],
      statuses: [S, OK, S],
    },
    {
      name: 'leaf foreach at concurrency 1, item 0 resumed, items 1 and 2 never reached',
      shape: leaf,
      concurrency: 1,
      resume: byIndex(0),
      elsewhere: true,
      gen2: [resumed(0), fresh(1)],
      statuses: [OK, S],
    },
    {
      name: 'leaf foreach at concurrency 2, both suspended items resumed without an index',
      shape: leaf,
      concurrency: 2,
      resume: () => ({ step: 'approve' }),
      elsewhere: true,
      waiters: 2,
      gen2: [resumed(0), resumed(1), fresh(2)],
      statuses: [OK, OK, S],
    },
    {
      name: 'leaf foreach at concurrency 2, a sibling suspends while the resumed item validates its input',
      shape: leaf,
      concurrency: 2,
      resume: byIndex(1),
      race: leafRace,
      gen2: [resumed(1), fresh(2)],
      statuses: [S, OK, S],
    },
    {
      name: 'foreach of nested workflows, item 1 resumed by index through a second instance',
      shape: nestedBody,
      resume: child => ({ step: [child, 'ask'], forEachIndex: 1 }),
      elsewhere: true,
      gen2: [resumed(1)],
      statuses: [S, OK, S],
    },
    {
      name: 'foreach inside a nested workflow, item 1 resumed by label through the instance that suspended it',
      shape: inChild,
      resume: byLabel(1),
      gen2: [resumed(1)],
      statuses: [S, OK, S],
    },
  ])('gives the decision only to the resumed items: $name', async row => {
    const { seen, restart } = await crash(`ff-${row.name.replace(/\W+/g, '-')}`, row);

    const { result, statuses, resume } = await restart();

    expect(calls(seen, 2)).toEqual(row.gen2);
    expect(result.status).toBe('suspended');
    expect(await statuses(result)).toEqual(row.statuses);

    // An item still waiting answers to its own resume.
    const k = row.statuses.indexOf(S);
    const from = seen.length;
    await resume({ label: `item-${k}`, resumeData: APPROVED });
    expect(calls(seen, 2, from).filter(c => c.resumeData !== undefined)).toEqual([resumed(k)]);
  });

  const nestedWindows: (Row & { gen2: Call[] })[] = [
    ...[beforeClaim, afterClaim].flatMap(window =>
      [
        { by: 'label', resume: byLabel(1) },
        { by: 'index', resume: nestedByIndex(1) },
      ].map(({ by, resume }) => ({
        name: `foreach inside a nested workflow, by ${by}, ${window.claimed ? 'after' : 'before'} the nested run claims its resume`,
        shape: inChild,
        resume,
        window,
        gen2: [resumed(1)],
      })),
    ),
    ...[beforeClaimOfItem, afterClaim].map(window => ({
      name: `foreach in a foreach item, by label, ${window.claimed ? 'after' : 'before'} the nested run claims its resume, a sibling suspending meanwhile`,
      shape: foreachOfInChild,
      resume: byLabel(1),
      window,
      race: outerRace,
      gen2: [resumed(1), fresh(4), fresh(5)],
    })),
  ];

  it.each(nestedWindows)('gives the decision only to the resumed inner item: $name', async row => {
    const { seen, restart } = await crash(`fw-${row.name.replace(/\W+/g, '-')}`, row);

    const { result, statuses } = await restart();

    expect(calls(seen, 2)).toEqual(row.gen2);
    expect(result.status).toBe('suspended');
    if (row.shape.statuses) expect(await statuses(result)).toEqual([S, OK, S]);
  });

  // Runs stored before targets were recorded carry the payload but no target.
  it.each<Row & { gen2: Call[]; target: [string, unknown] }>([
    {
      name: 'leaf foreach',
      shape: leaf,
      resume: byIndex(1),
      elsewhere: true,
      gen2: [],
      target: ['foreachResumeTarget', 1],
    },
    ...[beforeClaim, afterClaim].map(window => ({
      name: `foreach inside a nested workflow, ${window.claimed ? 'after' : 'before'} the nested run claims its resume`,
      shape: inChild,
      resume: byLabel(1),
      window,
      gen2: [],
      target: ['nestedResumeTarget', { steps: [], label: 'item-1' }] as [string, unknown],
    })),
    {
      name: 'foreach in a foreach item, after the nested run claims its resume',
      shape: foreachOfInChild,
      resume: byLabel(1),
      window: afterClaim,
      race: outerRace,
      gen2: [fresh(4), fresh(5)],
      target: ['nestedResumeTarget', { steps: [], label: 'item-1' }],
    },
  ])('keeps every suspended item waiting when the stored resume recorded no target: $name', async row => {
    const { seen, restart, record, child } = await crash(`fo-${row.name.replace(/\W+/g, '-')}`, row);
    const [key, value] = row.target;
    expect(record().metadata[key]).toEqual(value);
    delete record().metadata[key];
    // The state a nested run had handed back when it parked, which a later resume rebases from.
    const startState = row.shape === inChild ? record().suspendPayload.__workflow_meta.startState : undefined;
    if (row.shape === inChild) expect(startState).toBeDefined();

    const { result, stored, statuses, resume } = await restart();

    expect(calls(seen, 2)).toEqual(row.gen2);
    expect(result.status).toBe('suspended');
    if (row.shape.statuses) expect(await statuses(result)).toEqual([S, S, S]);
    if (startState) expect(stored.context[child].suspendPayload.__workflow_meta.startState).toEqual(startState);

    // The interrupted item is resumed again, and only it runs.
    const from = seen.length;
    const next = await resume({ label: 'item-1', resumeData: APPROVED });
    expect(calls(seen, 2, from)).toEqual([resumed(1)]);
    if (row.shape.statuses) expect(await statuses(next)).toEqual([S, OK, S]);
  });

  it('keeps a state change the parent never received when the stored resume recorded no target', async () => {
    // The resumed nested run ran item 1, which changed the state, and suspended again; the process
    // crashed before the parent stored that suspension, on a record without a target. A sibling
    // changed `tag` after the nested run took its copy, so only a merge against the state the
    // parent last received keeps both changes.
    const id = 'fo-unreceived-state';
    const child = `${id}-child`;
    const runId = `${id}-run`;
    const STATE = z.object({ approvals: z.array(z.number()), tag: z.string() });
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core }) =>
        core
          .createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any(), stateSchema: STATE })
          .parallel([
            core.createStep({
              id: 'sibling',
              inputSchema: z.any(),
              outputSchema: z.object({}),
              stateSchema: STATE,
              execute: async ({ state, setState }: any) => {
                await setState({ ...state, tag: 'sibling' });
                return {};
              },
            }),
            core
              .createWorkflow({ id: child, inputSchema: z.array(ITEM), outputSchema: z.any(), stateSchema: STATE })
              .foreach(
                core.createStep({
                  id: 'approve',
                  inputSchema: ITEM,
                  outputSchema: ITEM,
                  resumeSchema: z.object({ approved: z.boolean() }),
                  stateSchema: STATE,
                  execute: async ({ inputData, resumeData, suspend, state, setState }: any) => {
                    if (resumeData === undefined) return suspend({}, { resumeLabel: `item-${inputData.k}` });
                    await setState({ ...state, approvals: [...state.approvals, inputData.k] });
                    return inputData;
                  },
                }),
                { concurrency: 3 },
              )
              .commit(),
          ])
          .commit(),
      hold: {
        workflowName: child,
        when: snapshot =>
          snapshot.status === 'suspended' &&
          (snapshot.context?.approve as any)?.suspendPayload?.__workflow_meta?.foreachOutput?.[1]?.status === 'success',
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) => {
      const run = await workflow.createRun({ runId });
      const started = await run.start({ inputData: ITEMS, initialState: { approvals: [], tag: 'initial' } });
      expect(started.status).toBe('suspended');
      return run.resume({ label: 'item-1', resumeData: APPROVED });
    });
    await original.held;
    const checkpoint = await original.checkpoint();
    const record = findRow(checkpoint, id, runId)!.snapshot.context[child] as any;
    expect(record).toMatchObject({ status: 'running', resumePayload: APPROVED });
    // The parent last took in the nested run's state when it first parked; the nested run is ahead.
    expect(record.suspendPayload.__workflow_meta.startState).toEqual({ approvals: [], tag: 'initial' });
    expect(findRow(checkpoint, id, runId)?.snapshot.value).toEqual({ approvals: [], tag: 'sibling' });
    expect(findRow(checkpoint, child, runId)?.snapshot.value).toEqual({ approvals: [1], tag: 'initial' });
    delete record.metadata.nestedResumeTarget;

    const { result, graph } = await scenario.restart(checkpoint);
    expect(result.status).toBe('suspended');
    const run = await graph.workflow.createRun({ runId });
    await run.resume({ label: 'item-0', resumeData: APPROVED });
    expect((await run.resume({ label: 'item-2', resumeData: APPROVED })).status).toBe('success');

    const stored = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
    expect([...stored.value.approvals].sort()).toEqual([0, 1, 2]);
    expect(stored.value.tag).toBe('sibling');
  });

  it.each([1, 2] as const)(
    'keeps a state change of a nested run started without a resume, after a crash before the parent stored its suspension, storage v%s',
    async storageVersion => {
      // A plain start: the nested run changes the state and suspends; the process crashes before the
      // parent stores that suspension. The parent's step is `running` with no resume payload.
      const id = `plain-nested-v${storageVersion}`;
      const child = `${id}-child`;
      const runId = `${id}-run`;
      const STATE = z.object({ log: z.array(z.string()) });
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        storageVersion,
        build: ({ core }) =>
          core
            .createWorkflow({
              id,
              inputSchema: z.object({}),
              outputSchema: z.any(),
              stateSchema: STATE,
              options: { storageVersion },
            })
            .then(
              core
                .createWorkflow({ id: child, inputSchema: z.object({}), outputSchema: z.any(), stateSchema: STATE })
                .then(
                  core.createStep({
                    id: 'note',
                    inputSchema: z.object({}),
                    outputSchema: z.object({}),
                    stateSchema: STATE,
                    execute: async ({ getState, setState }: any) => {
                      await setState({ log: [...(await getState()).log, 'nested'] });
                      return {};
                    },
                  }),
                )
                .then(
                  core.createStep({
                    id: 'gate',
                    inputSchema: z.object({}),
                    outputSchema: z.object({ approved: z.boolean() }),
                    // No resumeSchema: the restart resumes the nested run with no data, and the step
                    // suspends again.
                    execute: async ({ resumeData, suspend }: any) =>
                      resumeData === undefined ? suspend({ ask: 'gate' }) : { approved: resumeData.approved },
                  }),
                )
                .commit(),
            )
            .commit(),
      });
      scenarios.push(scenario);
      // Graph 1 parks inside the write that stores the nested run suspended, on either version.
      const parked = newGate();
      const original = await scenario.start(async ({ workflow, workflows }) => {
        interceptWrites(workflows, async (args, write) => {
          const written = await write(args);
          if (!parked.waiters && args?.workflowName === child) {
            const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: child, runId });
            if (snapshot?.status === 'suspended') await parked.wait();
          }
          return written;
        });
        return (await workflow.createRun({ runId })).start({ inputData: {}, initialState: { log: [] } });
      });
      await parked.reached;
      const checkpoint = await original.checkpoint();
      expect(findRow(checkpoint, id, runId)?.snapshot.context[child]).toMatchObject({ status: 'running' });
      expect((findRow(checkpoint, id, runId)?.snapshot.context[child] as any).resumePayload).toBeUndefined();
      expect(findRow(checkpoint, child, runId)?.snapshot).toMatchObject({
        status: 'suspended',
        value: { log: ['nested'] },
      });

      const { result, graph } = await scenario.restart(checkpoint);

      expect(result.status).toBe('suspended');
      const steps = typeof result.steps === 'function' ? await (result.steps as any)() : result.steps;
      expect(steps[child]).toMatchObject({ status: 'suspended', suspendPayload: { ask: 'gate' } });
      const run = await graph.workflow.createRun({ runId });
      expect((await run.resume({ step: [child, 'gate'], resumeData: APPROVED })).status).toBe('success');
      const stored = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
      expect(stored.value).toEqual({ log: ['nested'] });
    },
  );

  it('resumes only the chosen item of a foreach inside a nested workflow, by index', async () => {
    const id = 'foreach-resume-child-index';
    const seen: Seen[] = [];
    const workflow = inChild.build({ createWorkflow, createStep } as unknown as CoreGraph, {
      id,
      generation: 2,
      seen,
      gate: newGate(),
      concurrency: 3,
      validate: async () => {},
    });
    const storage = new MockStore();
    new Mastra({ logger: false, storage, workflows: { [id]: workflow } });
    const run = await workflow.createRun({ runId: id });
    expect((await run.start({ inputData: ITEMS })).status).toBe('suspended');
    const from = seen.length;

    const result = await run.resume({ step: [`${id}-child`, 'approve'], forEachIndex: 1, resumeData: APPROVED });

    expect(calls(seen, 2, from)).toEqual([resumed(1)]);
    expect(result.status).toBe('suspended');
    const child = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
      workflowName: `${id}-child`,
      runId: id,
    });
    expect(statusesOf(child!.context, 'approve')).toEqual([S, OK, S]);
  });

  // The second copy is taken inside the first restart, which the restart harness can't cut, so
  // this copies the store's tables (which also covers storage v2).
  describe.each([1, 2] as const)('storage v%s', storageVersion => {
    it('still gives only the approved item its decision after a second crash during the restart', async () => {
      const id = 'foreach-resume-twice';
      const runId = 'twice';
      const seen: Seen[] = [];
      const crashes = [newGate(), newGate()];
      const build = (generation: number) =>
        createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any(), options: { storageVersion } })
          .foreach(
            approvalStep(createStep, {
              id: 'approve',
              generation,
              seen,
              // Generations 1 and 2 crash while item 1 runs; generation 3 finishes.
              gate: crashes[generation - 1] ?? newGate(),
              blockIn: generation === 1 || generation === 2 ? generation : -1,
              validate: async () => {},
            }),
            { concurrency: 3 },
          )
          .commit();
      /** One process with its own store, seeded with `tables`, counting writes of the resumed foreach. */
      const boot = async (generation: number, tables?: RunTables) => {
        const storage = new MockStore();
        const workflow = build(generation);
        new Mastra({ logger: false, storage, workflows: { [id]: workflow } });
        if (tables) restoreRunTables(await runTablesOf(storage), tables);
        const store = (await storage.getStore('workflows')) as any;
        let writes = 0;
        interceptWrites(store, async (args, write) => {
          const written = await write(args);
          if (JSON.stringify(args ?? {}).includes('"resumePayload"')) writes++;
          return written;
        });
        /** Copies the tables once this process stored the running foreach record itself. */
        const crashCopy = async () => {
          await vi.waitFor(async () => {
            expect(writes).toBeGreaterThan(0);
            const snapshot = await store.loadWorkflowSnapshot({ workflowName: id, runId });
            expect(snapshot?.context.approve).toMatchObject({ status: 'running', resumePayload: APPROVED });
          });
          return copyRunTables(await runTablesOf(storage));
        };
        return { workflow, crashCopy };
      };

      const first = await boot(1);
      const run1 = await first.workflow.createRun({ runId });
      expect((await run1.start({ inputData: ITEMS })).status).toBe('suspended');
      void run1.resume({ step: 'approve', forEachIndex: 1, resumeData: APPROVED });
      await crashes[0]!.reached;
      const second = await boot(2, await first.crashCopy());
      void (await second.workflow.createRun({ runId })).restart();
      await crashes[1]!.reached;
      const third = await boot(3, await second.crashCopy());
      const run = await third.workflow.createRun({ runId });
      const events: unknown[] = [];
      run.watch(event => void events.push(event));
      const result = await run.restart();

      expect(calls(seen, 2)).toEqual([resumed(1)]);
      expect(calls(seen, 3)).toEqual([resumed(1)]);
      expect(result.status).toBe('suspended');
      const steps = typeof result.steps === 'function' ? await (result.steps as any)() : result.steps;
      expect(statusesOf(steps, 'approve')).toEqual([S, OK, S]);
      expect(events.length).toBeGreaterThan(0);
      expect(JSON.stringify(events)).not.toContain('foreachResumeTarget');
    });
  });
});
