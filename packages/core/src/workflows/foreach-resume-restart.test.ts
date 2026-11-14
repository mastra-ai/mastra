/**
 * A restart of a run that crashed while one `foreach` item was being resumed must hand that
 * item's resume data to that item only. Items that were still suspended, or never reached, must
 * not receive it: in an agent loop each item is a tool call waiting for its own approval.
 *
 * Each case suspends the items, resumes some of them either through the `Mastra` instance that
 * suspended the run or through a second instance on the same storage, copies what storage holds
 * while a resumed item runs (or at a chosen write), and restarts from that copy in a fresh
 * module graph.
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

type Seen = { generation: number; k: number; resumeData: unknown; suspendData: unknown };

const ITEMS = [{ k: 0 }, { k: 1 }, { k: 2 }];
const ITEM = z.object({ k: z.number() });
const APPROVED = { approved: true };

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

/** An approval step: suspends until resumed; a resumed call in generation `blockIn` waits on `gate`. */
function approvalStep(
  createStepFn: any,
  {
    id,
    generation,
    seen,
    gate,
    blockIn = 1,
  }: { id: string; generation: number; seen: Seen[]; gate: Gate; blockIn?: number },
) {
  return createStepFn({
    id,
    inputSchema: ITEM,
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

type Build = (core: CoreGraph, generation: number) => any;

const leafForeach =
  (id: string, concurrency: number, seen: Seen[], gate: Gate): Build =>
  (core, generation) =>
    core
      .createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any() })
      .foreach(approvalStep(core.createStep, { id: 'approve', generation, seen, gate }), { concurrency })
      .commit();

/** A foreach of approval steps inside a nested workflow: the shape of a durable agent's tool calls. */
const childForeach =
  (id: string, seen: Seen[], gate: Gate): Build =>
  (core, generation) =>
    core
      .createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any() })
      .then(
        core
          .createWorkflow({ id: `${id}-child`, inputSchema: z.array(ITEM), outputSchema: z.any() })
          .foreach(approvalStep(core.createStep, { id: 'approve', generation, seen, gate }), { concurrency: 3 })
          .commit(),
      )
      .commit();

/**
 * A restart scenario whose graph 1 suspends the run and resumes it, through the same `Mastra`
 * instance, or through a second instance on the same storage when `elsewhere` is set.
 */
function resumeScenario(
  id: string,
  build: Build,
  resume: Record<string, unknown>,
  { elsewhere = false, hold }: { elsewhere?: boolean; hold?: HoldWrite } = {},
) {
  const runId = `${id}-run`;
  const scenario = createRestartScenario({
    kind: 'workflow',
    runId,
    build: ({ core, generation }) => build(core, generation),
    hold,
  });
  scenarios.push(scenario);
  const start = () =>
    scenario.start(async ({ core, storage, workflow }) => {
      let suspender = workflow;
      if (elsewhere) {
        suspender = build(core, 0);
        new core.Mastra({ logger: false, storage, workflows: { [suspender.id]: suspender } });
      }
      expect((await (await suspender.createRun({ runId })).start({ inputData: ITEMS })).status).toBe('suspended');
      return (await workflow.createRun({ runId })).resume(resume);
    });
  return { scenario, start, runId };
}

const resumedIn = (seen: Seen[], generation: number) =>
  seen
    .filter(s => s.generation === generation && s.resumeData !== undefined)
    .map(s => s.k)
    .sort();

const foreachRecord = (checkpoint: Checkpoint, workflowName: string, runId: string, stepId: string) =>
  findRow(checkpoint, workflowName, runId)?.snapshot.context?.[stepId] as any;

/** Copies graph 1's rows once the resumed foreach's running record, with the payload, is stored. */
async function checkpointWhileResuming(
  original: { checkpoint(): Promise<Checkpoint> },
  { workflowName, runId, stepId }: { workflowName: string; runId: string; stepId: string },
) {
  let checkpoint!: Checkpoint;
  await vi.waitFor(async () => {
    checkpoint = await original.checkpoint();
    expect(foreachRecord(checkpoint, workflowName, runId, stepId)).toMatchObject({
      status: 'running',
      resumePayload: APPROVED,
    });
  });
  return checkpoint;
}

