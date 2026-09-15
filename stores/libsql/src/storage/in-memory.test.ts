import { describe, expect, it } from 'vitest';

import { LibSQLStore } from './index';

/**
 * Regression for mastra-ai/mastra#22328.
 *
 * With `@libsql/client` < 0.18.0 an interactive `transaction()` on a bare
 * `:memory:` URL reopened the connection, which created a fresh empty database
 * and dropped every table. With >= 0.18.0 the single connection is pooled, but
 * any call issued while a transaction holds it fails with `TRANSACTION_ACTIVE`
 * unless the store queues it behind the transaction.
 */
describe('LibSQLStore with a bare :memory: url', () => {
  const snapshot = (runId: string) =>
    ({
      runId,
      status: 'running',
      value: {},
      context: {},
      activePaths: [],
      serializedStepGraph: [],
      suspendedPaths: {},
      timestamp: Date.now(),
    }) as any;

  it('keeps tables and rows across an interactive write transaction', async () => {
    const store = new LibSQLStore({ id: 'bare-memory', url: ':memory:' });
    await store.init();
    const workflows = (await store.getStore('workflows'))!;
    const memory = (await store.getStore('memory'))!;

    await memory.saveThread({
      thread: { id: 'thread-1', resourceId: 'r1', title: 't', createdAt: new Date(), updatedAt: new Date() } as any,
    });
    await workflows.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1', snapshot: snapshot('run-1') });

    // updateWorkflowResults opens client.transaction('write')
    await workflows.updateWorkflowResults({
      workflowName: 'wf',
      runId: 'run-1',
      stepId: 'step-1',
      result: { status: 'success', output: { ok: true } } as any,
      requestContext: {},
    });

    const thread = await memory.getThreadById({ threadId: 'thread-1' });
    expect(thread?.id).toBe('thread-1');

    const loaded = await workflows.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1' });
    expect(loaded?.context?.['step-1']).toMatchObject({ status: 'success' });

    await store.close();
  });

  it('serializes concurrent interactive transactions and reads', async () => {
    const store = new LibSQLStore({ id: 'bare-memory-concurrent', url: ':memory:' });
    await store.init();
    const workflows = (await store.getStore('workflows'))!;
    const memory = (await store.getStore('memory'))!;
    await workflows.persistWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1', snapshot: snapshot('run-1') });

    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) =>
        workflows.updateWorkflowResults({
          workflowName: 'wf',
          runId: 'run-1',
          stepId: `step-${i}`,
          result: { status: 'success', output: { i } } as any,
          requestContext: {},
        }),
      ),
      ...Array.from({ length: 5 }, () => memory.listThreads({})),
    ]);

    const loaded = await workflows.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1' });
    expect(Object.keys(loaded?.context ?? {}).sort()).toEqual(['step-0', 'step-1', 'step-2', 'step-3', 'step-4']);

    await store.close();
  });
});
