import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { ExecutionGraph } from './execution-engine';
import type { StepEntry, StepFlowEntry, WorkflowRunState } from './types';
import { createTimeTravelExecutionParams } from './utils';
import { createStep } from './workflow';

const stepEntry = (id: string): StepEntry => ({
  type: 'step',
  step: createStep({
    id,
    inputSchema: z.unknown(),
    outputSchema: z.unknown(),
    execute: async ({ inputData }) => inputData,
  }),
});
const graphOf = (...entries: StepFlowEntry[]): ExecutionGraph => ({ id: 'test-graph', steps: entries });

const snapshotWith = (context: Record<string, any>): WorkflowRunState => ({
  runId: 'run-1',
  status: 'success',
  value: {},
  context,
  serializedStepGraph: [],
  activePaths: [],
  activeStepsPath: {},
  suspendedPaths: {},
  resumeLabels: {},
  waitingPaths: {},
  timestamp: 1000,
});

const recordedStep = (output: Record<string, any>) => ({
  status: 'success',
  payload: {},
  output,
  startedAt: Date.now(),
  endedAt: Date.now(),
});

describe('timeTravel divergence guard', () => {
  describe('unit: assertTimeTravelGraphMatchesSnapshot / createTimeTravelExecutionParams', () => {
    it('throws when a pre-target live-graph step is not recorded in the snapshot', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('mapping_new'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        mapping_old: recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      expect(() =>
        createTimeTravelExecutionParams({
          steps: ['s3'],
          snapshot,
          graph,
        }),
      ).toThrow(/mapping_new/);
      expect(() =>
        createTimeTravelExecutionParams({
          steps: ['s3'],
          snapshot,
          graph,
        }),
      ).toThrow(/mapping_old/);
    });

    it('treats a null or undefined recorded value as not recorded', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        s2: undefined,
        s3: recordedStep({ v: 4 }),
      });

      expect(() =>
        createTimeTravelExecutionParams({
          steps: ['s3'],
          snapshot,
          graph,
        }),
      ).toThrow(/'s2'/);
    });

    it('throws when the target step id does not exist in the live graph (renamed step)', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2-renamed'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        s2: recordedStep({ v: 3 }),
      });

      expect(() =>
        createTimeTravelExecutionParams({
          steps: ['s2'],
          snapshot,
          graph,
        }),
      ).toThrow(/does not exist in the current execution graph/);
    });

    it('does not throw for a healthy snapshot with matching ids', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        s2: recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      const params = createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph });
      expect(params.executionPath).toEqual([2]);
      expect(params.stepResults.s1).toMatchObject({ output: { v: 2 } });
      expect(params.stepResults.s2).toMatchObject({ output: { v: 3 } });
    });

    it('does not throw for unselected conditional siblings of the target entry and preserves the skipped marking', () => {
      const conditionalEntry: StepFlowEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a'), stepEntry('branch-b')],
        conditions: [async () => true, async () => false],
        serializedConditions: [],
      };
      const graph = graphOf(stepEntry('s1'), conditionalEntry);
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
      });

      const params = createTimeTravelExecutionParams({ steps: ['branch-a'], snapshot, graph });
      expect(params.stepResults['branch-b']?.status).toBe('skipped');
    });

    it('marks only unrecorded pre-target conditional arms as skipped', () => {
      const conditionalEntry: StepFlowEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a'), stepEntry('branch-b')],
        conditions: [async () => true, async () => false],
        serializedConditions: [],
      };
      const graph = graphOf(stepEntry('s1'), conditionalEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      const params = createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph });
      expect(params.stepResults['branch-a']).toMatchObject({ status: 'success', output: { v: 3 } });
      expect(params.stepResults['branch-b']).toMatchObject({ status: 'skipped' });
      expect(params.stepResults['branch-b']).not.toHaveProperty('output');
    });

    it('preserves caller-supplied replacement output for a failed pre-target conditional arm', () => {
      const conditionalEntry: StepFlowEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a'), stepEntry('branch-b')],
        conditions: [async () => true, async () => false],
        serializedConditions: [],
      };
      const graph = graphOf(conditionalEntry, stepEntry('s3'));
      const snapshot = snapshotWith({ 'branch-a': recordedStep({ v: 3 }) });

      const params = createTimeTravelExecutionParams({
        steps: ['s3'],
        snapshot,
        graph,
        context: { 'branch-b': { status: 'failed', output: { v: 7 } } },
      });

      expect(params.stepResults['branch-b']).toMatchObject({ status: 'success', output: { v: 7 } });
    });

    it('throws for a pre-target conditional where no branch step was recorded', () => {
      const conditionalEntry: StepFlowEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a-renamed'), stepEntry('branch-b-renamed')],
        conditions: [async () => true, async () => false],
        serializedConditions: [],
      };
      const graph = graphOf(stepEntry('s1'), conditionalEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      expect(() => createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph })).toThrow(/branch-a-renamed/);
    });

    it.each([{}, { input: { v: 1 } }])('reconstructs an empty snapshot context for nested travel: %j', context => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'));
      const params = createTimeTravelExecutionParams({ steps: ['s2'], graph, snapshot: snapshotWith(context) });
      expect(params.executionPath).toEqual([1]);
      expect(params.stepResults.s2).toMatchObject({ status: 'running' });
    });

    it('does not throw for a sleep entry preceding the target', () => {
      const sleepEntry: StepFlowEntry = { type: 'sleep', id: 'sleep_uuid-new', duration: 10 };
      const graph = graphOf(stepEntry('s1'), sleepEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'sleep_uuid-old': recordedStep({ v: 2 }),
        s3: recordedStep({ v: 4 }),
      });

      const params = createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph });
      expect(params.executionPath).toEqual([2]);
      expect(params.stepResults.s1).toMatchObject({ output: { v: 2 } });
    });

    it('throws with the dual-cause message when the recorded run stopped before the target', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
      });

      expect(() => createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph })).toThrow(
        /never reached these steps/,
      );
    });

    it('accepts caller-supplied context as a substitute for a missing snapshot entry', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
      });

      const params = createTimeTravelExecutionParams({
        steps: ['s3'],
        snapshot,
        graph,
        context: { s2: { status: 'success', payload: { v: 2 }, output: { v: 3 } } },
      });
      expect(params.stepResults.s2).toMatchObject({ payload: { v: 2 }, output: { v: 3 } });
    });
  });

  describe('integration: timeTravel on a diverged graph leaves the stored snapshot untouched', () => {
    const makeWorkflow = (middleStepId: string) => {
      const s1 = createStep({
        id: 's1',
        inputSchema: z.object({ v: z.number() }),
        outputSchema: z.object({ v: z.number() }),
        execute: async ({ inputData }) => ({ v: inputData.v + 1 }),
      });
      const middle = createStep({
        id: middleStepId,
        inputSchema: z.object({ v: z.number() }),
        outputSchema: z.object({ v: z.number() }),
        execute: async ({ inputData }) => ({ v: inputData.v * 10 }),
      });
      const s3 = createStep({
        id: 's3',
        inputSchema: z.object({ v: z.number() }),
        outputSchema: z.object({ v: z.number() }),
        execute: async ({ inputData }) => ({ v: inputData.v - 1 }),
      });
      return createWorkflow({
        id: 'tt-divergence-wf',
        inputSchema: z.object({ v: z.number() }),
        outputSchema: z.object({ v: z.number() }),
      })
        .then(s1)
        .then(middle)
        .then(s3)
        .commit();
    };

    it('rejects and keeps the snapshot byte-identical when a middle step was renamed', async () => {
      const storage = new MockStore();

      const original = makeWorkflow('s2');
      new Mastra({ logger: false, storage, workflows: { 'tt-divergence-wf': original } });
      const run = await original.createRun();
      const result = await run.start({ inputData: { v: 1 } });
      expect(result.status).toBe('success');

      const workflowsStore = await storage.getStore('workflows');
      const before = await workflowsStore!.loadWorkflowSnapshot({
        workflowName: 'tt-divergence-wf',
        runId: run.runId,
      });
      expect(before).toBeTruthy();
      const beforeSerialized = JSON.stringify(before);
      expect(before?.context.s2).toMatchObject({ status: 'success', output: { v: 20 } });

      const renamed = makeWorkflow('s2-renamed');
      new Mastra({ logger: false, storage, workflows: { 'tt-divergence-wf': renamed } });
      const travelRun = await renamed.createRun({ runId: run.runId });

      await expect(travelRun.timeTravel({ step: 's3' })).rejects.toThrow(/s2-renamed/);

      const after = await workflowsStore!.loadWorkflowSnapshot({
        workflowName: 'tt-divergence-wf',
        runId: run.runId,
      });
      expect(JSON.stringify(after)).toBe(beforeSerialized);
      expect(after?.context.s2).toMatchObject({ status: 'success', output: { v: 20 } });
    });
  });
});
