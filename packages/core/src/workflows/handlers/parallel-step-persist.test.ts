/**
 * A parallel branch's finished children must reach the persisted snapshot as soon
 * as they finish — not only once the whole block joins.
 *
 * `executeParallel` pre-marks every child `running`, fans out over `Promise.all`,
 * and only the surrounding `executeEntry` persists afterwards. Until the slowest
 * sibling lands, `getWorkflowRunById` therefore keeps reporting already-finished
 * children as `running`, and the Studio graph shows a completed step still
 * spinning while a long-running sibling holds the branch open.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createWorkflow } from '../create';
import { DefaultExecutionEngine } from '../default';
import { createStep } from '../workflow';

type StepResults = Record<string, { status?: string } | undefined>;

/**
 * Records every persisted snapshot's step map. The snapshot holds a live
 * reference to the engine's `stepResults`, so each write is deep-copied at write
 * time — otherwise later mutations would rewrite the history under assertion.
 */
function makeRecordingMastra() {
  const snapshots: StepResults[] = [];
  const store = {
    persistWorkflowSnapshot: async ({ snapshot }: { snapshot: { context?: unknown } }) => {
      snapshots.push(JSON.parse(JSON.stringify(snapshot.context ?? {})) as StepResults);
    },
  };
  const mastra = {
    getStorage: () => ({ getStore: async () => store }),
  } as any;
  return { mastra, snapshots };
}

const FAST_MS = 10;
const SLOW_MS = 250;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeParallelWorkflow(engine: DefaultExecutionEngine) {
  const io = { inputSchema: z.object({}), outputSchema: z.object({ ok: z.boolean() }) };

  const fastStep = createStep({
    id: 'fast-step',
    ...io,
    execute: async () => {
      await sleep(FAST_MS);
      return { ok: true };
    },
  });

  const slowStep = createStep({
    id: 'slow-step',
    ...io,
    execute: async () => {
      await sleep(SLOW_MS);
      return { ok: true };
    },
  });

  return createWorkflow({
    id: 'parallel-persist-workflow',
    inputSchema: z.object({}),
    outputSchema: z.looseObject({}),
    executionEngine: engine,
  })
    .parallel([fastStep, slowStep])
    .commit();
}

describe('parallel step persistence', () => {
  it('persists a fast child as success while a slow sibling is still running', async () => {
    const { mastra, snapshots } = makeRecordingMastra();
    const engine = new DefaultExecutionEngine({
      mastra,
      options: { validateInputs: false, shouldPersistSnapshot: () => true },
    });

    const workflow = makeParallelWorkflow(engine);
    const run = await workflow.createRun();
    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('success');

    // The window under test: `fast-step` has landed but `slow-step` has not. This
    // is the state `getWorkflowRunById` serves for ~240ms of the run, and it is
    // what the Studio graph renders.
    const sawFastDoneWhileSlowRunning = snapshots.some(
      steps => steps['fast-step']?.status === 'success' && steps['slow-step']?.status === 'running',
    );

    expect(sawFastDoneWhileSlowRunning).toBe(true);
  });
});
