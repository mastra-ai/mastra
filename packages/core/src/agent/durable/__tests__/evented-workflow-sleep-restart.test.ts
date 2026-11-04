/**
 * Port of harness case T58 (wf-sleep).
 *
 * - `wf-evented-restart`: an evented workflow is cut off in the step after a
 *   `sleep`/`sleepUntil`, and restarted in a fresh module graph. The harness
 *   SIGKILLs the process; here graph 1 is abandoned at a gate and graph 2
 *   restarts from a copy of its rows.
 * - `wf-default` and `wf-evented`: the same workflows without a restart, where
 *   the harness checks that the sleep actually held and the result passed
 *   through it.
 *
 * The sleep duration is only checked on the non-mechanism cells: restart and
 * redelivery can re-enter the sleep, so those cells assert the result and exact
 * execution log instead, with stale-detecting known differences for
 * COR-1307/COR-1394's completed-transition replay.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createEventedWorkflow, createStep } from '../../../workflows';
import {
  REDELIVERY_MODES,
  expectRedeliveryParity,
  redeliverAndDrain,
} from '../../../workflows/evented/test-utils/redelivery-contract';
import { RedeliveryDriver } from '../../../workflows/evented/test-utils/redelivery-driver';
import { DEFAULT_TIMEOUT_MS, createGate, createRestartScenario, findRow, loadGraph } from './restart-harness';
import type { Checkpoint, Gate } from './restart-harness';

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  // Release graph 1's gates first: a parked step must not be stopped mid-flight.
  for (const gate of gates.splice(0)) gate.release();
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
});

const N = z.object({ n: z.number() });
const statusAt = (checkpoint: Checkpoint, workflowName: string, runId: string, step: string) =>
  (findRow(checkpoint, workflowName, runId)?.snapshot as any)?.context?.[step]?.status;

/** The harness's sleep length and tolerance: the sleep must hold, minus 50ms of clock slack. */
const SLEEP_MS = 1500;
const SLEEP_TOLERANCE_MS = 50;

/**
 * The harness's non-mechanism checks: the workflow succeeded, the result passed
 * through the sleep, and the sleep actually held (`before` finished to `after`
 * started is at least `SLEEP_MS - 50`).
 */
async function checkSleepCell({
  workflow,
  runId,
  measured,
}: {
  workflow: any;
  runId: string;
  measured: { beforeFinishedAt: number; afterStartedAt: number };
}) {
  const run = await workflow.createRun({ runId });
  const result = await run.start({ inputData: { n: 1 } });
  expect(result.status).toBe('success');
  expect(result.result, 'result passed through the sleep').toEqual({ n: 3 });
  const gap = measured.afterStartedAt - measured.beforeFinishedAt;
  expect(gap, `sleep held for >= ${SLEEP_MS}ms (measured ${gap}ms)`).toBeGreaterThanOrEqual(
    SLEEP_MS - SLEEP_TOLERANCE_MS,
  );
}

describe('T58 evented workflow sleep restart in a fresh module graph', () => {
  for (const variant of ['sleep', 'sleep-until'] as const) {
    it(`${variant}: restart completes the run without re-running the step before the sleep`, async () => {
      const runId = `t58-${variant}`;
      const gate = createGate();
      gates.push(gate);
      const executed: string[] = [];
      const scenario = createRestartScenario({
        kind: 'workflow',
        runId,
        build: ({ core, generation }) => {
          const step = (id: string, gated = false) =>
            core.createEventedStep({
              id,
              inputSchema: N,
              outputSchema: N,
              execute: async ({ inputData }) => {
                executed.push(`${generation}:${id}`);
                if (gated && generation === 1) await gate.wait();
                return { n: inputData.n + 1 };
              },
            });
          const start = core
            .createEventedWorkflow({ id: 't58-wf', inputSchema: N, outputSchema: N })
            .then(step('before'));
          const slept =
            variant === 'sleep'
              ? start.sleep(20, { id: 'nap' })
              : start.sleepUntil(async () => new Date(Date.now() + 20), { id: 'nap' });
          return slept.then(step('after', true)).commit();
        },
      });
      scenarios.push(scenario);

      const original = await scenario.start(async ({ workflow }) => {
        const run = await workflow.createRun({ runId });
        return run.start({ inputData: { n: 1 } });
      });
      const reached = await Promise.race([gate.reached.then(() => true), original.settled.then(() => false)]);
      if (!reached) throw new Error('not exercised: run ended before the gated step');
      await vi.waitFor(
        async () => {
          expect(statusAt(await original.checkpoint(), 't58-wf', runId, 'after')).toBe('running');
        },
        { timeout: DEFAULT_TIMEOUT_MS },
      );

      const checkpoint = await original.checkpoint();
      expect(findRow(checkpoint, 't58-wf', runId)?.snapshot.status).toBe('running');

      const { result } = await scenario.restart(checkpoint);
      expect(result.status).toBe('success');
      expect(result.result).toEqual({ n: 3 });
      // The passed sleep is a completed step: the restart resumes after it.
      expect(executed.filter(e => e.startsWith('2:'))).toEqual(['2:after']);
    }, 60_000);
  }
});

