/**
 * Step timings must survive a durable replay.
 *
 * Durable engines (`@mastra/inngest`) re-run the workflow function body from the
 * top after each completed step, serving already-finished steps from a memo
 * rather than executing them again — see the `wrapDurableOperation` override in
 * `@mastra/inngest`'s `InngestExecutionEngine`. Any wall-clock reading taken
 * *outside* that memoized region therefore measures replay overhead instead of
 * the step's real execution, and the last replay is what lands in the persisted
 * snapshot that the Studio renders.
 *
 * These tests pin the invariant: a step's reported `startedAt`/`endedAt` must be
 * captured inside the durable operation, so a replay reports the original span.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from '../create';
import { DefaultExecutionEngine } from '../default';
import type { StepResult } from '../types';
import { createStep } from '../workflow';

/**
 * Stands in for Inngest: every durable operation is memoized by operation id and
 * is never re-executed. A second run over the same engine therefore replays the
 * first run's steps exactly as Inngest replays a function invocation.
 */
class ReplayExecutionEngine extends DefaultExecutionEngine {
  private memo = new Map<string, unknown>();
  public replayedOperations = 0;

  async wrapDurableOperation<T>(operationId: string, operationFn: () => Promise<T>): Promise<T> {
    if (this.memo.has(operationId)) {
      this.replayedOperations++;
      return this.memo.get(operationId) as T;
    }
    const result = await operationFn();
    this.memo.set(operationId, result);
    return result;
  }
}

const STEP_WORK_MS = 150;
// Timer slack: setTimeout may fire a hair early, and the assertions only need to
// separate "real span" (~150ms) from "replay overhead" (~0ms).
const SLACK_MS = 25;

function durationOf(step: StepResult<any, any, any, any> | undefined) {
  const started = (step as any)?.startedAt;
  const ended = (step as any)?.endedAt;
  if (typeof started !== 'number' || typeof ended !== 'number') {
    throw new Error(`step is missing timestamps: ${JSON.stringify(step)}`);
  }
  return ended - started;
}

function makeSlowWorkflow(engine: DefaultExecutionEngine) {
  const slowStep = createStep({
    id: 'slow-step',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    execute: async () => {
      await new Promise(resolve => setTimeout(resolve, STEP_WORK_MS));
      return { ok: true };
    },
  });

  return createWorkflow({
    id: 'replay-timing-workflow',
    inputSchema: z.object({}),
    outputSchema: z.object({ ok: z.boolean() }),
    executionEngine: engine,
  })
    .then(slowStep)
    .commit();
}

describe('step timings across a durable replay', () => {
  it('reports the real execution span on the first (non-replayed) run', async () => {
    const engine = new ReplayExecutionEngine({ mastra: undefined, options: { validateInputs: false } });
    const workflow = makeSlowWorkflow(engine);

    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');
    expect(durationOf(result.steps['slow-step'])).toBeGreaterThanOrEqual(STEP_WORK_MS - SLACK_MS);
  });

  it('reports the original span again when the step is served from the durable memo', async () => {
    const engine = new ReplayExecutionEngine({ mastra: undefined, options: { validateInputs: false } });
    const workflow = makeSlowWorkflow(engine);

    const firstRun = await workflow.createRun();
    const first = await firstRun.start({ inputData: {} });
    expect(first.status).toBe('success');

    // Same engine ⇒ the step's durable operation is already memoized, so this run
    // replays it without executing the 150ms body — exactly what Inngest does on
    // every re-invocation of the workflow function.
    const replayRun = await workflow.createRun();
    const replayed = await replayRun.start({ inputData: {} });

    expect(replayed.status).toBe('success');
    // Guard the simulation itself: if nothing was served from the memo this test
    // would trivially pass by re-executing the step for real.
    expect(engine.replayedOperations).toBeGreaterThan(0);

    // The step really took ~150ms. A replay must not report ~0ms just because the
    // memoized body returned instantly.
    expect(durationOf(replayed.steps['slow-step'])).toBeGreaterThanOrEqual(STEP_WORK_MS - SLACK_MS);
  });
});
