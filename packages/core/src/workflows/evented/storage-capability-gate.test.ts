import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep } from '../workflow';
import { createWorkflow } from './workflow';

/**
 * The evented engine advances a run from concurrent workers, so every step boundary
 * goes through `updateWorkflowResults` / `updateWorkflowState`. Stores that cannot
 * apply those updates atomically (Redis, Valkey, ClickHouse, LanceDB, Cloudflare
 * D1/KV/DO, Elasticsearch) would silently lose step results, so `createRun()`
 * refuses to start.
 *
 * The error has to name the missing capability and the store it came from, since the
 * only remaining way to reach it is opting into the engine via `schedule`. Durable
 * agents resolve to the in-process engine before they get here — see
 * `DurableAgent.resolveWorkflowEngine`, covered by durable-agent-engine-fallback.test.ts.
 */
describe('evented createRun — storage capability gate', () => {
  function buildWorkflow() {
    return createWorkflow({
      id: 'capability-gate-wf',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
    })
      .then(
        createStep({
          id: 'noop',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async () => ({}),
        }),
      )
      .commit();
  }

  it('refuses to start on a store without atomic concurrent updates', async () => {
    const workflow = buildWorkflow();
    const storage = new MockStore();
    vi.spyOn(storage.stores.workflows as any, 'supportsConcurrentUpdates').mockReturnValue(false);

    new Mastra({ storage, workflows: { 'capability-gate-wf': workflow }, logger: false });

    await expect(workflow.createRun()).rejects.toThrow(/supportsConcurrentUpdates/);
  });

  it('names the configured storage adapter in the error', async () => {
    const workflow = buildWorkflow();
    const storage = new MockStore();
    vi.spyOn(storage.stores.workflows as any, 'supportsConcurrentUpdates').mockReturnValue(false);

    new Mastra({ storage, workflows: { 'capability-gate-wf': workflow }, logger: false });

    // `name` has to survive the init-wrapping proxy around the registered storage,
    // otherwise the message degrades to a generic "the configured storage".
    await expect(workflow.createRun()).rejects.toThrow(/InMemoryStorage/);
  });

  it('starts on a store that supports atomic concurrent updates', async () => {
    const workflow = buildWorkflow();
    const storage = new MockStore();

    new Mastra({ storage, workflows: { 'capability-gate-wf': workflow }, logger: false });

    await expect(workflow.createRun()).resolves.toBeDefined();
  });
});
