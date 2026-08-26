import { describe, expect, it, vi } from 'vitest';

import { LibSQLVector } from '../vector';
import { LibSQLStore } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Regression tests for mastra-ai/mastra#22328: a bare `:memory:` database was
 * silently replaced by a brand-new empty one the first time any storage
 * operation opened an interactive `transaction('write')` (e.g.
 * `updateWorkflowState`), so every subsequent read failed with
 * `SQLITE_ERROR: no such table: mastra_threads`.
 */
describe('LibSQLStore with a private :memory: database', () => {
  it('keeps all tables and data across interactive write transactions', async () => {
    const storage = new LibSQLStore({ id: 'memory-url-repro', url: ':memory:' });
    await storage.init();

    const memory = storage.stores.memory!;
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'repro',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const workflows = storage.stores.workflows!;
    await workflows.persistWorkflowSnapshot({
      workflowName: 'wf',
      runId: 'run-1',
      snapshot: {
        context: {},
        activePaths: [],
        serializedStepGraph: [],
        value: {},
        timestamp: Date.now(),
      } as any,
    });

    // First call in this sequence that opens an interactive transaction.
    await workflows.updateWorkflowState({ workflowName: 'wf', runId: 'run-1', opts: { status: 'success' } });

    const thread = await memory.getThreadById({ threadId: 'thread-1' });
    expect(thread?.id).toBe('thread-1');

    const snapshot = await workflows.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1' });
    expect(snapshot?.status).toBe('success');
  });

  it('keeps two :memory: stores isolated from each other', async () => {
    const first = new LibSQLStore({ id: 'memory-url-a', url: ':memory:' });
    const second = new LibSQLStore({ id: 'memory-url-b', url: ':memory:' });
    await first.init();
    await second.init();

    await first.stores.memory!.saveThread({
      thread: {
        id: 'thread-a',
        resourceId: 'resource-a',
        title: 'first store only',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    expect(await first.stores.memory!.getThreadById({ threadId: 'thread-a' })).not.toBeNull();
    expect(await second.stores.memory!.getThreadById({ threadId: 'thread-a' })).toBeNull();
  });
});

describe('LibSQLVector with a private :memory: database', () => {
  it('keeps indexes and data across interactive write transactions', async () => {
    const vector = new LibSQLVector({ id: 'memory-url-vector', url: ':memory:' });

    await vector.createIndex({ indexName: 'test_index', dimension: 3 });
    // upsert opens an interactive `transaction('write')`.
    await vector.upsert({ indexName: 'test_index', vectors: [[1, 0, 0]], ids: ['vec-1'] });

    const results = await vector.query({ indexName: 'test_index', queryVector: [1, 0, 0], topK: 1 });
    expect(results.map(r => r.id)).toEqual(['vec-1']);

    const stats = await vector.describeIndex({ indexName: 'test_index' });
    expect(stats.count).toBe(1);
  });
});
