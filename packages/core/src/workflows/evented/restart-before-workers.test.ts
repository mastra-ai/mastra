/**
 * An evented run can be restarted by a *different* process than the one that
 * started it (the run outlives the process; a boot path re-drives it from the
 * snapshot). The restart publishes a `workflow.start` event that only a worker
 * consumes, so if the new process has not started its workers yet the event is
 * published to no one: the run stalls forever, with no error and no rejection.
 *
 * The durable-agent recovery path avoids this because `DurableAgent.recover()`
 * calls `ensureEngineWorkersStarted()` before it re-drives the run. The plain
 * workflow restart path did not, which is what this test covers.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const RUN_ID = 'restart-before-workers-run';
const WORKFLOW_ID = 'restart-before-workers';
const STALL_TIMEOUT_MS = 5_000;

function createGate() {
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  let reached!: () => void;
  const reachedPromise = new Promise<void>(resolve => (reached = resolve));
  return {
    reached: reachedPromise,
    async wait() {
      reached();
      await released;
    },
    release() {
      release();
    },
  };
}

describe('evented restart before workers have started', () => {
  it('starts the workers so the restart completes instead of stalling', async () => {
    const storage = new MockStore();
    const gate = createGate();
    const log: Array<{ generation: number; event: 'start' | 'commit' }> = [];

    // Two "processes" over one storage: generation 1 is running and parked
    // mid-step, generation 2 has the same workflow registered but never called
    // `startWorkers()`.
    const buildWorkflow = (generation: number) => {
      const block = createStep({
        id: 'block',
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ n: z.number() }),
        execute: async ({ inputData }) => {
          log.push({ generation, event: 'start' });
          if (generation === 1) await gate.wait();
          log.push({ generation, event: 'commit' });
          return inputData;
        },
      });
      return createWorkflow({
        id: WORKFLOW_ID,
        inputSchema: z.object({ n: z.number() }),
        outputSchema: z.object({ n: z.number() }),
      })
        .then(block)
        .commit();
    };

    const firstProcess = new Mastra({
      logger: false,
      storage,
      workflows: { [WORKFLOW_ID]: buildWorkflow(1) },
    });
    await firstProcess.startWorkers();

    const run1 = await firstProcess.getWorkflow(WORKFLOW_ID).createRun({ runId: RUN_ID });
    const firstRun = run1.start({ inputData: { n: 1 } });
    await vi.waitFor(async () => {
      const snapshot = await (await storage.getStore('workflows'))!.loadWorkflowSnapshot({
        workflowName: WORKFLOW_ID,
        runId: RUN_ID,
      });
      expect(snapshot?.status).toBe('running');
    });
    // Guard against a vacuous pass: the run really is parked inside generation 1.
    expect(log).toEqual([{ generation: 1, event: 'start' }]);

    const secondProcess = new Mastra({
      logger: false,
      storage,
      workflows: { [WORKFLOW_ID]: buildWorkflow(2) },
    });
    const run2 = await secondProcess.getWorkflow(WORKFLOW_ID).createRun({ runId: RUN_ID });
    const outcome = await Promise.race([
      run2.restart().then(
        result => `resolved:${result.status}`,
        (error: unknown) => `rejected:${error instanceof Error ? error.message : String(error)}`,
      ),
      new Promise<string>(resolve => setTimeout(() => resolve(`stalled:${STALL_TIMEOUT_MS}ms`), STALL_TIMEOUT_MS)),
    ]);

    gate.release();
    await firstRun;
    await firstProcess.stopWorkers();
    await secondProcess.stopWorkers();

    expect(outcome).toBe('resolved:success');
    expect(log).toContainEqual({ generation: 2, event: 'commit' });
  }, 60_000);
});