/**
 * A leaf foreach whose items all suspend, resumed as `resume` says, cut while `waiters` resumed
 * items run.
 */
async function crashWhileResuming(
  id: string,
  {
    concurrency,
    resume,
    waiters = 1,
    elsewhere = true,
  }: { concurrency: number; resume: Record<string, unknown>; waiters?: number; elsewhere?: boolean },
) {
  const seen: Seen[] = [];
  const gate = newGate();
  const { scenario, start, runId } = resumeScenario(
    id,
    leafForeach(id, concurrency, seen, gate),
    { ...resume, resumeData: APPROVED },
    { elsewhere },
  );
  const original = await start();
  await vi.waitFor(() => expect(gate.waiters).toBe(waiters));
  const checkpoint = await checkpointWhileResuming(original, { workflowName: id, runId, stepId: 'approve' });
  return { seen, scenario, checkpoint, runId };
}

function itemOutputs(steps: any, stepId: string) {
  return (steps[stepId].suspendPayload.__workflow_meta.foreachOutput as any[]).map(r => ({
    status: r?.status,
    ...(r?.status === 'suspended' ? { suspendPayload: r.suspendPayload } : {}),
  }));
}

async function expectChildItems(graph: any, child: string, runId: string, statuses: string[]) {
  const childRun = await graph.workflows.loadWorkflowSnapshot({ workflowName: child, runId });
  expect(itemOutputs(childRun.context, 'approve').map(o => o.status)).toEqual(statuses);
}

