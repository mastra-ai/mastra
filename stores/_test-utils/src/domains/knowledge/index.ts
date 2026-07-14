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

    it('rejects merges whose target is narrower than the source alias', async () => {
      const broad = await store.createEntity({ name: 'Broad alias', kind: 'person', scope: ['org:acme'] });
      const narrow = await store.createEntity({ name: 'Narrow target', kind: 'person', scope: resource });
      await expect(
        store.mergeEntities({ sourceId: broad.id, targetId: narrow.id, sourceVersion: broad.version }),
      ).rejects.toThrow('target that is narrower');
    });

    it('repoints merge relationships and schedules old-scope semantic cleanup', async () => {
      const target = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
      const duplicate = await store.createEntity({ name: 'Jane Doe', kind: 'person', scope: resource });
      await store.createPage({ name: 'People', body: 'Contact [[Jane Doe]]', scope: resource });
      const project = await store.createEntity({ name: 'Project', kind: 'task', scope: resource });
      const fact = await store.appendFact({
        parentEntityId: project.id,
        text: 'Owned by [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
        maxScope: 'org',
      });
      const beforeMerge = (await store.listSemanticOutbox()).length;
      await store.mergeEntities({ sourceId: duplicate.id, targetId: target.id, sourceVersion: duplicate.version });
      expect((await store.listSemanticOutbox()).slice(beforeMerge).map(entry => entry.documentType)).toEqual(
        expect.arrayContaining(['page', 'fact', 'entity']),
      );
      const postMergeFact = await store.appendFact({
        parentEntityId: project.id,
        text: 'Still references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.factsTouching({ entityId: target.id, scope: thread })).facts.map(item => item.id)).toContain(
        postMergeFact.id,
      );
      expect((await store.createEntity({ name: 'Jane Doe', kind: 'person', scope: resource })).id).toBe(target.id);
      const fallbackFact = await store.appendFact({
        parentEntityId: project.id,
        text: 'Fallback references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: ['org:acme'],
        defaultScope: resource,
      });
      expect((await store.factsTouching({ entityId: target.id, scope: thread })).facts.map(item => item.id)).toContain(
        fallbackFact.id,
      );

      const beforeRescope = (await store.listSemanticOutbox()).length;
      await store.rescopeFact({ id: fact.id, scope: ['org:acme'] });
      expect((await store.listSemanticOutbox()).slice(beforeRescope)).toEqual([
        expect.objectContaining({ operation: 'delete', scope: resource }),
        expect.objectContaining({ operation: 'upsert', scope: ['org:acme'] }),
      ]);
    });

    it('deletes stale semantic scopes when records move', async () => {
      const entity = await store.createEntity({ name: 'Movable', kind: 'task', scope: resource });
      const fact = await store.appendFact({
        parentEntityId: entity.id,
        text: 'dependent fact',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      const page = await store.createPage({ name: 'Movable page', body: 'body', scope: resource });
      const before = (await store.listSemanticOutbox()).length;

      await store.updateEntity({ id: entity.id, version: entity.version, scope: ['org:acme'] });
      await store.updatePage({ id: page.id, version: page.version, scope: ['org:acme'] });

      const entries = (await store.listSemanticOutbox()).slice(before);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentId: `knowledge:entity:${entity.id}`,
            operation: 'delete',
            scope: resource,
          }),
          expect.objectContaining({
            documentId: `knowledge:entity:${entity.id}`,
            operation: 'upsert',
            scope: ['org:acme'],
          }),
          expect.objectContaining({ documentId: `knowledge:fact:${fact.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:fact:${fact.id}`, operation: 'upsert' }),
          expect.objectContaining({ documentId: `knowledge:page:${page.id}`, operation: 'delete', scope: resource }),
          expect.objectContaining({
            documentId: `knowledge:page:${page.id}`,
            operation: 'upsert',
            scope: ['org:acme'],
          }),
        ]),
      );
    });

    it('enforces record CAS and scope structure atomically', async () => {
      await expect(store.createEntity({ name: 'Invalid', kind: 'task', scope: ['thread:t1'] })).rejects.toThrow(
        'requires resource and org',
      );
      await expect(store.listEntities({ scope: ['thread:t1'] })).rejects.toThrow('requires resource and org');
      await expect(store.search({ query: 'anything', scope: ['resource:mastra'] })).rejects.toThrow('requires an org');
      const page = await store.createPage({ name: 'Guide', body: 'one', scope: resource });
      await store.updatePage({ id: page.id, version: page.version, body: 'two' });
      await expect(store.updatePage({ id: page.id, version: page.version, body: 'stale' })).rejects.toThrow(
        'version conflict',
      );

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
