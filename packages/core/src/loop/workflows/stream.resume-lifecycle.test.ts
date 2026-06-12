/**
 * Pin the registration + RunScope lifecycle contract that `workflowLoopStream`
 * relies on through the `keepRegisteredForResume` flag in `stream.ts`.
 *
 * The flag exists to keep the run-scoped agentic-loop registration alive across
 * a suspend so a later `resume` on the same `runId` can still resolve the same
 * workflow instance. Every other terminal path (success, failed, throw before
 * start) must drop the registration via the `finally` block so the scope's
 * refcount returns to zero and the live closures (controller, stream, transport
 * ref) on the workflow instance are released.
 *
 * The test simulates each branch by replaying the exact `__registerInternalWorkflow`
 * / `__unregisterInternalWorkflow` sequence the stream uses, then asserts the
 * resulting registry + scope state.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { createWorkflow } from '../../workflows/create';
import { createStep } from '../../workflows/workflow';

const passthroughStep = createStep({
  id: 'passthrough',
  inputSchema: z.object({}),
  outputSchema: z.object({}),
  execute: async () => ({}),
});

function makeAgenticLoopWorkflow(id = 'agentic-loop') {
  return createWorkflow({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({}),
  })
    .then(passthroughStep)
    .commit();
}

function makeMastra() {
  return new Mastra({ logger: false });
}

/**
 * Run the same lifecycle dance as `workflowLoopStream`:
 *   1. register the agentic-loop workflow under (id, runId)
 *   2. run the body (which can throw, return suspended, or return success)
 *   3. in `finally`, unregister unless `keepRegisteredForResume` was set
 *
 * `outcome` mirrors the executionResult.status branch in stream.ts.
 */
async function runLifecycle(
  mastra: Mastra,
  runId: string,
  outcome:
    | { kind: 'success' }
    | { kind: 'failed' }
    | { kind: 'suspended' }
    | { kind: 'throw-before-start'; error: Error },
): Promise<{ id: string; instance: unknown }> {
  const wf = makeAgenticLoopWorkflow();
  const id = wf.id;
  mastra.__registerInternalWorkflow(wf, runId);
  let keepRegisteredForResume = false;
  try {
    if (outcome.kind === 'throw-before-start') {
      throw outcome.error;
    }
    if (outcome.kind === 'suspended') {
      keepRegisteredForResume = true;
    }
    // success / failed: do nothing — the finally block will unregister.
  } finally {
    if (!keepRegisteredForResume) {
      mastra.__unregisterInternalWorkflow(id, runId);
    }
  }
  return { id, instance: wf };
}

describe('agentic-loop stream: keepRegisteredForResume lifecycle', () => {
  it('terminal success path: workflow is unregistered and the scope is released', async () => {
    const mastra = makeMastra();
    const { id } = await runLifecycle(mastra, 'run-success', { kind: 'success' });

    expect(mastra.__hasInternalWorkflow(id, 'run-success')).toBe(false);
    expect(mastra.__getRunScope('run-success')).toBeUndefined();
  });

  it('terminal failure path: workflow is unregistered and the scope is released', async () => {
    const mastra = makeMastra();
    const { id } = await runLifecycle(mastra, 'run-failed', { kind: 'failed' });

    expect(mastra.__hasInternalWorkflow(id, 'run-failed')).toBe(false);
    expect(mastra.__getRunScope('run-failed')).toBeUndefined();
  });

  it('suspended path: registration AND scope are kept alive for a later resume', async () => {
    const mastra = makeMastra();
    const { id, instance } = await runLifecycle(mastra, 'run-suspended', { kind: 'suspended' });

    // The same agentic-loop instance is still resolvable by (id, runId).
    expect(mastra.__hasInternalWorkflow(id, 'run-suspended')).toBe(true);
    expect(mastra.__getInternalWorkflow(id, 'run-suspended')).toBe(instance);
    // Scope is still alive so step factories can still read non-serializable state.
    expect(mastra.__getRunScope('run-suspended')).toBeDefined();

    // Clean up — a real resume would eventually call this through the same finally.
    mastra.__unregisterInternalWorkflow(id, 'run-suspended');
    expect(mastra.__hasInternalWorkflow(id, 'run-suspended')).toBe(false);
    expect(mastra.__getRunScope('run-suspended')).toBeUndefined();
  });

  it('throw before execution: registration is dropped and scope is released (no leak)', async () => {
    const mastra = makeMastra();
    const boom = new Error('explode before run.start');

    // The lifecycle helper registers, then throws inside the try, so the
    // `finally` block runs and unregisters before the rejection propagates.
    await expect(runLifecycle(mastra, 'run-throw', { kind: 'throw-before-start', error: boom })).rejects.toBe(boom);

    // No leak: scope is gone, registry has nothing under this runId.
    expect(mastra.__getRunScope('run-throw')).toBeUndefined();
  });

  it('suspended → resume: a second lifecycle on the same runId releases the scope on terminal success', async () => {
    const mastra = makeMastra();

    // First pass suspends — registration kept, scope kept.
    const { id } = await runLifecycle(mastra, 'run-resume', { kind: 'suspended' });
    expect(mastra.__hasInternalWorkflow(id, 'run-resume')).toBe(true);
    expect(mastra.__getRunScope('run-resume')).toBeDefined();

    // Resume re-enters the same lifecycle. The existing registration must be
    // dropped first so the second `__registerInternalWorkflow` is a fresh
    // single-hold registration (mirrors what stream.ts does inside resume
    // after the suspend → finally cycle of the second pass).
    mastra.__unregisterInternalWorkflow(id, 'run-resume');

    // Second pass succeeds — registration dropped, scope released, no leak.
    await runLifecycle(mastra, 'run-resume', { kind: 'success' });
    expect(mastra.__hasInternalWorkflow(id, 'run-resume')).toBe(false);
    expect(mastra.__getRunScope('run-resume')).toBeUndefined();
  });
});
