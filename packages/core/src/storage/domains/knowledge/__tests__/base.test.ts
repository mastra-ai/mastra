import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import { createKnowledgeUlid, KnowledgeConflictError } from '../base';
import { InMemoryKnowledgeStorage } from '../inmemory';

const org = ['org:acme'];
const resource = ['org:acme', 'resource:mastra'];
const thread = ['org:acme', 'resource:mastra', 'thread:t1'];
const sibling = ['org:acme', 'resource:mastra', 'thread:t2'];

function createStore() {
  return new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
}

describe('InMemoryKnowledgeStorage', () => {
  it('keeps knowledge ULIDs monotonic when the clock moves backwards', () => {
    const first = createKnowledgeUlid(2);
    const second = createKnowledgeUlid(1);

    expect(second > first).toBe(true);
  });

  it('stores identity and optional content on one node type', async () => {
    const store = createStore();
    const node = await store.createNode({
      name: 'Deploy',
      kind: 'task',
      content: 'Runbook for [[Deploy]]',
      scope: resource,
      resolutionScope: thread,
    });
    const duplicate = await store.createNode({ name: 'deploy', kind: 'event', scope: [...resource].reverse() });

    expect(duplicate.id).toBe(node.id);
    expect(await store.getNode(node.id)).toEqual(expect.objectContaining({ content: 'Runbook for [[Deploy]]' }));
    expect(await store.listNodes({ scope: thread, hasContent: true })).toEqual([
      expect.objectContaining({ id: node.id }),
    ]);
    expect(await store.listNodes({ scope: thread, hasContent: false })).toEqual([]);
  });

  it('persists optional knowledge record metadata and returns it on reads', async () => {
    const store = createStore();
    const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const withMetadata = await store.appendKnowledge({
      node: jane,
      text: 'Prefers tabs.',
      scope: thread,
      sourceThreadId: 't1',
      metadata: { reason: 'Durable style preference stated explicitly.' },
      resolutionScope: thread,
      defaultScope: resource,
    });
    const withoutMetadata = await store.appendKnowledge({
      node: jane,
      text: 'Likes coffee.',
      scope: thread,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    expect(withMetadata.metadata).toEqual({ reason: 'Durable style preference stated explicitly.' });
    expect(withoutMetadata.metadata).toBeUndefined();
    expect((await store.getKnowledge({ id: withMetadata.id }))?.metadata).toEqual({
      reason: 'Durable style preference stated explicitly.',
    });
    expect((await store.getKnowledge({ id: withoutMetadata.id }))?.metadata).toBeUndefined();
  });

  it('rolls back node and record mutations when mention resolution fails', async () => {
    const store = createStore();
    const parent = await store.createNode({ name: 'Parent', kind: 'topic', scope: resource });
    const originalOutbox = await store.listSemanticOutbox();

    await expect(
      store.createNode({
        id: 'failed-node',
        name: 'Failed',
        kind: 'topic',
        content: 'Links to [[Nested]]',
        scope: resource,
        resolutionScope: [],
      }),
    ).rejects.toThrow('cannot be empty');
    expect(await store.getNode('failed-node')).toBeNull();
    expect(await store.resolveNode({ name: 'Nested', scope: resource })).toBeNull();

    await expect(
      store.updateNode({
        id: parent.id,
        version: parent.version,
        content: 'Links to [[Nested]]',
        resolutionScope: [],
      }),
    ).rejects.toThrow('cannot be empty');
    expect(await store.getNode(parent.id)).toEqual(parent);

    await expect(
      store.appendKnowledge({
        id: 'failed-record',
        node: parent,
        text: 'Links to [[Nested]]',
        scope: resource,
        sourceThreadId: 't1',
        resolutionScope: [],
        defaultScope: resource,
      }),
    ).rejects.toThrow('cannot be empty');
    expect(await store.getKnowledge({ id: 'failed-record' })).toBeNull();
    expect(await store.getNode(parent.id)).toEqual(parent);
    expect(await store.listSemanticOutbox()).toEqual(originalOutbox);
  });

  it('clones mutable search and semantic outbox values at the storage boundary', async () => {
    const store = createStore();
    await store.createNode({ name: 'Clone me', kind: 'topic', scope: resource });
    const searchResult = (await store.search({ query: 'clone', scope: resource }))[0]!;
    searchResult.scope.push('thread:mutated');
    expect((await store.search({ query: 'clone', scope: resource }))[0]?.scope).toEqual(resource);

    // Anchor to real time: pending outbox rows become available at insertion
    // time, so a fixed historical claim date would find nothing to claim.
    const now = new Date();
    const claimTime = new Date(now);
    const [claimed] = await store.claimSemanticOutbox({ workerId: 'worker', now, limit: 1 });
    now.setUTCFullYear(2030);
    claimed!.scope.push('thread:mutated');
    claimed!.claimedAt!.setUTCFullYear(2030);

    const [stored] = await store.listSemanticOutbox({ status: 'processing' });
    expect(stored).toEqual(
      expect.objectContaining({
        documentType: 'node',
        scope: resource,
        claimedAt: claimTime,
      }),
    );

    const retryAt = new Date(claimTime.getTime() + 24 * 60 * 60 * 1000);
    const retryTime = new Date(retryAt);
    await store.releaseSemanticOutbox({ ids: [claimed!.id], workerId: 'worker', retryAt });
    retryAt.setUTCFullYear(2030);
    expect((await store.listSemanticOutbox({ status: 'pending' }))[0]?.availableAt).toEqual(retryTime);
  });

  it('resolves names from narrow to broad scope without crossing siblings', async () => {
    const store = createStore();
    const broad = await store.createNode({ name: 'Jane', kind: 'person', scope: org });
    const narrow = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const siblingOnly = await store.createNode({ name: 'Marco', kind: 'person', scope: sibling });

    expect((await store.resolveNode({ name: 'Jane', scope: thread }))?.id).toBe(narrow.id);
    expect((await store.resolveNode({ name: 'Jane', scope: org }))?.id).toBe(broad.id);
    expect(await store.resolveNode({ name: 'Marco', scope: thread })).toBeNull();
    expect(siblingOnly.scope).toEqual(sibling);
  });

  it('stamps provenance, derives mentions, and separates knowledge about from touching', async () => {
    const store = createStore();
    const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const record = await store.appendKnowledge({
      node: { ...jane, scope: sibling },
      text: 'Paired with [[Marco]] on [[deploy fix]].',
      scope: thread,
      sourceThreadId: 't1',
      when: new Date('2026-07-01'),
      maxScope: 'resource',
      resolutionScope: thread,
      defaultScope: resource,
    });
    const marco = await store.resolveNode({ name: 'Marco', scope: thread });

    expect(record.id).toHaveLength(26);
    expect(record.capturedAt).toBeInstanceOf(Date);
    expect(record.when?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(record.node).toBe(jane.id);
    expect((await store.listKnowledgeAbout({ node: jane, scope: thread })).records).toHaveLength(1);
    expect((await store.listKnowledgeAbout({ node: marco!, scope: thread })).records).toHaveLength(0);
    expect((await store.listKnowledgeMentioning({ node: marco!, scope: thread })).records[0]?.id).toBe(record.id);
    expect((await store.listKnowledgeRelatedTo({ node: marco!, scope: thread })).records[0]?.id).toBe(record.id);
    expect((await store.listKnowledgeRelatedTo({ node: marco!, scope: sibling })).records).toHaveLength(0);
  });

  it('applies record visibility independently from node scope', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Resource Secret', kind: 'task', scope: resource });
    await store.appendKnowledge({
      node: node.id,
      text: 'org-visible wording',
      scope: org,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    expect((await store.listKnowledgeAbout({ node, scope: org })).records).toHaveLength(1);
    expect(await store.search({ query: 'org-visible', scope: org })).toEqual([
      expect.objectContaining({ type: 'record', recordId: node.id, scope: org }),
    ]);
    expect((await store.listKnowledgeAbout({ node, scope: thread })).records).toHaveLength(1);
  });

  it('soft deletes and restores knowledge without losing mention relationships', async () => {
    const store = createStore();
    const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const marco = await store.createNode({ name: 'Marco', kind: 'person', scope: resource });
    const record = await store.appendKnowledge({
      node: jane.id,
      text: 'Works with [[Marco]].',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    const removed = await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
    expect(removed.deletedAt).toBeInstanceOf(Date);
    expect(await store.getKnowledge({ id: record.id })).toBeNull();
    expect(await store.getKnowledge({ id: record.id, includeDeleted: true })).toEqual(
      expect.objectContaining({ deletedBy: 'curator' }),
    );
    expect((await store.listKnowledgeRelatedTo({ node: marco.id, scope: thread })).records).toHaveLength(0);

    await store.restoreKnowledge({ id: record.id });
    expect((await store.listKnowledgeRelatedTo({ node: marco.id, scope: thread })).records[0]?.id).toBe(record.id);
    const activity = await store.listActivity({ scope: thread, limit: 2 });
    expect(activity.map(event => event.action)).toEqual(expect.arrayContaining(['record-deleted', 'record-restored']));
    const olderActivity = await store.listActivity({ scope: thread, after: activity.at(-1)?.id, limit: 2 });
    expect(olderActivity).not.toHaveLength(0);
    expect(olderActivity.every(event => event.id < activity.at(-1)!.id)).toBe(true);
  });

  it('enforces CAS, merge tombstones, and path-compressed reads', async () => {
    const store = createStore();
    const jane = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const duplicate = await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource });
    const updated = await store.updateNode({ id: jane.id, version: jane.version, kind: 'customer' });
    await expect(store.updateNode({ id: jane.id, version: jane.version, kind: 'stale' })).rejects.toBeInstanceOf(
      KnowledgeConflictError,
    );

    const third = await store.createNode({ name: 'J. Doe', kind: 'person', scope: resource });
    await store.mergeNodes({ sourceId: duplicate.id, targetId: jane.id, sourceVersion: duplicate.version });
    await expect(
      store.mergeNodes({ sourceId: jane.id, targetId: duplicate.id, sourceVersion: updated.version }),
    ).rejects.toThrow('cycle');
    await store.mergeNodes({ sourceId: third.id, targetId: duplicate.id, sourceVersion: third.version });
    expect(await store.getNode(duplicate.id)).toEqual(expect.objectContaining({ mergedInto: jane.id }));
    expect(await store.getNode(third.id)).toEqual(expect.objectContaining({ mergedInto: jane.id }));
    expect((await store.resolveNode({ name: updated.name, scope: thread }))?.kind).toBe('customer');
  });

  it('reindexes documents affected by merges and deletes the old semantic scope on rescope', async () => {
    const store = createStore();
    const target = await store.createNode({ name: 'Jane', kind: 'person', scope: resource });
    const duplicate = await store.createNode({ name: 'Jane Doe', kind: 'person', scope: resource });
    await store.createNode({ kind: 'document', name: 'People', content: 'Contact [[Jane Doe]]', scope: resource });
    const parent = await store.createNode({ name: 'Project', kind: 'task', scope: resource });
    const record = await store.appendKnowledge({
      node: parent.id,
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
    expect(mergeEntries.map(entry => entry.documentType)).toEqual(expect.arrayContaining(['node', 'record', 'node']));

    const beforeRescope = (await store.listSemanticOutbox()).length;
    await store.rescopeKnowledge({ id: record.id, scope: org });
    const rescopeEntries = (await store.listSemanticOutbox()).slice(beforeRescope);
    expect(rescopeEntries).toEqual([
      expect.objectContaining({ operation: 'delete', scope: resource }),
      expect.objectContaining({ operation: 'upsert', scope: org }),
    ]);
  });

  it('serializes semantic work for successive versions of one document', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Atlas', kind: 'task', scope: resource });
    await store.updateNode({ id: node.id, version: node.version, kind: 'project' });

    const first = await store.claimSemanticOutbox({ workerId: 'first', limit: 10 });
    expect(first).toHaveLength(1);
    expect(await store.claimSemanticOutbox({ workerId: 'second', limit: 10 })).toEqual([]);
    await store.completeSemanticOutbox({ ids: [first[0]!.id], workerId: 'first' });
    expect(await store.claimSemanticOutbox({ workerId: 'second', limit: 10 })).toHaveLength(1);
  });

  it('enforces ceilings and monotonic curation cursors', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Secret', kind: 'task', scope: resource });
    const record = await store.appendKnowledge({
      node: node.id,
      text: 'Private detail',
      scope: resource,
      sourceThreadId: 't1',
      maxScope: 'resource',
      resolutionScope: thread,
      defaultScope: resource,
    });

    await expect(store.rescopeKnowledge({ id: record.id, scope: org })).rejects.toThrow('ceiling');
    await store.raiseKnowledgeCeiling({ id: record.id, maxScope: 'org' });
    await expect(store.raiseKnowledgeCeiling({ id: record.id, maxScope: 'resource' })).rejects.toThrow('lowered');
    await expect(store.rescopeKnowledge({ id: record.id, scope: org })).resolves.toEqual(
      expect.objectContaining({ scope: org }),
    );

    await store.advanceCurationCursor({ sourceThreadId: 't1', agent: 'curate', lastKnowledgeId: record.id });
    await expect(
      store.advanceCurationCursor({
        sourceThreadId: 't1',
        agent: 'curate',
        lastKnowledgeId: '00000000000000000000000000',
      }),
    ).rejects.toThrow('cannot move backwards');
  });

  it('paginates knowledge newest-first and supports semantic outbox recovery', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Deploy', kind: 'task', scope: resource });
    const first = await store.appendKnowledge({
      id: '01J00000000000000000000000',
      node: node.id,
      text: 'first',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    const second = await store.appendKnowledge({
      id: '01J00000000000000000000001',
      node: node.id,
      text: 'second',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    const nodeOne = await store.listKnowledgeAbout({ node: node.id, scope: thread, limit: 1 });
    expect(nodeOne.records[0]?.id).toBe(second.id);
    expect(nodeOne.nextCursor).toBe(second.id);
    expect(
      (await store.listKnowledgeAbout({ node: node.id, scope: thread, limit: 1, after: nodeOne.nextCursor })).records[0]
        ?.id,
    ).toBe(first.id);

    const sourcePage = await store.knowledgeBySource({ sourceThreadId: 't1', scope: thread, limit: 1 });
    expect(sourcePage).toMatchObject({ records: [{ id: first.id }], nextCursor: first.id });
    expect(
      (await store.knowledgeBySource({ sourceThreadId: 't1', scope: thread, after: sourcePage.nextCursor })).records,
    ).toEqual([expect.objectContaining({ id: second.id })]);

    const pending = await store.listSemanticOutbox({ status: 'pending' });
    const tooEarly = new Date(Math.min(...pending.map(entry => entry.availableAt.getTime())) - 1);
    expect(await store.claimSemanticOutbox({ workerId: 'one', limit: 1, now: tooEarly })).toHaveLength(0);
    const claimTime = new Date(Math.max(...pending.map(entry => entry.availableAt.getTime())) + 1);
    const claimedLater = await store.claimSemanticOutbox({ workerId: 'one', limit: 1, now: claimTime });
    expect(claimedLater[0]).toEqual(expect.objectContaining({ status: 'processing', attempts: 1 }));
    await store.releaseSemanticOutbox({ ids: [claimedLater[0]!.id], workerId: 'one', retryAt: claimTime });
    const reclaimed = await store.claimSemanticOutbox({ workerId: 'two', limit: 1, now: claimTime });
    expect(reclaimed[0]).toEqual(expect.objectContaining({ attempts: 2, claimedBy: 'two' }));
    const staleTime = new Date(claimTime.getTime() + 60_001);
    expect(
      (await store.claimSemanticOutbox({ workerId: 'three', limit: 1, now: staleTime, claimTimeoutMs: 60_000 }))[0],
    ).toEqual(expect.objectContaining({ attempts: 3, claimedBy: 'three' }));
  });

  it('keeps semantic outbox operations idempotent', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Deploy', kind: 'task', scope: resource });
    const record = await store.appendKnowledge({
      node: node.id,
      text: 'detail',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
    const count = (await store.listSemanticOutbox()).length;
    await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
    expect(await store.listSemanticOutbox()).toHaveLength(count);
  });

  it('searches visible graph and node content while excluding deleted knowledge', async () => {
    const store = createStore();
    const node = await store.createNode({ name: 'Deploy', kind: 'task', scope: resource });
    const record = await store.appendKnowledge({
      node: node.id,
      text: 'Use the release checklist',
      scope: thread,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    await store.createNode({
      kind: 'document',
      name: 'Runbook',
      content: 'Release checklist details',
      scope: resource,
    });

    expect((await store.search({ query: 'release', scope: thread })).map(result => result.type)).toEqual([
      'node',
      'record',
    ]);
    await store.removeKnowledge({ id: record.id, deletedBy: 'curator' });
    expect((await store.search({ query: 'release', scope: thread })).map(result => result.type)).toEqual(['node']);
  });

  describe('node descriptions', () => {
    it('creates nodes with and without a description', async () => {
      const store = createStore();
      const described = await store.createNode({
        name: 'Atlas',
        kind: 'project',
        description: 'CRM migration project.',
        scope: resource,
      });
      const bare = await store.createNode({ name: 'Bare', kind: 'topic', scope: resource });

      expect(described.description).toBe('CRM migration project.');
      expect((await store.getNode(described.id))?.description).toBe('CRM migration project.');
      expect(bare.description).toBeUndefined();
      expect((await store.getNode(bare.id))?.description).toBeUndefined();
    });

    it('updates set, preserve, and clear the description independently of content', async () => {
      const store = createStore();
      const node = await store.createNode({
        name: 'Atlas',
        kind: 'project',
        content: 'Long-form content stays put.',
        scope: resource,
      });

      const set = await store.updateNode({ id: node.id, version: node.version, description: 'Synopsis.' });
      expect(set.description).toBe('Synopsis.');
      expect(set.content).toBe('Long-form content stays put.');

      const contentOnly = await store.updateNode({ id: node.id, version: set.version, content: 'New content.' });
      expect(contentOnly.description).toBe('Synopsis.');
      expect(contentOnly.content).toBe('New content.');

      const cleared = await store.updateNode({ id: node.id, version: contentOnly.version, description: '' });
      expect(cleared.description).toBe('');
      expect(cleared.content).toBe('New content.');
    });

    it('rejects stale-version description updates', async () => {
      const store = createStore();
      const node = await store.createNode({ name: 'Atlas', kind: 'project', scope: resource });
      await store.updateNode({ id: node.id, version: node.version, description: 'First.' });

      await expect(store.updateNode({ id: node.id, version: node.version, description: 'Stale.' })).rejects.toThrow(
        KnowledgeConflictError,
      );
      expect((await store.getNode(node.id))?.description).toBe('First.');
    });

    it('applies the merge matrix for descriptions', async () => {
      const store = createStore();

      // target has description => target wins
      const t1 = await store.createNode({
        name: 'T1',
        kind: 'topic',
        description: 'Target synopsis.',
        scope: resource,
      });
      const s1 = await store.createNode({
        name: 'S1',
        kind: 'topic',
        description: 'Source synopsis.',
        scope: resource,
      });
      const m1 = await store.mergeNodes({ sourceId: s1.id, targetId: t1.id, sourceVersion: s1.version });
      expect(m1.description).toBe('Target synopsis.');
      expect(m1.version).toBe(t1.version);

      // target absent + source present => adopt source's, bump target version
      const t2 = await store.createNode({ name: 'T2', kind: 'topic', scope: resource });
      const s2 = await store.createNode({ name: 'S2', kind: 'topic', description: 'Only synopsis.', scope: resource });
      const outboxBefore = (await store.listSemanticOutbox()).length;
      const m2 = await store.mergeNodes({ sourceId: s2.id, targetId: t2.id, sourceVersion: s2.version });
      expect(m2.description).toBe('Only synopsis.');
      expect(m2.version).toBe(t2.version + 1);
      expect((await store.getNode(t2.id))?.description).toBe('Only synopsis.');
      const mergeEntries = (await store.listSemanticOutbox()).slice(outboxBefore);
      expect(mergeEntries.some(entry => entry.documentId.includes(t2.id) && entry.operation === 'upsert')).toBe(true);

      // both absent => stays absent
      const t3 = await store.createNode({ name: 'T3', kind: 'topic', scope: resource });
      const s3 = await store.createNode({ name: 'S3', kind: 'topic', scope: resource });
      const m3 = await store.mergeNodes({ sourceId: s3.id, targetId: t3.id, sourceVersion: s3.version });
      expect(m3.description).toBeUndefined();
      expect(m3.version).toBe(t3.version);

      // target explicitly cleared ('') => the clear wins; source synopsis is not resurrected
      const t4Seed = await store.createNode({ name: 'T4', kind: 'topic', description: 'Stale.', scope: resource });
      const t4 = await store.updateNode({ id: t4Seed.id, version: t4Seed.version, description: '' });
      const s4 = await store.createNode({ name: 'S4', kind: 'topic', description: 'Resurrected.', scope: resource });
      const m4 = await store.mergeNodes({ sourceId: s4.id, targetId: t4.id, sourceVersion: s4.version });
      expect(m4.description).toBe('');
      expect(m4.version).toBe(t4.version);
    });

    it('matches descriptions in lexical search and includes them in result text when present', async () => {
      const store = createStore();
      const described = await store.createNode({
        name: 'Atlas',
        kind: 'project',
        content: 'Runbook body.',
        description: 'Zephyr-class synopsis.',
        scope: resource,
      });
      await store.createNode({ name: 'Bareword', kind: 'topic', content: 'plain body', scope: resource });

      const byDescription = await store.search({ query: 'zephyr', scope: resource });
      expect(byDescription).toEqual([
        expect.objectContaining({ id: described.id, text: 'Atlas\nZephyr-class synopsis.\nRunbook body.' }),
      ]);

      // description-less result text is byte-identical to the pre-description format
      const bareResult = (await store.search({ query: 'bareword', scope: resource }))[0]!;
      expect(bareResult.text).toBe('Bareword\nplain body');
    });

    it('round-trips old nodes without a description as undefined', async () => {
      const store = createStore();
      const node = await store.createNode({ name: 'Legacy', kind: 'topic', content: 'body', scope: resource });
      const updated = await store.updateNode({ id: node.id, version: node.version, content: 'body 2' });
      expect(updated.description).toBeUndefined();
      expect((await store.getNode(node.id))?.description).toBeUndefined();
    });
  });
});
