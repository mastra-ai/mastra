import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createGate, createRestartScenario, findRow } from '../../agent/durable/__tests__/restart-harness';
import type { Checkpoint, CoreGraph, RestartResult } from '../../agent/durable/__tests__/restart-harness';
import type { WorkflowRunState } from '../types';

const anySchema = z.any();
const stateSchema = z.object({ left: z.number().default(0), right: z.number().default(0) });
const initialState = { left: 0, right: 0 };
type Effect = { generation: number; step: string; input: any; state?: any };
type Execute = (args: { inputData: any; state: any; setState: (state: any) => Promise<void> }) => any;
type Build = (core: CoreGraph, generation: number, effects: Effect[]) => any;
type Context = Record<string, any>;
const context = (snapshot: WorkflowRunState): Context => snapshot.context as Context;
const scenarios: { stop(): Promise<void> }[] = [];
const gates: ReturnType<typeof createGate>[] = [];

afterEach(async () => {
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(scenario => scenario.stop()));
});

function builders(core: CoreGraph, id: string, generation: number, effects: Effect[]) {
  const record = (step: string, input: any, state?: any) => effects.push({ generation, step, input, state });
  const step = (id: string, execute: Execute = ({ inputData }) => ({ n: inputData.n + 1 })) =>
    core.createEventedStep({
      id,
      inputSchema: anySchema,
      outputSchema: anySchema,
      stateSchema,
      execute: async args => {
        record(id, args.inputData, args.state);
        return execute(args);
      },
    });
  const workflow = () =>
    core.createEventedWorkflow({ id, inputSchema: anySchema, outputSchema: anySchema, stateSchema });
  return { step, workflow, record };
}

type CompletedCase = {
  name: string;
  input?: any;
  index: number;
  allowEmptyPath?: boolean;
  finished: string[];
  next?: { step: string; input: any };
  expected: any;
  build: Build;
  ready?: (snapshot: WorkflowRunState) => boolean;
  successorPath?: number[];
};

