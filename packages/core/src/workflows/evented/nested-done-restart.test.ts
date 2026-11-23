/**
 * COR-1351: a parent restarted after its nested workflow finished, but before the
 * parent recorded the nested outcome, must reuse that outcome instead of failing
 * with "This workflow run was not active". The default engine reuses finished
 * nested runs in `Run._restart` (#20225); these cases run on both engines.
 *
 * Each case parks the original run inside one storage write (the cut), copies the
 * rows into a fresh module graph, and restarts there through `run.restart()`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createGate, createRestartScenario, findRow } from '../../agent/durable/__tests__/restart-harness';
import type { CoreGraph, Gate, HoldWrite } from '../../agent/durable/__tests__/restart-harness';

const N = z.object({ n: z.number() });

type Engine = 'default' | 'evented';
type Entry = { generation: number; step: string; input: any };

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

function factories(core: CoreGraph, engine: Engine) {
  return engine === 'default'
    ? { createStep: core.createStep as any, createWorkflow: core.createWorkflow as any }
    : { createStep: core.createEventedStep as any, createWorkflow: core.createEventedWorkflow as any };
}

function inc(
  core: CoreGraph,
  engine: Engine,
  log: Entry[],
  generation: number,
  id: string,
  { fail = false, gate }: { fail?: boolean; gate?: Gate } = {},
) {
  return factories(core, engine).createStep({
    id,
    inputSchema: N,
    outputSchema: N,
    execute: async ({ inputData }: any) => {
      log.push({ generation, step: id, input: inputData });
      if (gate) await gate.wait();
      if (fail) throw new Error(`${id} failed on n=${inputData.n}`);
      return { n: inputData.n + 1 };
    },
  });
}

/** `dowhile` over a nested workflow that runs exactly two iterations: n goes 1 -> 2 -> 3. */
function loop(engine: Engine, log: Entry[], gate?: (generation: number, n: number) => Gate | undefined) {
  return (core: CoreGraph, generation: number) => {
    const { createStep, createWorkflow } = factories(core, engine);
    const inner = gate
      ? createStep({
          id: 'inner',
          inputSchema: N,
          outputSchema: N,
          execute: async ({ inputData }: any) => {
            log.push({ generation, step: 'inner', input: inputData });
            await gate(generation, inputData.n)?.wait();
            return { n: inputData.n + 1 };
          },
        })
      : inc(core, engine, log, generation, 'inner');
    const body = createWorkflow({ id: 'loop-body', inputSchema: N, outputSchema: N }).then(inner).commit();
    return createWorkflow({ id: 'loop-parent', inputSchema: N, outputSchema: N })
      .dowhile(body, async ({ iterationCount }: any) => iterationCount < 2)
      .commit();
  };
}

/** The parent marked iteration 2 running, but iteration 2's child has not started yet. */
const iteration2NotStarted: HoldWrite['when'] = s => {
  const leaf = (s.context as any)?.['loop-body'];
  return leaf?.status === 'running' && leaf.payload?.n === 2;
};

async function restartAtHold({
  engine,
  name,
  hold,
  build,
}: {
  engine: Engine;
  name: string;
  hold: HoldWrite;
  build: (core: CoreGraph, generation: number) => any;
}) {
  const runId = `nested-done-${engine}-${name}`;
  const scenario = createRestartScenario({
    kind: 'workflow',
    runId,
    hold,
    build: ({ core, generation }) => build(core, generation),
  });
  scenarios.push(scenario);
  const original = await scenario.start(async ({ workflow }) =>
    (await workflow.createRun({ runId })).start({ inputData: { n: 1 } }),
  );
  const held = await Promise.race([original.held!.then(() => true), original.settled.then(() => false)]);
  expect(held, 'not exercised: the write the case cuts at never happened').toBe(true);
  const checkpoint = await original.checkpoint();
  original.releaseHold();
  const { result } = await scenario.restart(checkpoint);
  return result;
}

const starts = (log: Entry[], step: string) => log.filter(e => e.generation === 2 && e.step === step).map(e => e.input);

