import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import type { ExecutionGraph } from './execution-engine';
import type { WorkflowRunState } from './types';
import { assertTimeTravelGraphMatchesSnapshot, createTimeTravelExecutionParams } from './utils';
import { createStep } from './workflow';

const stepEntry = (id: string) => ({ type: 'step', step: { id } }) as any;
const graphOf = (...entries: any[]): ExecutionGraph => ({ id: 'test-graph', steps: entries }) as ExecutionGraph;

const snapshotWith = (context: Record<string, any>): WorkflowRunState =>
  ({
    runId: 'run-1',
    status: 'success',
    value: {},
    context,
    activePaths: [],
    suspendedPaths: {},
    timestamp: Date.now(),
  }) as unknown as WorkflowRunState;

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
      // Live graph uses new ids (e.g. re-minted mapping ids); snapshot recorded old ones.
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
      ).toThrow(/mapping_old/); // recorded ids listed in the error
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
      expect((params.stepResults.s1 as any).output).toEqual({ v: 2 });
      expect((params.stepResults.s2 as any).output).toEqual({ v: 3 });
    });

    it('does not throw for unselected conditional siblings of the target entry and preserves the skipped marking', () => {
      const conditionalEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a'), stepEntry('branch-b')],
        conditions: [() => true, () => false],
      } as any;
      const graph = graphOf(stepEntry('s1'), conditionalEntry);
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
        // branch-b never ran: no entry
      });

      const params = createTimeTravelExecutionParams({ steps: ['branch-a'], snapshot, graph });
      expect((params.stepResults['branch-b'] as any)?.status).toBe('skipped');
    });

    it('does not throw for a pre-target conditional where only the selected branch was recorded', () => {
      const conditionalEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a'), stepEntry('branch-b')],
        conditions: [() => true, () => false],
      } as any;
      const graph = graphOf(stepEntry('s1'), conditionalEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      expect(() => createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph })).not.toThrow();
    });

    it('throws for a pre-target conditional where no branch step was recorded', () => {
      const conditionalEntry = {
        type: 'conditional',
        steps: [stepEntry('branch-a-renamed'), stepEntry('branch-b-renamed')],
        conditions: [() => true, () => false],
      } as any;
      const graph = graphOf(stepEntry('s1'), conditionalEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'branch-a': recordedStep({ v: 3 }),
        s3: recordedStep({ v: 4 }),
      });

      expect(() => createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph })).toThrow(/branch-a-renamed/);
    });

    it('is a no-op for an empty snapshot context (evented nested-travel fabricated shape)', () => {
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'));
      expect(() =>
        assertTimeTravelGraphMatchesSnapshot({
          targetStepId: 's2',
          graph,
          snapshot: snapshotWith({}),
        }),
      ).not.toThrow();
      // A context holding only the reserved `input` key also counts as empty.
      expect(() =>
        assertTimeTravelGraphMatchesSnapshot({
          targetStepId: 's2',
          graph,
          snapshot: snapshotWith({ input: { v: 1 } }),
        }),
      ).not.toThrow();
    });

    it('does not throw for a sleep entry preceding the target', () => {
      // Sleep ids are minted per build (workflow.ts sleep()), so a restarted process
      // has a different sleep id than the snapshot recorded. Sleeps must not trip the guard.
      const sleepEntry = { type: 'sleep', id: 'sleep_uuid-new', duration: 10 } as any;
      const graph = graphOf(stepEntry('s1'), sleepEntry, stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        'sleep_uuid-old': recordedStep({ v: 2 }),
        s3: recordedStep({ v: 4 }),
      });

      expect(() => createTimeTravelExecutionParams({ steps: ['s3'], snapshot, graph })).not.toThrow();
    });

    it('throws with the dual-cause message when the recorded run stopped before the target', () => {
      // Graph matches the snapshot's ids, but the run failed at s2, so s2 has no entry.
      // Traveling to s3 must fail loudly instead of fabricating {} for s2.
      const graph = graphOf(stepEntry('s1'), stepEntry('s2'), stepEntry('s3'));
      const snapshot = snapshotWith({
        input: { v: 1 },
        s1: recordedStep({ v: 2 }),
        // s2 never completed: no entry
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

      expect(() =>
        createTimeTravelExecutionParams({
          steps: ['s3'],
          snapshot,
          graph,
          context: { s2: { payload: { v: 2 }, output: { v: 3 } } } as any,
        }),
      ).not.toThrow();
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

      // Run the original workflow to completion.
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
      expect((before!.context as any).s2).toBeTruthy();

      // Simulate a process restart with a renamed middle step.
      const renamed = makeWorkflow('s2-renamed');
      new Mastra({ logger: false, storage, workflows: { 'tt-divergence-wf': renamed } });
      const travelRun = await renamed.createRun({ runId: run.runId });

      await expect(travelRun.timeTravel({ step: 's3' as any })).rejects.toThrow(/s2-renamed/);

      // The stored snapshot must be byte-identical (compare serialized copies, never refs).
      const after = await workflowsStore!.loadWorkflowSnapshot({
        workflowName: 'tt-divergence-wf',
        runId: run.runId,
      });
      expect(JSON.stringify(after)).toBe(beforeSerialized);
      expect((after!.context as any).s2).toBeTruthy();
    });
  });
});
