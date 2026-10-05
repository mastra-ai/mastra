/**
 * Port of harness case T58 (wf-sleep), the `wf-evented-restart` cells: an
 * evented workflow is cut off in the step after a `sleep`/`sleepUntil`, and
 * restarted in a fresh module graph. The harness SIGKILLs the process; here
 * graph 1 is abandoned at a gate and graph 2 restarts from a copy of its rows.
 *
 * The harness also checks how long the sleep holds, but only on the cells
 * without a mechanism — the mechanism cells re-run the sleep in graph 2, so
 * timing there is excluded, and it is excluded here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createGate, createRestartScenario, findRow } from './restart-harness';
import type { Checkpoint, Gate } from './restart-harness';

const gates: Gate[] = [];
const scenarios: { stop(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(scenarios.splice(0).map(s => s.stop()));
  for (const gate of gates.splice(0)) gate.release();
});

const N = z.object({ n: z.number() });
const statusAt = (checkpoint: Checkpoint, workflowName: string, runId: string, step: string) =>
  (findRow(checkpoint, workflowName, runId)?.snapshot as any)?.context?.[step]?.status;

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
      await vi.waitFor(async () => {
        expect(statusAt(await original.checkpoint(), 't58-wf', runId, 'after')).toBe('running');
      });

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
