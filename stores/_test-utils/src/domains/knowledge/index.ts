import type { KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgeConflictError, MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH } from '@mastra/core/storage';
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
      await expect(
        store.createNode({ name: 'Separator secret', kind: 'secret', scope: ['org:acme\u001fresource:secret'] }),
      ).rejects.toThrow('Invalid knowledge scope entry');
    });

    it('treats lexical query metacharacters literally', async () => {
      const percent = await store.createNode({
        name: 'Literal% node',
        kind: 'document',
        content: 'contains percent% text',
        scope: resource,
      });
      await store.createNode({ name: 'LiteralX node', kind: 'document', content: 'control text', scope: resource });
      const underscore = await store.createNode({
        name: 'Under_score node',
        kind: 'document',
        content: 'contains under_score text',
        scope: resource,
      });
      await store.createNode({ name: 'UnderXscore node', kind: 'document', content: 'control text', scope: resource });
      const escape = await store.createNode({
        name: 'Equal= node',
        kind: 'document',
        content: 'contains equal=sign text',
        scope: resource,
      });

      expect(await store.listNodes({ scope: resource, namePrefix: 'Literal%' })).toEqual([
        expect.objectContaining({ id: percent.id }),
      ]);
      expect(await store.search({ query: '%', scope: resource })).toEqual([
        expect.objectContaining({ id: percent.id }),
      ]);
      expect(await store.search({ query: '_', scope: resource })).toEqual([
        expect.objectContaining({ id: underscore.id }),
      ]);
      expect(await store.search({ query: '=', scope: resource })).toEqual([expect.objectContaining({ id: escape.id })]);
    });

    it('applies record visibility independently from node scope', async () => {
      const node = await store.createNode({ name: 'Resource node', kind: 'task', scope: resource });
      await store.appendKnowledge({
        node,
        text: 'organization-visible knowledge',
        scope: ['org:acme'],
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });

      expect((await store.listKnowledgeAbout({ node, scope: ['org:acme'] })).records).toHaveLength(1);
      expect(await store.search({ query: 'organization-visible', scope: ['org:acme'] })).toEqual([
        expect.objectContaining({ type: 'record', recordId: node.id, scope: ['org:acme'] }),
      ]);
    });

    it('persists optional KnowledgeRecord metadata and returns it on reads', async () => {
      const node = await store.createNode({ name: 'Jane meta', kind: 'person', scope: resource });
      const withMetadata = await store.appendKnowledge({
        node: node.id,
        text: 'Prefers tabs.',
        scope: resource,
        sourceThreadId: 't1',
        metadata: { reason: 'Durable style preference stated explicitly.' },
        resolutionScope: thread,
        defaultScope: resource,
      });
      const withoutMetadata = await store.appendKnowledge({
        node: node.id,
        text: 'Likes coffee.',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect(withMetadata.metadata).toEqual({ reason: 'Durable style preference stated explicitly.' });
      expect((await store.getKnowledge({ id: withMetadata.id }))?.metadata).toEqual({
        reason: 'Durable style preference stated explicitly.',
      });
      expect((await store.getKnowledge({ id: withoutMetadata.id }))?.metadata).toBeUndefined();
    });

    it('maintains mentions and soft deletes without losing them', async () => {
      const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
      const marco = await store.createNode({ name: 'Marco', kind: 'person', scope: resource });
      const record = await store.appendKnowledge({
        node: jane,
        text: 'Works with [[Marco]].',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect((await store.listKnowledgeMentioning({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
      expect((await store.listKnowledgeRelatedTo({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
      await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
      expect(await store.getKnowledge({ id: record.id })).toBeNull();
      await store.restoreKnowledge({ id: record.id });
      expect((await store.listKnowledgeRelatedTo({ node: marco, scope: thread })).records[0]?.id).toBe(record.id);
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
      const record = await store.appendKnowledge({
        node: project.id,
        text: 'Owned by [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
        maxScope: 'org',
      });
      const beforeMerge = (await store.listSemanticOutbox()).length;
      await store.mergeNodes({ sourceId: duplicate.id, targetId: target.id, sourceVersion: duplicate.version });
      const mergeEntries = (await store.listSemanticOutbox()).slice(beforeMerge);
      expect(mergeEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentId: `knowledge:node:${duplicate.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:node:${target.id}`, operation: 'upsert' }),
          expect.objectContaining({ documentType: 'record' }),
        ]),
      );
      const postMergeKnowledge = await store.appendKnowledge({
        node: project.id,
        text: 'Still references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      expect(
        (await store.listKnowledgeRelatedTo({ node: target.id, scope: thread })).records.map(record => record.id),
      ).toContain(postMergeKnowledge.id);
      expect((await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource })).id).toBe(target.id);
      const fallbackKnowledge = await store.appendKnowledge({
        node: project.id,
        text: 'Fallback references [[Jane Doe]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: ['org:acme'],
        defaultScope: resource,
      });
      expect(
        (await store.listKnowledgeRelatedTo({ node: target.id, scope: thread })).records.map(record => record.id),
      ).toContain(fallbackKnowledge.id);

      const beforeRescope = (await store.listSemanticOutbox()).length;
      await store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] });
      expect((await store.listSemanticOutbox()).slice(beforeRescope)).toEqual([
        expect.objectContaining({ operation: 'delete', scope: resource }),
        expect.objectContaining({ operation: 'upsert', scope: ['org:acme'] }),
      ]);
    });

    it('deletes stale semantic scopes when records move', async () => {
      const node = await store.createNode({ name: 'Movable', kind: 'task', content: 'body', scope: resource });
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'dependent record',
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
          expect.objectContaining({ documentId: `knowledge:record:${record.id}`, operation: 'delete' }),
          expect.objectContaining({ documentId: `knowledge:record:${record.id}`, operation: 'upsert' }),
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
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'private',
        scope: resource,
        sourceThreadId: 't1',
        maxScope: 'resource',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await expect(store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] })).rejects.toThrow('ceiling');
      await store.raiseKnowledgeCeiling({ id: record.id, maxScope: 'org' });
      await expect(store.raiseKnowledgeCeiling({ id: record.id, maxScope: 'resource' })).rejects.toThrow('lowered');
      await store.rescopeKnowledge({ id: record.id, scope: ['org:acme'] });
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

    it('persists description independently of content', async () => {
      const node = await store.createNode({
        name: 'Described',
        kind: 'task',
        content: 'long-form body',
        description: 'Short synopsis.',
        scope: resource,
      });
      expect((await store.getNode(node.id))?.description).toBe('Short synopsis.');

      const afterDescription = await store.updateNode({
        id: node.id,
        version: node.version,
        description: 'Updated synopsis.',
      });
      expect(afterDescription.description).toBe('Updated synopsis.');
      expect(afterDescription.content).toBe('long-form body');

      const afterContent = await store.updateNode({
        id: node.id,
        version: afterDescription.version,
        content: 'revised body',
      });
      expect(afterContent.description).toBe('Updated synopsis.');
      expect(afterContent.content).toBe('revised body');

      await expect(
        store.updateNode({ id: node.id, version: afterDescription.version, description: 'stale write' }),
      ).rejects.toThrow('version conflict');

      const cleared = await store.updateNode({ id: node.id, version: afterContent.version, description: '' });
      expect(cleared.description).toBe('');
    });

    it('enforces the description length bound on create and update alike', async () => {
      const atLimit = 'x'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH);
      const overLimit = 'x'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH + 1);

      const node = await store.createNode({ name: 'At limit', kind: 'task', description: atLimit, scope: resource });
      expect((await store.getNode(node.id))?.description).toBe(atLimit);

      await expect(
        store.createNode({ name: 'Over limit', kind: 'task', description: overLimit, scope: resource }),
      ).rejects.toThrow(`${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`);
      expect(await store.getNodeByName({ name: 'Over limit', scope: resource })).toBeNull();

      await expect(store.updateNode({ id: node.id, version: node.version, description: overLimit })).rejects.toThrow(
        `${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`,
      );

      // A rejected update leaves the node exactly as it was — no partial write, no version bump.
      const untouched = await store.getNode(node.id);
      expect(untouched?.description).toBe(atLimit);
      expect(untouched?.version).toBe(node.version);
    });

    it('counts the description bound in UTF-16 code units', async () => {
      // 200 astral characters are 400 UTF-16 code units: at the limit, not over it.
      const astralAtLimit = '😀'.repeat(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH / 2);
      expect(astralAtLimit.length).toBe(MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH);
      const node = await store.createNode({
        name: 'Astral',
        kind: 'task',
        description: astralAtLimit,
        scope: resource,
      });
      expect((await store.getNode(node.id))?.description).toBe(astralAtLimit);

      await expect(
        store.createNode({
          name: 'Astral over',
          kind: 'task',
          description: `${astralAtLimit}😀`,
          scope: resource,
        }),
      ).rejects.toThrow(`${MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH} UTF-16 code unit limit`);
    });

    it('round-trips a node without description as undefined', async () => {
      const node = await store.createNode({ name: 'Bare', kind: 'task', content: 'body', scope: resource });
      expect((await store.getNode(node.id))?.description).toBeUndefined();
    });

    it('applies the merge description matrix with target mutation', async () => {
      // target has description => target's wins
      const keepTarget = await store.createNode({
        name: 'Keep target',
        kind: 'person',
        description: 'target synopsis',
        scope: resource,
      });
      const keepSource = await store.createNode({
        name: 'Keep source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });
      const keepVersion = keepTarget.version;
      await store.mergeNodes({ sourceId: keepSource.id, targetId: keepTarget.id, sourceVersion: keepSource.version });
      const keptTarget = await store.getNode(keepTarget.id);
      expect(keptTarget?.description).toBe('target synopsis');
      expect(keptTarget?.version).toBe(keepVersion);

      // target absent + source present => adopt source's, bump target version, enqueue upsert
      const adoptTarget = await store.createNode({ name: 'Adopt target', kind: 'person', scope: resource });
      const adoptSource = await store.createNode({
        name: 'Adopt source',
        kind: 'person',
        description: 'adopted synopsis',
        scope: resource,
      });
      const beforeAdopt = (await store.listSemanticOutbox()).length;
      await store.mergeNodes({
        sourceId: adoptSource.id,
        targetId: adoptTarget.id,
        sourceVersion: adoptSource.version,
      });
      const adopted = await store.getNode(adoptTarget.id);
      expect(adopted?.description).toBe('adopted synopsis');
      expect(adopted?.version).toBe(adoptTarget.version + 1);
      expect((await store.listSemanticOutbox()).slice(beforeAdopt)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ documentId: `knowledge:node:${adoptTarget.id}`, operation: 'upsert' }),
        ]),
      );

      // both absent => stays absent
      const bareTarget = await store.createNode({ name: 'Bare target', kind: 'person', scope: resource });
      const bareSource = await store.createNode({ name: 'Bare source', kind: 'person', scope: resource });
      await store.mergeNodes({ sourceId: bareSource.id, targetId: bareTarget.id, sourceVersion: bareSource.version });
      expect((await store.getNode(bareTarget.id))?.description).toBeUndefined();

      // target explicitly cleared ('') => the clear wins; merge must not resurrect the source synopsis
      const clearedSeed = await store.createNode({
        name: 'Cleared target',
        kind: 'person',
        description: 'stale synopsis',
        scope: resource,
      });
      const clearedTarget = await store.updateNode({
        id: clearedSeed.id,
        version: clearedSeed.version,
        description: '',
      });
      const clearedSource = await store.createNode({
        name: 'Cleared source',
        kind: 'person',
        description: 'resurrected synopsis',
        scope: resource,
      });
      await store.mergeNodes({
        sourceId: clearedSource.id,
        targetId: clearedTarget.id,
        sourceVersion: clearedSource.version,
      });
      const cleared = await store.getNode(clearedTarget.id);
      expect(cleared?.description).toBe('');
      expect(cleared?.version).toBe(clearedTarget.version);
    });

    it('never lets merge adoption clobber a concurrent description write', async () => {
      const target = await store.createNode({ name: 'Race target', kind: 'person', scope: resource });
      const source = await store.createNode({
        name: 'Race source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });

      // Both writers start from the same observed target version. Adoption is conditional on that
      // version still holding, so exactly one of these can win — and whichever loses must not
      // silently overwrite the winner's value.
      const [mergeResult, concurrentResult] = await Promise.allSettled([
        store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version }),
        store.updateNode({ id: target.id, version: target.version, description: 'concurrent synopsis' }),
      ]);
      expect(mergeResult.status).toBe('fulfilled');

      const finalTarget = await store.getNode(target.id);
      if (concurrentResult.status === 'fulfilled') {
        expect(finalTarget?.description).toBe('concurrent synopsis');
      } else {
        expect(finalTarget?.description).toBe('source synopsis');
      }
      expect(finalTarget?.version).toBe(target.version + 1);
    });

    it('never lets merge adoption resurrect a synopsis over a concurrent explicit clear', async () => {
      const target = await store.createNode({ name: 'Clear race target', kind: 'person', scope: resource });
      const source = await store.createNode({
        name: 'Clear race source',
        kind: 'person',
        description: 'source synopsis',
        scope: resource,
      });

      // Same conditional-adoption race as above, except the competing writer clears the description
      // rather than replacing it. An empty string is a deliberate value, not an absence, so if the
      // clear wins the merge must not treat the target as description-less and adopt the source.
      // Which writer wins is adapter-specific — a store that serializes the merge transaction first
      // never reaches the clear branch — so the load-bearing assertion is the single version bump:
      // an adoption and a clear can never both commit.
      const [mergeResult, clearResult] = await Promise.allSettled([
        store.mergeNodes({ sourceId: source.id, targetId: target.id, sourceVersion: source.version }),
        store.updateNode({ id: target.id, version: target.version, description: '' }),
      ]);
      expect(mergeResult.status).toBe('fulfilled');

      const finalTarget = await store.getNode(target.id);
      if (clearResult.status === 'fulfilled') {
        expect(finalTarget?.description).toBe('');
      } else {
        // The clear may only lose to a version conflict; an adapter that rejected the empty string
        // outright would otherwise land here and pass while breaking the ''-is-a-value contract.
        expect(clearResult.reason).toBeInstanceOf(KnowledgeConflictError);
        expect(finalTarget?.description).toBe('source synopsis');
      }
      expect(finalTarget?.version).toBe(target.version + 1);
    });

    it('matches descriptions in lexical search and keeps description-less text unchanged', async () => {
      const described = await store.createNode({
        name: 'Search described',
        kind: 'task',
        content: 'plain body',
        description: 'findable zebra synopsis',
        scope: resource,
      });
      const plain = await store.createNode({
        name: 'Search plain',
        kind: 'task',
        content: 'ordinary body',
        scope: resource,
      });

      const byDescription = await store.search({ query: 'zebra', scope: resource });
      expect(byDescription).toEqual([expect.objectContaining({ id: described.id })]);
      expect(byDescription[0]?.text).toBe('Search described\nfindable zebra synopsis\nplain body');

      const byContent = await store.search({ query: 'ordinary', scope: resource });
      expect(byContent).toEqual([expect.objectContaining({ id: plain.id })]);
      // description-less result text is byte-identical to the pre-description shape
      expect(byContent[0]?.text).toBe('Search plain\nordinary body');
    });

    it('dangerously clears every knowledge table', async () => {
      const node = await store.createNode({ name: 'Temporary', kind: 'task', scope: resource });
      const record = await store.appendKnowledge({
        node: node.id,
        text: 'temporary record',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: thread,
        defaultScope: resource,
      });
      await store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastKnowledgeId: '01J00000000000000000000000',
      });

      await store.dangerouslyClearAll();

      expect(await store.getNode(node.id)).toBeNull();
      expect(await store.getKnowledge({ id: record.id, includeDeleted: true })).toBeNull();
      expect(await store.listActivity({ scope: thread })).toEqual([]);
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toBeNull();
      expect(await store.listSemanticOutbox()).toEqual([]);
    });

    it('paginates activity from newest to oldest without duplicates', async () => {
      await store.createNode({ name: 'Activity one', kind: 'task', scope: resource });
      await store.createNode({ name: 'Activity two', kind: 'task', scope: resource });
      await store.createNode({ name: 'Activity three', kind: 'task', scope: resource });

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
        lastKnowledgeId: '01J00000000000000000000000',
      });
      expect(await store.getCurationCursor({ sourceThreadId: 't1', agent: 'curate' })).toEqual(
        expect.objectContaining({ lastKnowledgeId: '01J00000000000000000000000' }),
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
