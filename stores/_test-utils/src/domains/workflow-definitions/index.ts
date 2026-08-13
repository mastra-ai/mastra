import { WorkflowDefinitionOwnershipConflictError } from '@mastra/core/storage';
import type { MastraStorage, WorkflowDefinitionsStorage } from '@mastra/core/storage';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

export interface WorkflowDefinitionsTestOptions {
  storage: MastraStorage;
}

const baseGraph = [
  {
    type: 'tool',
    id: 'echo-tool',
    toolId: 'echo-tool',
  },
] as any;

function baseInput(id = 'wf-1') {
  return {
    id,
    description: `workflow ${id}`,
    inputSchema: { type: 'object', properties: { name: { type: 'string' } } },
    outputSchema: { type: 'object', properties: { greeting: { type: 'string' } } },
    graph: baseGraph,
  };
}

export function createWorkflowDefinitionsTests({ storage }: WorkflowDefinitionsTestOptions) {
  // Optional domain: stores that have not implemented it skip rather than fail.
  const describeWorkflowDefinitions = storage.stores?.workflowDefinitions ? describe : describe.skip;

  describeWorkflowDefinitions('workflowDefinitions', () => {
    let store: WorkflowDefinitionsStorage;

    beforeAll(async () => {
      const s = await storage.getStore('workflowDefinitions');
      if (!s) {
        throw new Error('WorkflowDefinitions storage not found');
      }
      store = s;
    });

    beforeEach(async () => {
      await store.dangerouslyClearAll();
    });

    it('returns null for a missing workflow', async () => {
      expect(await store.get('missing')).toBeNull();
    });

    it('upserts and reads a workflow definition', async () => {
      const created = await store.upsert(baseInput('wf-1'));
      expect(created.id).toBe('wf-1');
      expect(created.status).toBe('active');
      expect(created.source).toBe('storage');
      expect(created.createdAt).toBeInstanceOf(Date);

      const fetched = await store.get('wf-1');
      expect(fetched?.id).toBe('wf-1');
      expect(fetched?.graph).toEqual(baseGraph);
      expect(fetched?.inputSchema).toEqual(baseInput('wf-1').inputSchema);
    });

    it('updates existing rows without losing createdAt', async () => {
      const created = await store.upsert(baseInput('wf-1'));
      await new Promise(r => setTimeout(r, 5));
      const updated = await store.upsert({ id: 'wf-1', description: 'renamed' });
      expect(updated.description).toBe('renamed');
      expect(updated.createdAt.getTime()).toBe(created.createdAt.getTime());
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it('rejects ownership transfer on existing rows', async () => {
      await store.upsert({ ...baseInput('wf-1'), authorId: 'author-1' });
      await expect(store.upsert({ id: 'wf-1', authorId: 'author-2' })).rejects.toBeInstanceOf(
        WorkflowDefinitionOwnershipConflictError,
      );
      const fetched = await store.get('wf-1');
      expect(fetched?.authorId).toBe('author-1');
    });

    it('allows the existing owner to update an owned row', async () => {
      await store.upsert({ ...baseInput('wf-1'), authorId: 'author-1' });
      const updated = await store.upsert({ id: 'wf-1', authorId: 'author-1', description: 'renamed' });

      expect(updated).toMatchObject({ authorId: 'author-1', description: 'renamed' });
    });

    it('does not let an author claim a legacy unowned row', async () => {
      await store.upsert(baseInput('wf-1'));

      await expect(store.upsert({ id: 'wf-1', authorId: 'author-1' })).rejects.toBeInstanceOf(
        WorkflowDefinitionOwnershipConflictError,
      );
      const stored = await store.get('wf-1');
      expect(stored?.authorId).toBeUndefined();
    });

    it('preserves unspecified columns across a partial upsert', async () => {
      await store.upsert({
        ...baseInput('wf-1'),
        metadata: { owner: 'me' },
        stateSchema: { type: 'object' },
        authorId: 'author-1',
      });
      const updated = await store.upsert({ id: 'wf-1', description: 'renamed' });
      expect(updated.description).toBe('renamed');
      expect(updated.metadata).toEqual({ owner: 'me' });
      expect(updated.stateSchema).toEqual({ type: 'object' });
      expect(updated.authorId).toBe('author-1');
      expect(updated.inputSchema).toEqual(baseInput('wf-1').inputSchema);
      expect(updated.graph).toEqual(baseGraph);
    });

    it('handles concurrent upserts of the same id without failing', async () => {
      // Both callers read "no row", so one insert loses the race; the loser
      // must fall back to updating instead of surfacing a key violation.
      const results = await Promise.all([
        store.upsert({ ...baseInput('wf-race'), description: 'first' }),
        store.upsert({ ...baseInput('wf-race'), description: 'second' }),
      ]);
      for (const result of results) {
        expect(result.id).toBe('wf-race');
        expect(['first', 'second']).toContain(result.description);
      }
      const all = await store.list();
      expect(all.total).toBe(1);
    });

    it('lets exactly one author win concurrent creation of the same id', async () => {
      const results = await Promise.allSettled([
        store.upsert({ ...baseInput('wf-owner-race'), authorId: 'author-1' }),
        store.upsert({ ...baseInput('wf-owner-race'), authorId: 'author-2' }),
      ]);

      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(result => result.status === 'rejected');
      expect(rejected).toMatchObject({ reason: expect.any(WorkflowDefinitionOwnershipConflictError) });

      const stored = await store.get('wf-owner-race');
      expect(['author-1', 'author-2']).toContain(stored?.authorId);
    });

    it('rejects creation when required fields are explicitly undefined', async () => {
      await expect(store.upsert({ ...baseInput('wf-1'), graph: undefined } as any)).rejects.toThrow(/graph/);
      expect(await store.get('wf-1')).toBeNull();
    });

    it('lists workflows and filters by status', async () => {
      await store.upsert(baseInput('wf-1'));
      await store.upsert(baseInput('wf-2'));
      const all = await store.list();
      expect(all.total).toBe(2);

      await store.upsert({ id: 'wf-2', status: 'archived' });
      const active = await store.list({ status: 'active' });
      expect(active.total).toBe(1);
      expect(active.definitions[0]?.id).toBe('wf-1');

      const archived = await store.list({ status: 'archived' });
      expect(archived.total).toBe(1);
      expect(archived.definitions[0]?.id).toBe('wf-2');
    });

    it('deletes a workflow definition', async () => {
      await store.upsert(baseInput('wf-1'));
      await expect(store.delete('wf-1')).resolves.toBe(true);
      expect(await store.get('wf-1')).toBeNull();
      await expect(store.delete('wf-1')).resolves.toBe(false);
    });

    it('atomically deletes only the expected owner', async () => {
      await store.upsert({ ...baseInput('wf-1'), authorId: 'author-1' });

      await expect(store.delete('wf-1', { authorId: 'author-2' })).resolves.toBe(false);
      await expect(store.get('wf-1')).resolves.toMatchObject({ authorId: 'author-1' });

      await expect(store.delete('wf-1', { authorId: 'author-1' })).resolves.toBe(true);
      await expect(store.get('wf-1')).resolves.toBeNull();
    });

    it('preserves optional metadata and schemas across round-trip', async () => {
      await store.upsert({
        ...baseInput('wf-1'),
        metadata: { owner: 'me' },
        stateSchema: { type: 'object' },
        requestContextSchema: { type: 'object' },
        authorId: 'author-1',
      });
      const fetched = await store.get('wf-1');
      expect(fetched?.metadata).toEqual({ owner: 'me' });
      expect(fetched?.stateSchema).toEqual({ type: 'object' });
      expect(fetched?.requestContextSchema).toEqual({ type: 'object' });
      expect(fetched?.authorId).toBe('author-1');
    });

    it('filters list by authorId', async () => {
      await store.upsert({ ...baseInput('wf-1'), authorId: 'author-1' });
      await store.upsert({ ...baseInput('wf-2'), authorId: 'author-2' });
      const byAuthor = await store.list({ authorId: 'author-1' });
      expect(byAuthor.total).toBe(1);
      expect(byAuthor.definitions[0]?.id).toBe('wf-1');
    });
  });
}