describe.each(['default', 'evented'] as Engine[])('%s restart after a nested workflow finished (COR-1351)', engine => {
  // Default engine: the reused failed nested run comes back as "Unknown error"
  // instead of its own error. Cause not yet investigated.
  const itKeepsError = engine === 'default' ? it.fails : it;
  itKeepsError(
    "fails the parent with the nested workflow's own error, without re-running it",
    async () => {
      const log: Entry[] = [];
      const result = await restartAtHold({
        engine,
        name: 'failed',
        hold: { workflowName: 'failed-child', when: s => s.status === 'failed' },
        build: (core, generation) => {
          const { createWorkflow } = factories(core, engine);
          const child = createWorkflow({ id: 'failed-child', inputSchema: N, outputSchema: N })
            .then(inc(core, engine, log, generation, 'inner', { fail: true }))
            .commit();
          return createWorkflow({ id: 'failed-parent', inputSchema: N, outputSchema: N })
            .then(child)
            .then(inc(core, engine, log, generation, 'last'))
            .commit();
        },
      });

      expect(result.status).toBe('failed');
      expect(String(result.error?.message ?? result.error)).toContain('inner failed on n=1');
      expect(starts(log, 'inner')).toEqual([]);
      expect(starts(log, 'last')).toEqual([]);
    },
    60_000,
  );

  it('reuses a finished child three levels deep', async () => {
    const log: Entry[] = [];
    const result = await restartAtHold({
      engine,
      name: 'three-levels',
      hold: { workflowName: 'deep-grandchild', when: s => s.status === 'success' },
      build: (core, generation) => {
        const { createWorkflow } = factories(core, engine);
        const grandchild = createWorkflow({ id: 'deep-grandchild', inputSchema: N, outputSchema: N })
          .then(inc(core, engine, log, generation, 'inner'))
          .commit();
        const middle = createWorkflow({ id: 'deep-middle', inputSchema: N, outputSchema: N })
          .then(grandchild)
          .then(inc(core, engine, log, generation, 'middle-last'))
          .commit();
        return createWorkflow({ id: 'deep-parent', inputSchema: N, outputSchema: N })
          .then(middle)
          .then(inc(core, engine, log, generation, 'last'))
          .commit();
      },
    });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 4 });
    expect(starts(log, 'inner')).toEqual([]);
    expect(starts(log, 'middle-last')).toEqual([{ n: 2 }]);
    expect(starts(log, 'last')).toEqual([{ n: 3 }]);
  }, 60_000);

  it('evaluates the loop condition on the finished iteration and runs the next one', async () => {
    const log: Entry[] = [];
    const result = await restartAtHold({
      engine,
      name: 'loop-child-done',
      hold: { workflowName: 'loop-body', when: s => s.status === 'success' },
      build: loop(engine, log),
    });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 3 });
    expect(starts(log, 'inner')).toEqual([{ n: 2 }]);
  }, 60_000);

  it('reuses the finished branch of a parallel and restarts the one still running', async () => {
    const log: Entry[] = [];
    const gate = createGate();
    gates.push(gate);
    const runId = `nested-done-${engine}-parallel`;
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      hold: { workflowName: 'branch-a', when: s => s.status === 'success' },
      build: ({ core, generation }) => {
        const { createWorkflow } = factories(core, engine);
        const branch = (id: string, blocks: boolean) =>
          createWorkflow({ id, inputSchema: N, outputSchema: N })
            .then(
              inc(core, engine, log, generation, `${id}-inner`, {
                gate: blocks && generation === 1 ? gate : undefined,
              }),
            )
            .commit();
        return createWorkflow({ id: 'parallel-parent', inputSchema: N, outputSchema: z.any() })
          .parallel([branch('branch-a', false), branch('branch-b', true)])
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async ({ workflow }) =>
      (await workflow.createRun({ runId })).start({ inputData: { n: 1 } }),
    );
    // Branch A finished, branch B is still running its step.
    await Promise.all([original.held, gate.reached]);
    const checkpoint = await original.checkpoint();
    original.releaseHold();
    const { result } = await scenario.restart(checkpoint);

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ 'branch-a': { n: 2 }, 'branch-b': { n: 2 } });
    expect(starts(log, 'branch-a-inner')).toEqual([]);
    expect(starts(log, 'branch-b-inner')).toEqual([{ n: 1 }]);
  }, 60_000);

  // Default engine: every iteration's child shares one run id, so restart reuses
  // iteration 1's finished child as iteration 2 and the loop stops one short
  // (result n=2). Evented engine: iteration 2's child run has not been saved yet,
  // so restart finds no snapshot for it (COR-1348).
  it.fails("runs the next iteration when the run was cut before that iteration's child started", async () => {
    const log: Entry[] = [];
    const result = await restartAtHold({
      engine,
      name: 'loop-next-not-started',
      hold: { when: iteration2NotStarted },
      build: loop(engine, log),
    });

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ n: 3 });
    expect(starts(log, 'inner')).toEqual([{ n: 2 }]);
  }, 60_000);
});

