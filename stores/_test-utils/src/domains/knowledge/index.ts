import type { KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

const resource = ['org:acme', 'resource:mastra'];
const thread = [...resource, 'thread:t1'];

export function createKnowledgeStorageTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('knowledge storage contract', () => {
    let store: KnowledgeStorage;

    beforeEach(async () => {
      store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
    });

    it('persists separate entity and page records', async () => {
      const entity = await store.createEntity({ name: 'Deploy', kind: 'task', scope: resource });
      const page = await store.createPage({ name: 'Deploy', body: 'See [[Deploy]]', scope: resource });
      expect(await store.getEntity(entity.id)).toEqual(expect.objectContaining({ type: 'entity', version: 1 }));
      expect(await store.getPage(page.id)).toEqual(expect.objectContaining({ type: 'page', version: 1 }));
      expect(await store.getEntity(page.id)).toBeNull();
    });

    it('maintains mentions and soft deletes without losing them', async () => {
      const jane = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
      const marco = await store.createEntity({ name: 'Marco', kind: 'person', scope: resource });
      const fact = await store.appendFact({
        parentEntityId: jane.id,
        text: 'Works with [[Marco]].',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.factsTouching({ entityId: marco.id, scope: thread })).facts[0]?.id).toBe(fact.id);
      await store.removeFact({ id: fact.id, deletedBy: 'curator' });
      expect(await store.getFact({ id: fact.id })).toBeNull();
      await store.restoreFact({ id: fact.id });
      expect((await store.factsTouching({ entityId: marco.id, scope: thread })).facts[0]?.id).toBe(fact.id);
    });

    it('enforces CAS and scope ceilings atomically', async () => {
      const entity = await store.createEntity({ name: 'Secret', kind: 'task', scope: resource });
      await store.updateEntity({ id: entity.id, version: entity.version, kind: 'project' });
      await expect(store.updateEntity({ id: entity.id, version: entity.version, kind: 'stale' })).rejects.toThrow(
        'version conflict',
      );
      const fact = await store.appendFact({
        parentEntityId: entity.id,
        text: 'private',
        scope: resource,
        sourceThreadId: 't1',
        maxScope: 'resource',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await expect(store.rescopeFact({ id: fact.id, scope: ['org:acme'] })).rejects.toThrow('ceiling');
    });

    it('dangerously clears every knowledge table', async () => {
      const entity = await store.createEntity({ name: 'Temporary', kind: 'task', scope: resource });
      await store.appendFact({
        parentEntityId: entity.id,
        text: 'temporary fact',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastFactId: '01J00000000000000000000000',
      });

      await store.dangerouslyClearAll();

      expect(await store.getEntity(entity.id)).toBeNull();
      expect(await store.listActivity({ scope: thread })).toEqual([]);
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toBeNull();
      expect(await store.listSemanticOutbox()).toEqual([]);
    });

    it('persists activity, cursors, and recoverable semantic work', async () => {
      const entity = await store.createEntity({ name: 'Release', kind: 'task', scope: resource });
      await store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastFactId: '01J00000000000000000000000',
      });
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toEqual(
        expect.objectContaining({ lastFactId: '01J00000000000000000000000' }),
      );
      expect((await store.listActivity({ scope: thread }))[0]).toEqual(
        expect.objectContaining({ recordId: entity.id }),
      );
      const pending = await store.listSemanticOutbox({ status: 'pending' });
      expect(pending).toHaveLength(1);
      const claimed = await store.claimSemanticOutbox({
        workerId: 'worker',
        now: new Date(pending[0]!.availableAt.getTime() + 1),
      });
      await store.releaseSemanticOutbox({ ids: [claimed[0]!.id], workerId: 'worker' });
      expect((await store.listSemanticOutbox({ status: 'pending' }))[0]?.attempts).toBe(1);
    });
  });
}
