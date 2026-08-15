import type { KnowledgeStorage } from '@mastra/core/storage';
import { createKnowledgeRecordCursor } from '@mastra/core/storage';
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

    it('persists one content-capable node record', async () => {
      const node = await store.createNode({
        name: 'Deploy',
        kind: 'task',
        content: 'See [[Deploy]]',
        scope: resource,
        resolutionScope: thread,
      });
      const duplicate = await store.createNode({ name: 'deploy', kind: 'other', scope: resource });

      expect(duplicate.id).toBe(node.id);
      expect(await store.getNode(node.id)).toEqual(
        expect.objectContaining({ type: 'node', version: 1, content: 'See [[Deploy]]' }),
      );
      expect(await store.listNodes({ scope: thread, hasContent: true })).toEqual([
        expect.objectContaining({ id: node.id }),
      ]);
    });

    it('treats scope identifiers literally when checking visibility', async () => {
      await store.createNode({ name: 'Percent secret', kind: 'secret', scope: ['org:acme%'] });
      await store.createNode({ name: 'Underscore secret', kind: 'secret', scope: ['org:acme_'] });

      expect(await store.listNodes({ scope: ['org:acmeX', 'resource:secret'] })).toEqual([]);
    });

    it('applies item visibility independently from parent node identity scope', async () => {
      const node = await store.createNode({ name: 'Resource node', kind: 'task', scope: resource });
      await store.appendItem({
        parentNodeId: node.id,
        text: 'organization-visible item',
        scope: ['org:acme'],
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });

      expect((await store.itemsAbout({ nodeId: node.id, scope: ['org:acme'] })).items).toHaveLength(1);
      expect(await store.search({ query: 'organization-visible', scope: ['org:acme'] })).toEqual([
        expect.objectContaining({ type: 'item', recordId: node.id, scope: ['org:acme'] }),
      ]);
    });

    it('reserves page kinds case-insensitively for page records', async () => {
      await expect(store.createEntity({ name: 'Not a page', kind: ' Page ', scope: resource })).rejects.toThrow(
        /reserved/,
      );
      const entity = await store.createEntity({ name: 'Entity', kind: 'task', scope: resource });
      await expect(store.updateEntity({ id: entity.id, version: entity.version, kind: '\tPAGE\n' })).rejects.toThrow(
        /reserved/,
      );
    });

    it('applies fact visibility independently from parent entity identity scope', async () => {
      const entity = await store.createEntity({ name: 'Resource entity', kind: 'task', scope: resource });
      await store.appendFact({
        parentEntityId: entity.id,
        text: 'organization-visible fact',
        scope: ['org:acme'],
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });

      expect((await store.factsAbout({ entityId: entity.id, scope: ['org:acme'] })).facts).toHaveLength(1);
      expect(await store.search({ query: 'organization-visible', scope: ['org:acme'] })).toEqual([
        expect.objectContaining({ type: 'fact', name: '(private entity)', scope: ['org:acme'] }),
      ]);
    });

    it('paginates entities and pages with opaque record cursors', async () => {
      await store.createEntity({ name: 'Atlas', kind: 'project', scope: resource });
      await store.createEntity({ name: 'Beacon', kind: 'project', scope: resource });
      await store.createPage({ name: 'Atlas page', body: 'A', scope: resource });
      await store.createPage({ name: 'Beacon page', body: 'B', scope: resource });

      const entityPage = await store.listEntities({ scope: thread, limit: 1 });
      const nextEntityPage = await store.listEntities({
        scope: thread,
        cursor: createKnowledgeRecordCursor(entityPage[0]!),
        limit: 1,
      });
      expect(nextEntityPage).toHaveLength(1);
      expect(nextEntityPage[0]!.id).not.toBe(entityPage[0]!.id);
      await expect(
        store.listEntities({ scope: thread, namePrefix: 'A', cursor: createKnowledgeRecordCursor(entityPage[0]!) }),
      ).rejects.toThrow(/active browse filters/);

      const pagePage = await store.listPages({ scope: thread, limit: 1 });
      const nextPagePage = await store.listPages({
        scope: thread,
        cursor: createKnowledgeRecordCursor(pagePage[0]!),
        limit: 1,
      });
      expect(nextPagePage).toHaveLength(1);
      expect(nextPagePage[0]!.id).not.toBe(pagePage[0]!.id);
    });

    it('maintains mentions and soft deletes without losing them', async () => {
      const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
      const marco = await store.createNode({ name: 'Marco', kind: 'person', scope: resource });
      const item = await store.appendItem({
        parentNodeId: jane.id,
        text: 'Works with [[Marco]].',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.itemsTouching({ nodeId: marco.id, scope: thread })).items[0]?.id).toBe(item.id);
      await store.removeItem({ id: item.id, deletedBy: 'curator' });
      expect(await store.getItem({ id: item.id })).toBeNull();
      await store.restoreItem({ id: item.id });
      expect((await store.itemsTouching({ nodeId: marco.id, scope: thread })).items[0]?.id).toBe(item.id);
    });

    it('rejects merges whose target is narrower than the source alias', async () => {
      const broad = await store.createNode({ name: 'Broad alias', kind: 'person', scope: ['org:acme'] });
      const narrow = await store.createNode({ name: 'Narrow target', kind: 'person', scope: resource });
      await expect(
        store.mergeNodes({ sourceId: broad.id, targetId: narrow.id, sourceVersion: broad.version }),
      ).rejects.toThrow('target that is narrower');
    });

    it('repoints merge relationships and schedules old-scope semantic cleanup', async () => {
      const target = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
      const duplicate = await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource });
      await store.createNode({ kind: 'document', name: 'People', content: 'Contact [[Jane Doe]]', scope: resource });
      const project = await store.createNode({ name: 'Project', kind: 'task', scope: resource });
      const item = await store.appendItem({
        parentNodeId: project.id,
        text: 'Owned by [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
        maxScope: 'org',
      });
      const beforeMerge = (await store.listSemanticOutbox()).length;
      await store.mergeNodes({ sourceId: duplicate.id, targetId: target.id, sourceVersion: duplicate.version });
      expect((await store.listSemanticOutbox()).slice(beforeMerge).map(entry => entry.documentType)).toEqual(
        expect.arrayContaining(['node', 'item', 'node']),
      );
      const postMergeItem = await store.appendItem({
        parentNodeId: project.id,
        text: 'Still references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.itemsTouching({ nodeId: target.id, scope: thread })).items.map(item => item.id)).toContain(
        postMergeItem.id,
      );
      expect((await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource })).id).toBe(target.id);
      const fallbackItem = await store.appendItem({
        parentNodeId: project.id,
        text: 'Fallback references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: ['org:acme'],
        defaultScope: resource,
      });
      expect((await store.itemsTouching({ nodeId: target.id, scope: thread })).items.map(item => item.id)).toContain(
        fallbackItem.id,
      );

      const beforeRescope = (await store.listSemanticOutbox()).length;
      await store.rescopeItem({ id: item.id, scope: ['org:acme'] });
      expect((await store.listSemanticOutbox()).slice(beforeRescope)).toEqual([
        expect.objectContaining({ operation: 'delete', scope: resource }),
        expect.objectContaining({ operation: 'upsert', scope: ['org:acme'] }),
      ]);
    });

    it('deletes stale semantic scopes when records move', async () => {
      const node = await store.createNode({ name: 'Movable', kind: 'task', content: 'body', scope: resource });
      const item = await store.appendItem({
        parentNodeId: node.id,
        text: 'dependent item',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      const before = (await store.listSemanticOutbox()).length;

      await store.updateNode({ id: node.id, version: node.version, scope: ['org:acme'] });

      const entries = (await store.listSemanticOutbox()).slice(before);
      expect(entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            documentId: `knowledge:node:${node.id}`,
            operation: 'delete',
            scope: resource,
          }),
          expect.objectContaining({
            documentId: `knowledge:node:${node.id}`,
            operation: 'upsert',
            scope: ['org:acme'],
          }),
          expect.objectContaining({ documentId: `knowledge:item:${item.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:item:${item.id}`, operation: 'upsert' }),
        ]),
      );
    });

    it('enforces record CAS and scope structure atomically', async () => {
      await expect(store.createNode({ name: 'Invalid', kind: 'task', scope: ['thread:t1'] })).rejects.toThrow(
        'requires resource and org',
      );
      await expect(store.listNodes({ scope: ['thread:t1'] })).rejects.toThrow('requires resource and org');
      await expect(store.search({ query: 'anything', scope: ['resource:mastra'] })).rejects.toThrow('requires an org');
      const guide = await store.createNode({ kind: 'document', name: 'Guide', content: 'one', scope: resource });
      await store.updateNode({ id: guide.id, version: guide.version, content: 'two' });
      await expect(store.updateNode({ id: guide.id, version: guide.version, content: 'stale' })).rejects.toThrow(
        'version conflict',
      );

      const node = await store.createNode({ name: 'Secret', kind: 'task', scope: resource });
      await store.updateNode({ id: node.id, version: node.version, kind: 'project' });
      await expect(store.updateNode({ id: node.id, version: node.version, kind: 'stale' })).rejects.toThrow(
        'version conflict',
      );
      const item = await store.appendItem({
        parentNodeId: node.id,
        text: 'private',
        scope: resource,
        sourceThreadId: 't1',
        maxScope: 'resource',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await expect(store.rescopeItem({ id: item.id, scope: ['org:acme'] })).rejects.toThrow('ceiling');
    });

    it('serializes semantic work for successive versions of the same document', async () => {
      const node = await store.createNode({ name: 'Atlas', kind: 'task', scope: resource });
      await store.updateNode({ id: node.id, version: node.version, kind: 'project' });

      const first = await store.claimSemanticOutbox({ workerId: 'first', limit: 10 });
      expect(first).toHaveLength(1);
      expect(first[0]?.documentId).toBe(`knowledge:node:${node.id}`);
      expect(await store.claimSemanticOutbox({ workerId: 'second', limit: 10 })).toEqual([]);

      await store.completeSemanticOutbox({ ids: [first[0]!.id], workerId: 'first' });
      const second = await store.claimSemanticOutbox({ workerId: 'second', limit: 10 });
      expect(second).toHaveLength(1);
      expect(second[0]?.documentId).toBe(first[0]?.documentId);
    });

    it('serializes semantic work for successive versions of the same document', async () => {
      const entity = await store.createEntity({ name: 'Atlas', kind: 'task', scope: resource });
      await store.updateEntity({ id: entity.id, version: entity.version, kind: 'project' });

      const first = await store.claimSemanticOutbox({ workerId: 'first', limit: 10 });
      expect(first).toHaveLength(1);
      expect(first[0]?.documentId).toBe(`knowledge:entity:${entity.id}`);
      expect(await store.claimSemanticOutbox({ workerId: 'second', limit: 10 })).toEqual([]);

      await store.completeSemanticOutbox({ ids: [first[0]!.id], workerId: 'first' });
      const second = await store.claimSemanticOutbox({ workerId: 'second', limit: 10 });
      expect(second).toHaveLength(1);
      expect(second[0]?.documentId).toBe(first[0]?.documentId);
    });

    it('dangerously clears every knowledge table', async () => {
      const node = await store.createNode({ name: 'Temporary', kind: 'task', scope: resource });
      await store.appendItem({
        parentNodeId: node.id,
        text: 'temporary item',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastItemId: '01J00000000000000000000000',
      });

      await store.dangerouslyClearAll();

      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.listActivity({ scope: thread })).toEqual([]);
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toBeNull();
      expect(await store.listSemanticOutbox()).toEqual([]);
    });

    it('paginates activity from newest to oldest without duplicates', async () => {
      await store.createEntity({ name: 'Activity one', kind: 'task', scope: resource });
      await store.createEntity({ name: 'Activity two', kind: 'task', scope: resource });
      await store.createEntity({ name: 'Activity three', kind: 'task', scope: resource });

      const all = await store.listActivity({ scope: thread });
      const first = await store.listActivity({ scope: thread, limit: 2 });
      const second = await store.listActivity({ scope: thread, after: first.at(-1)!.id, limit: 2 });

      expect(first.map(event => event.id)).toEqual(all.slice(0, 2).map(event => event.id));
      expect(second.map(event => event.id)).toEqual(all.slice(2).map(event => event.id));
    });

    it('persists activity, cursors, and recoverable semantic work', async () => {
      const node = await store.createNode({ name: 'Release', kind: 'task', scope: resource });
      await store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastItemId: '01J00000000000000000000000',
      });
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toEqual(
        expect.objectContaining({ lastItemId: '01J00000000000000000000000' }),
      );
      expect((await store.listActivity({ scope: thread }))[0]).toEqual(expect.objectContaining({ recordId: node.id }));
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