describe('evented restart does not reuse a finished child from another occurrence (COR-1351)', () => {
  // Only a parent that was restarted before carries iteration 1's child id into
  // iteration 2's record: a first run hands the loop the snapshot it had before
  // iteration 1's child was recorded.
  it("does not leave a previous loop iteration's finished child on the next iteration", async () => {
    const runId = 'nested-done-evented-loop-second-crash';
    const log: Entry[] = [];

    // First crash: iteration 1's child is running.
    const gate = createGate();
    gates.push(gate);
    const first = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) =>
        loop('evented', log, (g, n) => (g === generation && generation === 1 && n === 1 ? gate : undefined))(
          core,
          generation,
        ),
    });
    scenarios.push(first);
    const original = await first.start(async ({ workflow }) =>
      (await workflow.createRun({ runId })).start({ inputData: { n: 1 } }),
    );
    await gate.reached;
    const firstCrash = await original.checkpoint();
    const iteration1Child = (findRow(firstCrash, 'loop-parent', runId)?.snapshot.context as any)['loop-body']?.metadata
      ?.nestedRunId;
    expect(iteration1Child).toBeTruthy();

    // A new process restarts from the first crash and is cut again: iteration 1
    // finished and iteration 2 is marked running, but its child has not started.
    const second = createRestartScenario({
      kind: 'workflow',
      runId,
      hold: { when: iteration2NotStarted },
      build: ({ core, generation }) => loop('evented', log)(core, generation),
    });
    scenarios.push(second);
    const recovering = await second.start(async ({ workflow, workflows }) => {
      for (const row of firstCrash.rows) await workflows.persistWorkflowSnapshot(structuredClone(row));
      return (await workflow.createRun({ runId })).restart();
    });
    const held = await Promise.race([recovering.held!.then(() => true), recovering.settled.then(() => false)]);
    expect(held, 'not exercised: the second cut never happened').toBe(true);
    const secondCrash = await recovering.checkpoint();
    recovering.releaseHold();

    // Naming iteration 1's finished child here would make a restart from this cut
    // reuse its result for iteration 2, ending the loop one iteration short.
    const leaf = (findRow(secondCrash, 'loop-parent', runId)?.snapshot.context as any)['loop-body'];
    expect(leaf.metadata?.nestedRunId).toBeTruthy();
    expect(leaf.metadata?.nestedRunId).not.toBe(iteration1Child);
  }, 60_000);

  // Rows written before `foreachNestedRunIds` existed only record the last child
  // started, so restart falls back to it for the one unfinished item. Here that
  // child is the finished sibling's (item 0), not item 1's.
  it.each([false, true])(
    "does not give a foreach item a sibling item's result (legacy row: %s)",
    async legacy => {
      const runId = `nested-done-evented-foreach-sibling-${legacy}`;
      const log: Entry[] = [];
      let pendingChildren = 0;
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        // Item 0's child finished; item 1's child row exists but has not started.
        hold: { workflowName: 'fe-child', when: s => s.status === 'pending' && ++pendingChildren === 2 },
        build: ({ core, generation }) => {
          const { createWorkflow } = factories(core, 'evented');
          const child = createWorkflow({ id: 'fe-child', inputSchema: N, outputSchema: N })
            .then(inc(core, 'evented', log, generation, 'inner'))
            .commit();
          return createWorkflow({ id: 'fe-parent', inputSchema: z.array(N), outputSchema: z.array(N) })
            .foreach(child, { concurrency: 1 })
            .commit();
        },
      });
      scenarios.push(scenario);
      const original = await scenario.start(async ({ workflow }) =>
        (await workflow.createRun({ runId })).start({ inputData: [{ n: 1 }, { n: 10 }] }),
      );
      const held = await Promise.race([original.held!.then(() => true), original.settled.then(() => false)]);
      expect(held, 'not exercised: item 1 never got a child row').toBe(true);
      const checkpoint = await original.checkpoint();
      original.releaseHold();
      const aggregate = (findRow(checkpoint, 'fe-parent', runId)?.snapshot.context as any)['fe-child'];
      expect(aggregate.output).toEqual([{ n: 2 }, null]);
      expect(aggregate.metadata.nestedRunId).toBe(aggregate.metadata.foreachNestedRunIds[0]);
      if (legacy) delete aggregate.metadata.foreachNestedRunIds;

      const { result, graph } = await scenario.restart(checkpoint);
      const after = await graph.workflows.loadWorkflowSnapshot({ workflowName: 'fe-parent', runId });

      // Item 0's result must never land in item 1's slot.
      expect(after?.context['fe-child']?.output?.[1]).not.toEqual({ n: 2 });
      if (!legacy) {
        // Item 1 has no recorded child, so it starts fresh.
        expect(result).toMatchObject({ status: 'success', result: [{ n: 2 }, { n: 11 }] });
        expect(starts(log, 'inner')).toEqual([{ n: 10 }]);
      } else {
        // The fallback child is item 0's finished run, which cannot be restarted as item 1.
        expect(result.status).toBe('failed');
        expect(starts(log, 'inner')).toEqual([]);
      }
    },
    60_000,
  );
});