describe('T58 wf-sleep: the sleep holds without a restart', () => {
  for (const variant of ['sleep', 'sleep-until'] as const) {
    it(`default / ${variant}: sleeps for at least ${SLEEP_MS}ms and passes the result through`, async () => {
      const core = await loadGraph();
      const measured = { beforeFinishedAt: 0, afterStartedAt: 0 };
      const step = (id: string) =>
        core.createStep({
          id,
          inputSchema: N,
          outputSchema: N,
          execute: async ({ inputData }) => {
            if (id === 'before') measured.beforeFinishedAt = Date.now();
            if (id === 'after') measured.afterStartedAt = Date.now();
            return { n: inputData.n + 1 };
          },
        });
      const before = core
        .createWorkflow({ id: 't58-nap-default', inputSchema: N, outputSchema: N })
        .then(step('before'));
      const slept =
        variant === 'sleep'
          ? before.sleep(SLEEP_MS, { id: 'nap' })
          : before.sleepUntil(async () => new Date(Date.now() + SLEEP_MS), { id: 'nap' });
      const built = slept.then(step('after')).commit();
      const app = new core.Mastra({
        logger: false,
        storage: new core.InMemoryStore(),
        workflows: { 't58-nap-default': built },
      });
      try {
        await checkSleepCell({
          workflow: app.getWorkflowById('t58-nap-default'),
          runId: `t58-nap-default-${variant}`,
          measured,
        });
      } finally {
        await app.stopWorkers?.();
      }
    }, 30_000);

    it(`evented / ${variant}: sleeps for at least ${SLEEP_MS}ms and passes the result through`, async () => {
      const core = await loadGraph();
      const measured = { beforeFinishedAt: 0, afterStartedAt: 0 };
      const step = (id: string) =>
        core.createEventedStep({
          id,
          inputSchema: N,
          outputSchema: N,
          execute: async ({ inputData }) => {
            if (id === 'before') measured.beforeFinishedAt = Date.now();
            if (id === 'after') measured.afterStartedAt = Date.now();
            return { n: inputData.n + 1 };
          },
        });
      const before = core
        .createEventedWorkflow({ id: 't58-nap-evented', inputSchema: N, outputSchema: N })
        .then(step('before'));
      const slept =
        variant === 'sleep'
          ? before.sleep(SLEEP_MS, { id: 'nap' })
          : before.sleepUntil(async () => new Date(Date.now() + SLEEP_MS), { id: 'nap' });
      const built = slept.then(step('after')).commit();
      const app = new core.Mastra({
        logger: false,
        storage: new core.InMemoryStore(),
        workflows: { 't58-nap-evented': built },
      });
      await app.startWorkers();
      try {
        await checkSleepCell({
          workflow: app.getWorkflowById('t58-nap-evented'),
          runId: `t58-nap-evented-${variant}`,
          measured,
        });
      } finally {
        await app.stopWorkers?.();
      }
    }, 30_000);
  }
});

describe('T58 wf-evented-redeliver', () => {
  for (const variant of ['sleep', 'sleep-until'] as const) {
    it.each(REDELIVERY_MODES)(`${variant} / %s: executes each completed transition once`, async mode => {
      const driver = new RedeliveryDriver();
      const executed: string[] = [];
      const step = (id: string) =>
        createStep({
          id,
          inputSchema: N,
          outputSchema: N,
          execute: async ({ inputData }) => {
            executed.push(id);
            return { n: inputData.n + 1 };
          },
        });
      const workflowId = `t58-redeliver-${variant}`;
      const before = createEventedWorkflow({ id: workflowId, inputSchema: N, outputSchema: N }).then(step('before'));
      const slept =
        variant === 'sleep'
          ? before.sleep(20, { id: 'nap' })
          : before.sleepUntil(async () => new Date(Date.now() + 20), { id: 'nap' });
      const workflow = slept.then(step('after')).commit();
      const mastra = new Mastra({
        logger: false,
        storage: new MockStore(),
        pubsub: driver.pubsub,
        workflows: { [workflowId]: workflow },
      });
      try {
        await mastra.startWorkers();
        driver.assertEvented(workflow);
        const runId = `${workflowId}-run`;
        const run = await workflow.createRun({ runId });
        const result = await run.start({ inputData: { n: 1 } });
        expect(result.status).toBe('success');
        expect(result.result).toEqual({ n: 3 });
        expect(executed).toEqual(['before', 'after']);

        const match = { spec: `${workflowId}@0`, runId } as const;
        const original = driver.stepRuns(match).at(-1)!;
        expect(original.data).toMatchObject({ workflowId, runId, executionPath: [0] });
        const { event } = await redeliverAndDrain(driver, match, mode);
        expect(event.data).toEqual(original.data);
        expect(event.data).toMatchObject({ workflowId, runId, executionPath: [0] });
        expectRedeliveryParity(
          { executed },
          { executed: ['before', 'after'] },
          mode === 'same-id'
            ? undefined
            : {
                reason:
                  'COR-1307 / COR-1394: a completed transition drives the sleep chain again on fresh-ID or expired replay.',
                expect: correct => ({ ...correct, executed: [...correct.executed, ...correct.executed] }),
              },
        );
      } finally {
        await mastra.stopWorkers();
        driver.dispose();
        vi.useRealTimers();
      }
    });
  }
});
