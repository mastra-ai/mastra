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
  describe('workflowDefinitions', () => {
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
      await store.delete('wf-1');
      expect(await store.get('wf-1')).toBeNull();
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
