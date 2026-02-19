/**
 * Regression tests for workflow parallel step hanging.
 *
 * Issue: Workflows using parallel steps hang silently — no error, the workflow
 * just stops progressing. Eventually a timeout error with status 0 appears.
 *
 * Three root causes were identified and fixed:
 *
 * 1. Race condition in parallel completion check:
 *    processWorkflowStepEnd used the return value of updateWorkflowResults to
 *    check if all parallel branches completed. With a real database, concurrent
 *    branches can get stale return values (each only sees its own result), so
 *    both return early → nobody advances → permanent hang.
 *    Fix: re-read from storage via loadWorkflowSnapshot after writing.
 *
 * 2. Unhandled errors in process():
 *    If updateWorkflowResults throws, the error escapes process(), is silently
 *    dropped by EventEmitterPubSub (emit() doesn't await async listeners), and
 *    the workflow hangs because workflow.fail is never published.
 *    Fix: try/catch around the switch statement in process().
 *
 * 3. processWorkflowFail itself throwing:
 *    If the workflow.fail handler throws (e.g. updateWorkflowState not
 *    implemented or storage error), the workflows-finish event is never
 *    published and the execution engine's result promise hangs forever.
 *    Fix: catch block publishes workflows-finish directly when workflow.fail
 *    handler throws.
 *
 * These tests use the EVENTED workflow system (same as server/playground),
 * not the default execution engine.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '../evented';

const HANG_TIMEOUT_MS = 10_000;

describe('Workflow parallel step hang fixes (Evented)', () => {
  let testStorage: InstanceType<typeof MockStore>;

  beforeEach(async () => {
    vi.resetAllMocks();
    testStorage = new MockStore();
  });

  describe('Fix 1: re-read from storage after updateWorkflowResults', () => {
    it(
      'should not hang when concurrent updateWorkflowResults calls return stale data',
      async () => {
        // This test reproduces the deterministic hang from the user report.
        //
        // The bug: processWorkflowStepEnd used the RETURN VALUE of
        // updateWorkflowResults to check if all parallel branches completed.
        // With a real DB, concurrent writes can return stale snapshots:
        //
        //   1. Step A and Step B complete nearly simultaneously
        //   2. Both call updateWorkflowResults concurrently
        //   3. Each write succeeds (the DB has both results)
        //   4. But each gets back a stale snapshot with only ITS OWN result
        //   5. Both check: keys.length (1) < step.steps.length (2) → return early
        //   6. Nobody publishes the next step → permanent hang
        //
        // The fix: after writing, re-read via loadWorkflowSnapshot to get the
        // authoritative state from storage.
        //
        // This test simulates the stale return values by mocking
        // updateWorkflowResults, while leaving loadWorkflowSnapshot unmocked
        // so it reads the real (correct) state from the in-memory store.

        const stepA = createStep({
          id: 'step-a',
          inputSchema: z.object({}),
          outputSchema: z.object({ v: z.string() }),
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { v: 'a' };
          },
        });

        const stepB = createStep({
          id: 'step-b',
          inputSchema: z.object({}),
          outputSchema: z.object({ v: z.string() }),
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { v: 'b' };
          },
        });

        const finalStep = createStep({
          id: 'final',
          inputSchema: z.any(),
          outputSchema: z.object({ done: z.boolean() }),
          execute: async () => ({ done: true }),
        });

        const workflow = createWorkflow({
          id: 'race-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          steps: [stepA, stepB, finalStep],
        });

        workflow.parallel([stepA, stepB]).then(finalStep).commit();

        const mastra = new Mastra({
          workflows: { 'race-workflow': workflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        const workflowsStore = await testStorage.getStore('workflows');
        const original = workflowsStore!.updateWorkflowResults.bind(workflowsStore);

        // Collect concurrent calls so we can control execution order
        let pendingCalls: Array<{ args: any; resolve: (v: any) => void }> = [];

        vi.spyOn(workflowsStore!, 'updateWorkflowResults').mockImplementation(async args => {
          return new Promise<any>(resolve => {
            pendingCalls.push({ args, resolve });

            // When both parallel branches have called updateWorkflowResults,
            // execute both writes but return stale snapshots to each caller.
            if (pendingCalls.length === 2) {
              const calls = [...pendingCalls];
              pendingCalls = [];

              (async () => {
                // Write step A's result — snapshot now has {input, step-a}
                const result1 = await original(calls[0]!.args);
                const staleResult1 = JSON.parse(JSON.stringify(result1));

                // Write step B's result — snapshot now has {input, step-a, step-b}
                const result2 = await original(calls[1]!.args);

                // Return stale data: each caller only sees its own step.
                // This simulates what happens with a real DB under concurrent writes.
                calls[0]!.resolve(staleResult1);

                const staleResult2: Record<string, any> = {};
                staleResult2[calls[1]!.args.stepId] = result2[calls[1]!.args.stepId];
                staleResult2['input'] = result2['input'];
                calls[1]!.resolve(staleResult2);
              })();
            }
          });
        });

        try {
          const run = await workflow.createRun();
          const result = await run.start({ inputData: {} });

          // Without the fix: hangs forever (times out at 10s)
          // With the fix: loadWorkflowSnapshot reads the real store which has
          // both results → completion check passes → workflow finishes
          expect(result.status).toBe('success');
        } finally {
          await mastra.stopEventEngine();
        }
      },
      HANG_TIMEOUT_MS,
    );
  });

  describe('Fix 2: try/catch in process() for storage errors', () => {
    it(
      'should not hang when updateWorkflowResults throws during parallel execution',
      async () => {
        // If updateWorkflowResults throws during parallel step completion,
        // the error must be caught so workflow.fail is published.
        // Without the try/catch in process(), the error escapes and
        // EventEmitterPubSub silently drops the rejected promise → hang.

        const step1 = createStep({
          id: 'parallel-a',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute: async () => ({ value: 'a' }),
        });

        const step2 = createStep({
          id: 'parallel-b',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute: async () => {
            await new Promise(resolve => setTimeout(resolve, 50));
            return { value: 'b' };
          },
        });

        const finalStep = createStep({
          id: 'final-step',
          inputSchema: z.any(),
          outputSchema: z.object({ done: z.boolean() }),
          execute: async () => ({ done: true }),
        });

        const workflow = createWorkflow({
          id: 'storage-error-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          steps: [step1, step2, finalStep],
        });

        workflow.parallel([step1, step2]).then(finalStep).commit();

        const mastra = new Mastra({
          workflows: { 'storage-error-workflow': workflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        const workflowsStore = await testStorage.getStore('workflows');
        let callCount = 0;
        const original = workflowsStore!.updateWorkflowResults.bind(workflowsStore);
        vi.spyOn(workflowsStore!, 'updateWorkflowResults').mockImplementation(async args => {
          callCount++;
          if (callCount === 2) {
            throw new Error('Simulated storage connection timeout');
          }
          return original(args);
        });

        try {
          const run = await workflow.createRun();
          const result = await run.start({ inputData: {} });

          // Without the fix: hangs forever (times out at 10s)
          // With the fix: process() catches the error → publishes workflow.fail
          expect(result.status).toBe('failed');
        } finally {
          await mastra.stopEventEngine();
        }
      },
      HANG_TIMEOUT_MS,
    );
  });

  describe('Fix 3: workflows-finish published when processWorkflowFail throws', () => {
    it(
      'should not hang when both updateWorkflowResults and updateWorkflowState throw',
      async () => {
        // This reproduces the hang when the fail handler itself fails.
        // Chain of events:
        //   1. updateWorkflowResults throws → try/catch publishes workflow.fail
        //   2. processWorkflowFail calls updateWorkflowState → also throws
        //   3. workflows-finish (which resolves the execution engine's promise)
        //      was never reached → hang
        //
        // This matches storage backends where these methods aren't implemented
        // (e.g. PostgreSQL's WorkflowsPg throws "Method not implemented").

        const step1 = createStep({
          id: 'step-a',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute: async () => ({ value: 'a' }),
        });

        const workflow = createWorkflow({
          id: 'fail-handler-crash-workflow',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          steps: [step1],
        });

        workflow.then(step1).commit();

        const mastra = new Mastra({
          workflows: { 'fail-handler-crash-workflow': workflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        const workflowsStore = await testStorage.getStore('workflows');

        // Make updateWorkflowResults throw (simulates unimplemented or broken storage)
        vi.spyOn(workflowsStore!, 'updateWorkflowResults').mockRejectedValue(new Error('Method not implemented.'));
        // Make updateWorkflowState also throw (the fail handler uses this)
        vi.spyOn(workflowsStore!, 'updateWorkflowState').mockRejectedValue(new Error('Method not implemented.'));

        try {
          const run = await workflow.createRun();
          const result = await run.start({ inputData: {} });

          // Without the fix: hangs forever (times out at 10s)
          // With the fix: catch block publishes workflows-finish directly
          expect(result.status).toBe('failed');
        } finally {
          await mastra.stopEventEngine();
        }
      },
      HANG_TIMEOUT_MS,
    );
  });

  describe('Fix 4: strip stepResults from parentWorkflow events', () => {
    it(
      'should not carry parent stepResults through nested workflow events',
      async () => {
        // This test verifies the memory optimization: parentWorkflow no longer
        // carries the full stepResults through every event. Instead, the parent's
        // stepResults are loaded from storage when the nested workflow completes.
        //
        // Without this fix, each nested workflow event carries the FULL ancestor
        // stepResults chain at every nesting level. For a forEach with N items,
        // the Kth iteration's events carry all K-1 previous results, leading to
        // O(N²) memory growth. With deeply nested workflows, this can reach GBs.

        const innerStep = createStep({
          id: 'inner-step',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          execute: async () => ({ value: 'inner-result' }),
        });

        const innerWorkflow = createWorkflow({
          id: 'inner-wf',
          inputSchema: z.object({}),
          outputSchema: z.object({ value: z.string() }),
          steps: [innerStep],
        });
        innerWorkflow.then(innerStep).commit();

        const finalStep = createStep({
          id: 'final-step',
          inputSchema: z.any(),
          outputSchema: z.object({ done: z.boolean() }),
          execute: async () => ({ done: true }),
        });

        const outerWorkflow = createWorkflow({
          id: 'nested-event-wf',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          steps: [innerWorkflow, finalStep],
        });

        outerWorkflow.then(innerWorkflow).then(finalStep).commit();

        const mastra = new Mastra({
          workflows: { 'nested-event-wf': outerWorkflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        // Spy on pubsub.publish to capture events and verify parentWorkflow payloads
        const publishedEvents: Array<{ type: string; data: any }> = [];
        const originalPublish = mastra.pubsub.publish.bind(mastra.pubsub);
        vi.spyOn(mastra.pubsub, 'publish').mockImplementation(async (topic, event) => {
          if (topic === 'workflows') {
            publishedEvents.push(event as any);
          }
          return originalPublish(topic, event);
        });

        try {
          const run = await outerWorkflow.createRun();
          const result = await run.start({ inputData: {} });

          expect(result.status).toBe('success');

          // Verify that workflow.start events for nested workflows do NOT carry
          // stepResults in parentWorkflow
          const nestedStartEvents = publishedEvents.filter(e => e.type === 'workflow.start' && e.data?.parentWorkflow);
          expect(nestedStartEvents.length).toBeGreaterThan(0);

          for (const event of nestedStartEvents) {
            // parentWorkflow should NOT have stepResults (the key memory optimization)
            expect(event.data.parentWorkflow.stepResults).toBeUndefined();
          }

          // Also verify that workflow.step.end events going back to parent
          // don't carry stale stepResults from parentWorkflow
          const stepEndEvents = publishedEvents.filter(e => e.type === 'workflow.step.end' && e.data?.parentContext);
          for (const event of stepEndEvents) {
            // stepResults should be empty (loaded from storage instead)
            expect(Object.keys(event.data.stepResults).length).toBe(0);
          }
        } finally {
          await mastra.stopEventEngine();
        }
      },
      HANG_TIMEOUT_MS,
    );

    it(
      'should complete deeply nested workflow (3 levels) correctly after stripping stepResults',
      async () => {
        // Ensures the storage-read fallback works at multiple nesting levels:
        // outer → intermediary → inner

        const innerStep = createStep({
          id: 'deep-inner-step',
          inputSchema: z.object({}),
          outputSchema: z.object({ v: z.string() }),
          execute: async () => ({ v: 'deep' }),
        });

        const innerWorkflow = createWorkflow({
          id: 'deep-inner-wf',
          inputSchema: z.object({}),
          outputSchema: z.object({ v: z.string() }),
          steps: [innerStep],
        });
        innerWorkflow.then(innerStep).commit();

        const intermediaryStep = createStep({
          id: 'intermediary-step',
          inputSchema: z.any(),
          outputSchema: z.object({ v: z.string() }),
          execute: async () => ({ v: 'mid' }),
        });

        const intermediaryWorkflow = createWorkflow({
          id: 'intermediary-wf',
          inputSchema: z.object({}),
          outputSchema: z.object({ v: z.string() }),
          steps: [innerWorkflow, intermediaryStep],
        });
        intermediaryWorkflow.then(innerWorkflow).then(intermediaryStep).commit();

        const finalStep = createStep({
          id: 'final-step',
          inputSchema: z.any(),
          outputSchema: z.object({ done: z.boolean() }),
          execute: async () => ({ done: true }),
        });

        const outerWorkflow = createWorkflow({
          id: 'deep-nested-wf',
          inputSchema: z.object({}),
          outputSchema: z.object({ done: z.boolean() }),
          steps: [intermediaryWorkflow, finalStep],
        });
        outerWorkflow.then(intermediaryWorkflow).then(finalStep).commit();

        const mastra = new Mastra({
          workflows: { 'deep-nested-wf': outerWorkflow },
          storage: testStorage,
        });
        await mastra.startEventEngine();

        try {
          const run = await outerWorkflow.createRun();
          const result = await run.start({ inputData: {} });

          // The key assertion: deeply nested workflows should still complete
          // correctly even though parentWorkflow no longer carries stepResults
          expect(result.status).toBe('success');
        } finally {
          await mastra.stopEventEngine();
        }
      },
      HANG_TIMEOUT_MS,
    );
  });
});