const cases: CompletedCase[] = [
  {
    name: 'sequential middle entry',
    index: 0,
    finished: ['first'],
    next: { step: 'after', input: { n: 2 } },
    expected: { n: 3 },
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-sequential-middle', generation, effects);
      return workflow().then(step('first')).then(step('after')).commit();
    },
  },
  {
    name: 'final entry',
    index: 1,
    finished: ['first', 'last'],
    expected: { n: 3 },
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-final', generation, effects);
      return workflow().then(step('first')).then(step('last')).commit();
    },
  },
  {
    name: 'map output rather than its input payload',
    index: 0,
    finished: ['transform'],
    next: { step: 'after', input: { n: 10 } },
    expected: { n: 11 },
    build(core, generation, effects) {
      const { workflow, step, record } = builders(core, 'completed-map', generation, effects);
      return workflow()
        .map(
          async ({ inputData }) => {
            record('transform', inputData);
            return { n: inputData.n * 10 };
          },
          { id: 'transform' },
        )
        .then(step('after'))
        .commit();
    },
  },
  {
    name: 'saved output forwarded through a named sleep',
    index: 0,
    finished: ['first'],
    next: { step: 'after', input: { n: 2 } },
    expected: { n: 3 },
    build(core, generation, effects) {
      const { workflow, step, record } = builders(core, 'completed-sleep', generation, effects);
      return workflow()
        .then(step('first'))
        .sleep(
          async ({ inputData }) => {
            record('nap', inputData);
            return 1;
          },
          { id: 'nap' },
        )
        .then(step('after'))
        .commit();
    },
  },
  {
    name: 'terminated loop',
    input: { n: 0 },
    index: 0,
    finished: ['counter'],
    next: { step: 'after', input: { n: 3 } },
    expected: { n: 4 },
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-loop', generation, effects);
      return workflow()
        .dountil(step('counter'), async ({ inputData }) => inputData.n >= 3)
        .then(step('after'))
        .commit();
    },
  },
  {
    name: 'saved nested workflow wrapper',
    index: 0,
    finished: ['inner'],
    next: { step: 'after', input: { n: 2 } },
    expected: { n: 3 },
    ready: snapshot => context(snapshot)['completed-child']?.status === 'success',
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-nested', generation, effects);
      const nested = core
        .createEventedWorkflow({ id: 'completed-child', inputSchema: anySchema, outputSchema: anySchema })
        .then(step('inner'))
        .commit();
      return workflow().then(nested).then(step('after')).commit();
    },
  },
  {
    name: 'parallel outputs and branch state before aggregation',
    index: 0,
    finished: ['left', 'right'],
    next: { step: 'after', input: { left: { n: 2 }, right: { n: 3 } } },
    expected: { n: 5, state: { left: 1, right: 2 } },
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-parallel', generation, effects);
      return workflow()
        .parallel([
          step('left', async ({ inputData, setState }) => {
            await setState({ left: 1 });
            return { n: inputData.n + 1 };
          }),
          step('right', async ({ inputData, setState }) => {
            await setState({ right: 2 });
            return { n: inputData.n + 2 };
          }),
        ])
        .then(step('after', ({ inputData, state }) => ({ n: inputData.left.n + inputData.right.n, state })))
        .commit();
    },
  },
  ...[true, false].map(taken => ({
    name: taken ? 'conditional with an explicitly skipped arm' : 'all-skipped conditional',
    index: 0,
    allowEmptyPath: !taken,
    finished: ['chosen', 'untaken', 'condition'],
    next: { step: 'after', input: taken ? { chosen: { n: 2 } } : {} },
    expected: taken ? { chosen: { n: 2 } } : {},
    ready: (snapshot: WorkflowRunState) =>
      context(snapshot).chosen?.status === (taken ? 'success' : 'skipped') &&
      context(snapshot).untaken?.status === 'skipped',
    build(core: CoreGraph, generation: number, effects: Effect[]) {
      const { workflow, step, record } = builders(core, `completed-conditional-${taken}`, generation, effects);
      return workflow()
        .branch([
          [
            async () => {
              record('condition', taken);
              return taken;
            },
            step('chosen'),
          ],
          [async () => false, step('untaken')],
        ])
        .then(step('after', ({ inputData }) => inputData))
        .commit();
    },
  })),
  {
    name: 'fully saved foreach with ordered item outputs',
    input: [{ n: 1 }, { n: 2 }, { n: 3 }],
    index: 0,
    finished: ['item'],
    next: { step: 'after', input: [{ n: 10 }, { n: 20 }, { n: 30 }] },
    expected: { n: 60 },
    ready: snapshot => {
      const result = context(snapshot).item;
      return (
        result?.status === 'success' && result.output?.length === 3 && result.output.every((item: any) => item !== null)
      );
    },
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-foreach', generation, effects);
      return workflow()
        .foreach(
          step('item', ({ inputData }) => ({ n: inputData.n * 10 })),
          { concurrency: 1 },
        )
        .then(step('after', ({ inputData }) => ({ n: inputData.reduce((sum: number, item: any) => sum + item.n, 0) })))
        .commit();
    },
  },
  {
    name: 'completed occurrence of a step ID reused later',
    index: 0,
    finished: [],
    next: { step: 'bridge', input: { n: 2 } },
    expected: { n: 13 },
    ready: snapshot => context(snapshot).reused?.status === 'success',
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-reused-id', generation, effects);
      const reused = step('reused');
      return workflow()
        .then(reused)
        .then(step('bridge', ({ inputData }) => ({ n: inputData.n + 10 })))
        .then(reused)
        .commit();
    },
  },
  {
    name: 'adjacent occurrences of a reused step ID',
    index: 0,
    finished: [],
    next: { step: 'reused', input: { n: 2 } },
    expected: { n: 3 },
    ready: snapshot => context(snapshot).reused?.status === 'success' && context(snapshot).reused.output.n === 2,
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-adjacent-reused-id', generation, effects);
      const reused = step('reused');
      return workflow().then(reused).then(reused).commit();
    },
  },
  {
    name: 'loop successor reusing the completed step ID',
    index: 0,
    finished: [],
    next: { step: 'reused', input: { n: 2 } },
    expected: { n: 3 },
    ready: snapshot => context(snapshot).reused?.status === 'success' && context(snapshot).reused.output.n === 2,
    build(core, generation, effects) {
      const { workflow, step } = builders(core, 'completed-reused-loop', generation, effects);
      const reused = step('reused');
      return workflow()
        .then(reused)
        .dountil(reused, async () => true)
        .commit();
    },
  },
  ...(['sleep', 'sleepUntil'] as const).map(kind => ({
    name: `${kind} successor reusing the completed step ID`,
    index: 0,
    finished: [],
    next: { step: 'reused', input: { n: 2 } },
    expected: { n: 2 },
    ready: (snapshot: WorkflowRunState) =>
      context(snapshot).reused?.status === 'success' && context(snapshot).reused.output.n === 2,
    build(core: CoreGraph, generation: number, effects: Effect[]) {
      const { workflow, step, record } = builders(core, `completed-reused-${kind}`, generation, effects);
      const flow = workflow().then(step('reused'));
      return (
        kind === 'sleep'
          ? flow.sleep(
              async ({ inputData }) => {
                record('reused', inputData);
                return 1;
              },
              { id: 'reused' },
            )
          : flow.sleepUntil(
              async ({ inputData }) => {
                record('reused', inputData);
                return new Date(Date.now() + 1);
              },
              { id: 'reused' },
            )
      ).commit();
    },
  })),
  ...(['parallel', 'conditional'] as const).flatMap(kind =>
    [0, 1].map(branchIndex => ({
      name: `${kind} successor reusing branch ${branchIndex} ID`,
      index: 0,
      finished: [],
      next: { step: 'reused', input: { n: 2 } },
      successorPath: [1, branchIndex],
      expected: { reused: { n: 3 }, other: { n: 12 } },
      ready: (snapshot: WorkflowRunState) =>
        context(snapshot).reused?.status === 'success' && context(snapshot).reused.output.n === 2,
      build(core: CoreGraph, generation: number, effects: Effect[]) {
        const { workflow, step } = builders(core, `completed-reused-${kind}-${branchIndex}`, generation, effects);
        const reused = step('reused');
        const other = step('other', ({ inputData }) => ({ n: inputData.n + 10 }));
        const branches = branchIndex === 0 ? [reused, other] : [other, reused];
        const flow = workflow().then(reused);
        return (
          kind === 'parallel'
            ? flow.parallel(branches)
            : flow.branch(
                branches.map(
                  branch =>
                    [
                      async ({ getStepResult }: { getStepResult: (id: string) => { n: number } | null }) =>
                        getStepResult('reused')?.n === 2,
                      branch,
                    ] as const,
                ),
              )
        ).commit();
      },
    })),
  ),
  ...[0, false, null, undefined].map(output => ({
    name: `saved ${String(output)} output`,
    index: 0,
    finished: ['first'],
    next: { step: 'after', input: output },
    expected: { output },
    build(core: CoreGraph, generation: number, effects: Effect[]) {
      const { workflow, step } = builders(core, `completed-output-${String(output)}`, generation, effects);
      return workflow()
        .then(step('first', () => output))
        .then(step('after', ({ inputData }) => ({ output: inputData })))
        .commit();
    },
  })),
];