describe('restart while a resumed foreach item runs', () => {
  it('gives the approved item its decision and keeps the other suspended items waiting for theirs', async () => {
    const id = 'foreach-resume-leaf';
    const { seen, scenario, checkpoint, runId } = await crashWhileResuming(id, {
      concurrency: 3,
      resume: { step: 'approve', forEachIndex: 1 },
    });

    const { result, graph } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([1]);
    expect(seen.find(s => s.generation === 2 && s.k === 1)).toMatchObject({
      resumeData: APPROVED,
      suspendData: { ask: 1 },
    });
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, 'approve')).toEqual([
      { status: 'suspended', suspendPayload: { ask: 0 } },
      { status: 'success' },
      { status: 'suspended', suspendPayload: { ask: 2 } },
    ]);
    const stored = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
    expect(JSON.stringify(result)).not.toContain('foreachResumeTarget');
    expect(JSON.stringify(stored)).not.toContain('foreachResumeTarget');

    // Item 0 still answers to its own resume.
    const next = await (
      await graph.workflow.createRun({ runId })
    ).resume({
      step: 'approve',
      forEachIndex: 0,
      resumeData: { approved: false },
    });
    expect(seen.filter(s => s.generation === 2 && s.k === 0)).toEqual([
      { generation: 2, k: 0, resumeData: { approved: false }, suspendData: { ask: 0 } },
    ]);
    expect(next.status).toBe('suspended');
    expect(itemOutputs(next.steps, 'approve').map(o => o.status)).toEqual(['success', 'success', 'suspended']);
  });

  it('does not hand the resumed item decision to items the foreach had not reached', async () => {
    const { seen, scenario, checkpoint } = await crashWhileResuming('foreach-resume-unreached', {
      concurrency: 1,
      resume: { step: 'approve', forEachIndex: 0 },
    });

    const { result } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([0]);
    expect(seen.find(s => s.generation === 2 && s.k === 1)).toEqual({
      generation: 2,
      k: 1,
      resumeData: undefined,
      suspendData: undefined,
    });
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, 'approve')).toEqual([
      { status: 'success' },
      { status: 'suspended', suspendPayload: { ask: 1 } },
    ]);
  });

  it('resumes only the approved nested workflow when the foreach body is a workflow', async () => {
    const id = 'foreach-resume-nested';
    const child = `${id}-child`;
    const seen: Seen[] = [];
    const gate = newGate();
    const build: Build = (core, generation) =>
      core
        .createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any() })
        .foreach(
          core
            .createWorkflow({ id: child, inputSchema: ITEM, outputSchema: z.any() })
            .then(approvalStep(core.createStep, { id: 'ask', generation, seen, gate }))
            .commit(),
          { concurrency: 3 },
        )
        .commit();
    const { scenario, start, runId } = resumeScenario(
      id,
      build,
      { step: [child, 'ask'], forEachIndex: 1, resumeData: APPROVED },
      { elsewhere: true },
    );
    const original = await start();
    await gate.reached;
    const checkpoint = await checkpointWhileResuming(original, { workflowName: id, runId, stepId: child });

    const { result } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([1]);
    // The suspended siblings' nested runs are neither resumed nor started over.
    expect(seen.filter(s => s.generation === 2).map(s => s.k)).toEqual([1]);
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, child).map(o => o.status)).toEqual(['suspended', 'success', 'suspended']);
  });

  it('gives the decision to every item a resume without an index reached, and to no other', async () => {
    // Concurrency 2: items 0 and 1 suspend and item 2 is never reached. A resume with no index
    // resumes 0 and 1; item 2 is still queued behind them at the crash.
    const { seen, scenario, checkpoint } = await crashWhileResuming('foreach-resume-all', {
      concurrency: 2,
      resume: { step: 'approve' },
      waiters: 2,
    });

    const { result } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([0, 1]);
    expect(seen.find(s => s.generation === 2 && s.k === 2)).toMatchObject({ resumeData: undefined });
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, 'approve')).toEqual([
      { status: 'success' },
      { status: 'success' },
      { status: 'suspended', suspendPayload: { ask: 2 } },
    ]);
  });

  it('keeps every suspended item waiting when the stored run does not say which item was resumed', async () => {
    // Runs stored before the resumed item was recorded carry the payload but no target.
    const id = 'foreach-resume-untargeted';
    const { seen, scenario, checkpoint, runId } = await crashWhileResuming(id, {
      concurrency: 3,
      resume: { step: 'approve', forEachIndex: 1 },
    });
    const record = foreachRecord(checkpoint, id, runId, 'approve');
    expect(record.metadata.foreachResumeTarget).toBe(1);
    delete record.metadata.foreachResumeTarget;

    const { result } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([]);
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, 'approve')).toEqual([
      { status: 'suspended', suspendPayload: { ask: 0 } },
      { status: 'suspended', suspendPayload: { ask: 1 } },
      { status: 'suspended', suspendPayload: { ask: 2 } },
    ]);
  });

  it('gives the decision only to the approved item when the instance that suspended the run resumes it', async () => {
    const { seen, scenario, checkpoint } = await crashWhileResuming('foreach-resume-in-place', {
      concurrency: 3,
      resume: { label: 'item-1' },
      elsewhere: false,
    });

    const { result } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([1]);
    expect(result.status).toBe('suspended');
    expect(itemOutputs(result.steps, 'approve').map(o => o.status)).toEqual(['suspended', 'success', 'suspended']);
  });

  it('gives the decision only to the approved item of a foreach inside a nested workflow', async () => {
    // The instance that suspended the run resumes one item by its label.
    const id = 'foreach-resume-in-child';
    const seen: Seen[] = [];
    const gate = newGate();
    const { scenario, start, runId } = resumeScenario(id, childForeach(id, seen, gate), {
      label: 'item-1',
      resumeData: APPROVED,
    });
    const original = await start();
    await gate.reached;
    const checkpoint = await checkpointWhileResuming(original, {
      workflowName: `${id}-child`,
      runId,
      stepId: 'approve',
    });

    const { result, graph } = await scenario.restart(checkpoint);

    expect(resumedIn(seen, 2)).toEqual([1]);
    expect(result.status).toBe('suspended');
    await expectChildItems(graph, `${id}-child`, runId, ['suspended', 'success', 'suspended']);
  });

  it('resumes only the chosen item of a foreach inside a nested workflow', async () => {
    const id = 'foreach-resume-child-index';
    const seen: Seen[] = [];
    const gate = newGate();
    const { start } = resumeScenario(id, childForeach(id, seen, gate), {
      step: [`${id}-child`, 'approve'],
      forEachIndex: 1,
      resumeData: APPROVED,
    });
    const original = await start();
    gate.release();

    const result = (await original.driven) as any;

    expect(resumedIn(seen, 1)).toEqual([1]);
    expect(result.status).toBe('suspended');
    await expectChildItems(original.graph, `${id}-child`, `${id}-run`, ['suspended', 'success', 'suspended']);
  });

  // The two crash points before the nested run stores its resumed foreach: the parent has stored
  // its resumed step, and the nested run is still suspended, or has only claimed its resume.
  const crashPoints = [
    {
      point: 'before the nested run claims its resume',
      hold: (id: string) => ({
        when: (snapshot: any) =>
          snapshot.context?.[`${id}-child`]?.status === 'running' &&
          snapshot.context[`${id}-child`].resumePayload !== undefined,
      }),
      childStatus: 'suspended',
    },
    {
      point: 'after the nested run claims its resume, before its foreach is stored',
      hold: (id: string) => ({
        workflowName: `${id}-child`,
        when: (snapshot: any) => snapshot.status === 'running' && snapshot.context?.approve?.status === 'suspended',
      }),
      childStatus: 'running',
    },
  ];
  const selectors = [
    { by: 'label', resume: (_child: string) => ({ label: 'item-1' }) },
    { by: 'index', resume: (child: string) => ({ step: [child, 'approve'], forEachIndex: 1 }) },
  ];
  it.each(crashPoints.flatMap(point => selectors.map(selector => ({ ...point, ...selector }))))(
    'gives the decision only to the item resumed by $by after a crash $point',
    async ({ point, hold, childStatus, by, resume }) => {
      const id = `foreach-resume-child-${childStatus}-${by}`;
      const seen: Seen[] = [];
      const gate = newGate();
      const { scenario, start, runId } = resumeScenario(
        id,
        childForeach(id, seen, gate),
        { ...resume(`${id}-child`), resumeData: APPROVED },
        { hold: hold(id) },
      );
      const original = await start();
      await original.held;
      const checkpoint = await original.checkpoint();
      expect(findRow(checkpoint, id, runId)?.snapshot.context?.[`${id}-child`], point).toMatchObject({
        status: 'running',
        resumePayload: APPROVED,
      });
      expect(findRow(checkpoint, `${id}-child`, runId)?.snapshot).toMatchObject({
        status: childStatus,
        context: { approve: { status: 'suspended' } },
      });

      const { result, graph } = await scenario.restart(checkpoint);

      expect(resumedIn(seen, 1)).toEqual([]);
      expect(resumedIn(seen, 2)).toEqual([1]);
      expect(result.status).toBe('suspended');
      await expectChildItems(graph, `${id}-child`, runId, ['suspended', 'success', 'suspended']);
      const stored = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
      expect(JSON.stringify([result, stored])).not.toContain('nestedResumeTarget');
    },
  );

  it.each(crashPoints)(
    'keeps every item of a nested foreach suspended when the stored resume recorded no target, after a crash $point',
    async ({ hold, childStatus }) => {
      // Runs stored before the nested target was recorded carry the payload but no target.
      const id = `foreach-resume-child-untargeted-${childStatus}`;
      const child = `${id}-child`;
      const seen: Seen[] = [];
      const gate = newGate();
      const { scenario, start, runId } = resumeScenario(
        id,
        childForeach(id, seen, gate),
        { label: 'item-1', resumeData: APPROVED },
        { hold: hold(id) },
      );
      const original = await start();
      await original.held;
      const checkpoint = await original.checkpoint();
      const record = findRow(checkpoint, id, runId)!.snapshot.context[child] as any;
      expect(record.metadata.nestedResumeTarget).toEqual({ steps: [], label: 'item-1' });
      delete record.metadata.nestedResumeTarget;
      // The state the nested run had handed back when it parked, which a crash during a later
      // resume rebases from.
      const startState = record.suspendPayload.__workflow_meta.startState;
      expect(startState).toBeDefined();

      const { result, graph } = await scenario.restart(checkpoint);

      expect(seen.filter(s => s.generation === 2)).toEqual([]);
      expect(result.status).toBe('suspended');
      await expectChildItems(graph, child, runId, ['suspended', 'suspended', 'suspended']);
      const parked = await graph.workflows.loadWorkflowSnapshot({ workflowName: id, runId });
      expect(parked.context[child].suspendPayload.__workflow_meta.startState).toEqual(startState);

      // The interrupted item is resumed again, and only it runs.
      const next = await (await graph.workflow.createRun({ runId })).resume({ label: 'item-1', resumeData: APPROVED });
      expect(resumedIn(seen, 2)).toEqual([1]);
      expect(next.status).toBe('suspended');
      await expectChildItems(graph, child, runId, ['suspended', 'success', 'suspended']);
    },
  );

  // A foreach whose items are nested workflows that each run their own concurrent foreach. The
  // label names one inner item of outer item 0; outer item 1 waits for its own approvals.
  const foreachOfChildForeach =
    (id: string, seen: Seen[], gate: Gate): Build =>
    (core, generation) =>
      core
        .createWorkflow({ id, inputSchema: z.array(z.array(ITEM)), outputSchema: z.any() })
        .foreach(
          core
            .createWorkflow({ id: `${id}-child`, inputSchema: z.array(ITEM), outputSchema: z.any() })
            .foreach(approvalStep(core.createStep, { id: 'approve', generation, seen, gate }), { concurrency: 2 })
            .commit(),
          { concurrency: 2 },
        )
        .commit();
  const OUTER_ITEMS = [
    [{ k: 0 }, { k: 1 }],
    [{ k: 2 }, { k: 3 }],
  ];
  // The outer foreach's running record doesn't hold its items back, so the cut parks the nested
  // run's resume claim. A crash just before that claim leaves the same rows with the nested run
  // still `suspended`.
  it.each([
    { point: 'before the nested run claims its resume', claimed: false, recorded: true },
    { point: 'after the nested run claims its resume', claimed: true, recorded: true },
    { point: 'after the nested run claims its resume, with no recorded target', claimed: true, recorded: false },
  ])(
    'gives the decision only to the labelled item of a foreach in a foreach item, after a crash $point',
    async ({ claimed, recorded }) => {
      const id = `foreach-of-child-foreach-${claimed}-${recorded}`;
      const child = `${id}-child`;
      const runId = `${id}-run`;
      const seen: Seen[] = [];
      const gate = newGate();
      const build = foreachOfChildForeach(id, seen, gate);
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        build: ({ core, generation }) => build(core, generation),
        hold: {
          workflowName: child,
          when: snapshot => snapshot.status === 'running' && snapshot.context?.approve?.status === 'suspended',
        },
      });
      scenarios.push(scenario);
      const original = await scenario.start(async ({ workflow }) => {
        const run = await workflow.createRun({ runId });
        expect((await run.start({ inputData: OUTER_ITEMS })).status).toBe('suspended');
        return run.resume({ label: 'item-1', resumeData: APPROVED });
      });
      await original.held;
      let checkpoint!: Checkpoint;
      await vi.waitFor(async () => {
        checkpoint = await original.checkpoint();
        expect(foreachRecord(checkpoint, id, runId, child)).toMatchObject({
          status: 'running',
          resumePayload: APPROVED,
        });
      });
      const childRows = checkpoint.rows.filter(row => row.workflowName === child);
      const claimedRow = childRows.find(row => row.snapshot.status === 'running')!;
      expect(claimedRow.snapshot.context.approve).toMatchObject({ status: 'suspended' });
      if (!claimed) claimedRow.snapshot.status = 'suspended';
      const record = foreachRecord(checkpoint, id, runId, child);
      expect(record.metadata.nestedResumeTarget).toEqual({ steps: [], label: 'item-1' });
      if (!recorded) delete record.metadata.nestedResumeTarget;

      const { result, graph } = await scenario.restart(checkpoint);

      expect(resumedIn(seen, 1)).toEqual([]);
      expect(resumedIn(seen, 2)).toEqual(recorded ? [1] : []);
      expect(result.status).toBe('suspended');
      if (recorded) return;

      // The interrupted item is resumed again, and only it runs.
      const next = await (await graph.workflow.createRun({ runId })).resume({ label: 'item-1', resumeData: APPROVED });
      expect(resumedIn(seen, 2)).toEqual([1]);
      expect(next.status).toBe('suspended');
    },
  );

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

      expect(resumedIn(seen, 2)).toEqual([1]);
      expect(resumedIn(seen, 3)).toEqual([1]);
      expect(result.status).toBe('suspended');
      const steps = typeof result.steps === 'function' ? await (result.steps as any)() : result.steps;
      expect(itemOutputs(steps, 'approve').map(o => o.status)).toEqual(['suspended', 'success', 'suspended']);
      expect(events.length).toBeGreaterThan(0);
      expect(JSON.stringify(events)).not.toContain('foreachResumeTarget');
    });
  });

  it('gives the resumed item its decision when a sibling suspends while it is still validating its input', async () => {
    // Concurrency 2: items 0 and 1 suspend and item 2 is never reached; item 1 is resumed. On the
    // restart items 1 and 2 run together, and item 2 suspends before item 1's input validation
    // finishes. Items share the foreach's record, which item 2's suspension replaces in memory.
    const id = 'foreach-resume-sibling-suspends';
    const runId = 'sibling-suspends';
    const seen: Seen[] = [];
    const crash = newGate();
    const validation = newGate();
    const build = (generation: number) => {
      const approve = createStep({
        id: 'approve',
        // On the restart, item 1's validation waits until item 2 has suspended.
        inputSchema: ITEM.refine(async ({ k }) => {
          if (generation === 2 && k === 1) await validation.wait();
          return true;
        }),
        outputSchema: z.object({ k: z.number(), approved: z.boolean() }),
        resumeSchema: z.object({ approved: z.boolean() }),
        suspendSchema: z.object({ ask: z.number() }),
        execute: async ({ inputData, resumeData, suspendData, suspend }) => {
          seen.push({ generation, k: inputData.k, resumeData, suspendData });
          if (resumeData === undefined) return suspend({ ask: inputData.k });
          if (generation === 1) await crash.wait();
          return { k: inputData.k, approved: resumeData.approved };
        },
      });
      return createWorkflow({ id, inputSchema: z.array(ITEM), outputSchema: z.any() })
        .foreach(approve, { concurrency: 2 })
        .commit();
    };

    const storage1 = new MockStore();
    const first = build(1);
    new Mastra({ logger: false, storage: storage1, workflows: { [id]: first } });
    const run1 = await first.createRun({ runId });
    expect((await run1.start({ inputData: ITEMS })).status).toBe('suspended');
    void run1.resume({ step: 'approve', forEachIndex: 1, resumeData: APPROVED });
    await crash.reached;
    const store1 = (await storage1.getStore('workflows'))!;
    await vi.waitFor(async () => {
      const snapshot = await store1.loadWorkflowSnapshot({ workflowName: id, runId });
      expect(snapshot?.context.approve).toMatchObject({ status: 'running', resumePayload: APPROVED });
    });
    const atCrash = copyRunTables(await runTablesOf(storage1));

    const storage2 = new MockStore();
    const second = build(2);
    new Mastra({ logger: false, storage: storage2, workflows: { [id]: second } });
    restoreRunTables(await runTablesOf(storage2), atCrash);
    const run2 = await second.createRun({ runId });
    run2.watch(event => {
      const payload = (event as any).payload;
      if (event.type === 'workflow-step-progress' && payload?.currentIndex === 2) {
        expect(payload.iterationStatus).toBe('suspended');
        validation.release();
      }
    });
    const result = await run2.restart();

    expect(seen.filter(s => s.generation === 2).map(s => s.k)).toEqual([2, 1]);
    expect(resumedIn(seen, 2)).toEqual([1]);
    expect(seen.find(s => s.generation === 2 && s.k === 1)).toMatchObject({
      resumeData: APPROVED,
      suspendData: { ask: 1 },
    });
    expect(result.status).toBe('suspended');
    if (result.status !== 'suspended') return;
    expect(itemOutputs(result.steps, 'approve').map(o => o.status)).toEqual(['suspended', 'success', 'suspended']);
  });
});