function completedCheckpoint(checkpoints: Checkpoint[], id: string, runId: string, spec: CompletedCase) {
  const checkpoint = checkpoints.find(cp => {
    const snapshot = findRow(cp, id, runId)?.snapshot;
    if (!snapshot || snapshot.status !== 'running') return false;
    if (snapshot.activePaths[0] !== spec.index && !(spec.allowEmptyPath && snapshot.activePaths.length === 0))
      return false;
    if (spec.next && context(snapshot)[spec.next.step] && !spec.ready) return false;
    return spec.ready?.(snapshot) ?? spec.finished.every(step => context(snapshot)[step]?.status === 'success');
  });
  expect(checkpoint, `persisted completed boundary for ${spec.name}`).toBeDefined();
  return checkpoint!;
}

async function capture(spec: CompletedCase, effects: Effect[]) {
  const runId = `completed-boundary-${spec.name.replaceAll(/[^a-z0-9]/gi, '-')}`;
  const scenario = createRestartScenario({
    kind: 'workflow',
    runId,
    build: ({ core, generation }) => spec.build(core, generation, effects),
  });
  scenarios.push(scenario);
  const original = await scenario.start(async graph => {
    const run = await graph.workflow.createRun({ runId });
    return run.start({ inputData: spec.input ?? { n: 1 }, initialState });
  });
  const outcome = await original.settled;
  expect(outcome.status).toBe('fulfilled');
  if (outcome.status !== 'fulfilled') throw outcome.error;
  expect(outcome.result).toMatchObject({ status: 'success', result: spec.expected });
  const checkpoint = completedCheckpoint(original.checkpoints, original.graph.workflow.id, runId, spec);
  return { runId, scenario, original, checkpoint };
}

async function assertRecovered(
  spec: CompletedCase,
  effects: Effect[],
  recovered: RestartResult,
  runId: string,
  generation = 2,
) {
  expect(recovered.graph.workflow.engineType).toBe('evented');
  for (const done of spec.finished) {
    expect(
      effects.filter(effect => effect.generation === generation && effect.step === done),
      `${done} must not replay`,
    ).toEqual([]);
  }
  if (spec.next) {
    const calls = effects.filter(effect => effect.generation === generation && effect.step === spec.next!.step);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.input).toEqual(spec.next.input);
  }
  expect(recovered.result).toMatchObject({ status: 'success', result: spec.expected });
  const snapshot = await recovered.graph.workflows.loadWorkflowSnapshot({
    workflowName: recovered.graph.workflow.id,
    runId,
  });
  expect(snapshot).toMatchObject({ status: 'success', result: { status: 'success', output: spec.expected } });
  expect(snapshot.context.input).toEqual(spec.input ?? { n: 1 });
}

describe('evented restart after a saved completed entry (COR-1354)', () => {
  for (const spec of cases) {
    it(`does not repeat ${spec.name}`, async () => {
      const effects: Effect[] = [];
      const { runId, scenario, checkpoint } = await capture(spec, effects);
      const recovered = await scenario.restart(checkpoint);
      await assertRecovered(spec, effects, recovered, runId);
      if (spec.name === 'completed occurrence of a step ID reused later') {
        expect(
          effects.filter(effect => effect.generation === 2 && effect.step === 'reused').map(effect => effect.input),
        ).toEqual([{ n: 12 }]);
      }
    }, 60_000);
  }

  for (const { name, boundary } of [
    'parallel outputs and branch state before aggregation',
    'completed occurrence of a step ID reused later',
    'adjacent occurrences of a reused step ID',
    'loop successor reusing the completed step ID',
    'sleep successor reusing the completed step ID',
    'sleepUntil successor reusing the completed step ID',
    ...cases.filter(spec => spec.successorPath).map(spec => spec.name),
  ].flatMap(name => ['start snapshot', 'successor input'].map(boundary => ({ name, boundary })))) {
    it(`survives another crash after restart writes its ${boundary}: ${name}`, async () => {
      const effects: Effect[] = [];
      const spec = cases.find(spec => spec.name === name)!;
      let secondCheckpoint: Checkpoint | undefined;
      const monitored: CompletedCase = {
        ...spec,
        build(core, generation, effects) {
          if (generation === 2) {
            const startWorkers = core.Mastra.prototype.startWorkers;
            vi.spyOn(core.Mastra.prototype, 'startWorkers').mockImplementation(async function (...args) {
              const workflows = (await this.getStorage()!.getStore('workflows'))!;
              const persist = workflows.persistWorkflowSnapshot.bind(workflows);
              const update = workflows.updateWorkflowResults.bind(workflows);
              let writes = 0;
              const checkpoint = async () => {
                const { runs } = await workflows.listWorkflowRuns();
                secondCheckpoint = {
                  write: writes,
                  rows: structuredClone(
                    runs.map(run => ({
                      workflowName: run.workflowName,
                      runId: run.runId,
                      snapshot: typeof run.snapshot === 'string' ? JSON.parse(run.snapshot) : run.snapshot,
                    })),
                  ),
                };
              };
              workflows.persistWorkflowSnapshot = async params => {
                const result = await persist(params);
                // The first write seeds graph 2; the second is restart's start snapshot,
                // before the first workflow.step.run can record the successor's input.
                if (++writes === 2 && boundary === 'start snapshot') await checkpoint();
                return result;
              };
              workflows.updateWorkflowResults = async params => {
                const result = await update(params);
                if (
                  boundary === 'successor input' &&
                  !secondCheckpoint &&
                  params.stepId === spec.next!.step &&
                  (params.result.status === 'running' || params.result.status === 'waiting')
                ) {
                  await checkpoint();
                }
                return result;
              };
              return startWorkers.apply(this, args);
            });
          }
          return spec.build(core, generation, effects);
        },
      };
      const { runId, scenario, original, checkpoint } = await capture(monitored, effects);
      await scenario.restart(checkpoint);
      expect(secondCheckpoint, 'a real restart start snapshot was captured').toBeDefined();
      const before = findRow(checkpoint, original.graph.workflow.id, runId)!.snapshot;
      const after = findRow(secondCheckpoint!, original.graph.workflow.id, runId)!.snapshot;
      const recovered = await scenario.restart(secondCheckpoint!);
      await assertRecovered(spec, effects, recovered, runId, 3);
      expect(after.activePaths).toEqual(
        spec.successorPath ?? (spec.next!.step === 'reused' ? [1] : before.activePaths),
      );
      if (spec.next!.step === 'reused') {
        expect(context(after).reused.payload).toEqual({ n: 2 });
        expect(['running', 'waiting']).toContain(context(after).reused.status);
        expect(context(after).reused.output).toBeUndefined();
        expect(context(after).reused.endedAt).toBeUndefined();
      }
      expect(after.context.input).toEqual(before.context.input);
      if (spec.successorPath && boundary === 'start snapshot') {
        expect(after.activeStepsPath.reused).toEqual(spec.successorPath);
        expect(after.activeStepsPath.other).toEqual([1, 1 - spec.successorPath[1]!]);
        expect(context(after).other).toMatchObject({ status: 'running', payload: { n: 2 } });
        expect(context(after).other.output).toBeUndefined();
      }
      if (name === 'completed occurrence of a step ID reused later') {
        expect(
          effects.filter(effect => effect.generation === 3 && effect.step === 'reused').map(effect => effect.input),
        ).toEqual([{ n: 12 }]);
      }
    }, 60_000);
  }

  for (const shape of ['loop', 'parallel', 'foreach'] as const) {
    it(`continues an unfinished ${shape} rather than treating a saved body result as completion`, async () => {
      const effects: Effect[] = [];
      const gate = createGate();
      gates.push(gate);
      const runId = `unfinished-${shape}`;
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        build: ({ core, generation }) => {
          const { workflow, step } = builders(core, runId, generation, effects);
          const block = step('body', async ({ inputData }) => {
            if (generation === 1 && (shape === 'parallel' || inputData.n === 2)) await gate.wait();
            return { n: inputData.n + 1 };
          });
          if (shape === 'loop') {
            return workflow()
              .dountil(block, async ({ inputData }) => inputData.n >= 3)
              .then(step('after'))
              .commit();
          }
          if (shape === 'parallel') {
            return workflow()
              .parallel([step('done'), block])
              .then(step('after', ({ inputData }) => ({ n: inputData.done.n + inputData.body.n })))
              .commit();
          }
          return workflow()
            .foreach(block, { concurrency: 1 })
            .then(
              step('after', ({ inputData }) => ({ n: inputData.reduce((sum: number, item: any) => sum + item.n, 0) })),
            )
            .commit();
        },
      });
      scenarios.push(scenario);
      const original = await scenario.start(async graph => {
        const run = await graph.workflow.createRun({ runId });
        return run.start({ inputData: shape === 'foreach' ? [{ n: 1 }, { n: 2 }, { n: 3 }] : { n: 1 }, initialState });
      });
      expect(await Promise.race([gate.reached.then(() => 'blocked'), original.settled.then(() => 'settled')])).toBe(
        'blocked',
      );
      await vi.waitFor(async () => {
        const snapshot = findRow(await original.checkpoint(), runId, runId)!.snapshot;
        if (shape === 'parallel') expect(context(snapshot).done?.status).toBe('success');
        if (shape === 'foreach') {
          expect(context(snapshot).body?.output?.[0]).toEqual({ n: 2 });
          expect(context(snapshot).body?.output?.[1]).toBeNull();
        }
        if (shape === 'loop') expect(context(snapshot).body?.metadata?.iterationCount).toBeGreaterThanOrEqual(1);
      });
      const checkpoint = await original.checkpoint();
      const recovered = await scenario.restart(checkpoint);
      expect(recovered.graph.workflow.engineType).toBe('evented');
      expect(recovered.result).toMatchObject({ status: 'success', result: { n: shape === 'foreach' ? 9 : 4 } });
      expect(effects.filter(effect => effect.generation === 2 && effect.step === 'after')).toHaveLength(1);
      expect(effects.filter(effect => effect.generation === 2 && effect.step === 'body').length).toBeGreaterThan(0);
      if (shape === 'parallel')
        expect(effects.filter(effect => effect.generation === 2 && effect.step === 'done')).toEqual([]);
      gate.release();
    }, 60_000);
  }

  it('does not treat a suspended parallel arm as a successful completed entry', async () => {
    const effects: Effect[] = [];
    const gate = createGate();
    gates.push(gate);
    const runId = 'suspended-arm-boundary';
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) => {
        const { workflow, step, record } = builders(core, runId, generation, effects);
        const parked = core.createEventedStep({
          id: 'parked',
          inputSchema: anySchema,
          outputSchema: anySchema,
          suspendSchema: z.object({ reason: z.string() }),
          execute: async ({ inputData, suspend }) => {
            record('parked', inputData);
            return suspend({ reason: 'approval' });
          },
        });
        return workflow()
          .parallel([
            parked,
            step('body', async ({ inputData }) => {
              if (generation === 1) await gate.wait();
              return inputData;
            }),
          ])
          .then(step('after'))
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async graph =>
      (await graph.workflow.createRun({ runId })).start({ inputData: { n: 1 } }),
    );
    expect(await Promise.race([gate.reached.then(() => 'blocked'), original.settled.then(() => 'settled')])).toBe(
      'blocked',
    );
    await vi.waitFor(async () => {
      const snapshot = findRow(await original.checkpoint(), runId, runId)!.snapshot;
      expect(snapshot.status).toBe('running');
      expect(context(snapshot).parked?.status).toBe('suspended');
    });
    const recovered = await scenario.restart(await original.checkpoint());
    expect(recovered.result).toMatchObject({ status: 'suspended' });
    expect(effects.filter(effect => effect.generation === 2 && effect.step === 'after')).toEqual([]);
    gate.release();
  }, 60_000);

  it('restarts an empty foreach before its first entry without inventing completed work', async () => {
    const effects: Effect[] = [];
    const runId = 'empty-foreach-before-first';
    const scenario = createRestartScenario({
      kind: 'workflow',
      runId,
      build: ({ core, generation }) => {
        const { workflow, step } = builders(core, runId, generation, effects);
        return workflow()
          .foreach(step('item'))
          .then(step('after', ({ inputData }) => ({ items: inputData })))
          .commit();
      },
    });
    scenarios.push(scenario);
    const original = await scenario.start(async graph =>
      (await graph.workflow.createRun({ runId })).start({ inputData: [] }),
    );
    expect((await original.settled).status).toBe('fulfilled');
    const checkpoint = original.checkpoints.find(cp => {
      const snapshot = findRow(cp, runId, runId)?.snapshot;
      return snapshot?.status === 'running' && snapshot.activePaths.length === 0 && !context(snapshot).item;
    });
    expect(checkpoint).toBeDefined();
    const recovered = await scenario.restart(checkpoint!);
    expect(recovered.result).toMatchObject({ status: 'success', result: { items: [] } });
    expect(effects.filter(effect => effect.generation === 2 && effect.step === 'item')).toEqual([]);
    expect(
      effects.filter(effect => effect.generation === 2 && effect.step === 'after').map(effect => effect.input),
    ).toEqual([[]]);
  }, 60_000);
});
