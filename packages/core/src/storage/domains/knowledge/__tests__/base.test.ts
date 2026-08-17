import { describe, expect, it } from 'vitest';

import { InMemoryDB } from '../../inmemory-db';
import { KnowledgeConflictError } from '../base';
import { InMemoryKnowledgeStorage } from '../inmemory';

const org = ['org:acme'];
const resource = ['org:acme', 'resource:mastra'];
const thread = ['org:acme', 'resource:mastra', 'thread:t1'];
const sibling = ['org:acme', 'resource:mastra', 'thread:t2'];

function createStore() {
  return new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
}

describe('InMemoryKnowledgeStorage', () => {
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
    expect((await store.knowledgeAbout({ node: jane, scope: thread })).records).toHaveLength(1);
    expect((await store.knowledgeAbout({ node: marco!, scope: thread })).records).toHaveLength(0);
    expect((await store.knowledgeMentioning({ node: marco!, scope: thread })).records[0]?.id).toBe(record.id);
    expect((await store.knowledgeRelatedTo({ node: marco!, scope: thread })).records[0]?.id).toBe(record.id);
    expect((await store.knowledgeRelatedTo({ node: marco!, scope: sibling })).records).toHaveLength(0);
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

    expect((await store.knowledgeAbout({ node, scope: org })).records).toHaveLength(1);
    expect(await store.search({ query: 'org-visible', scope: org })).toEqual([
      expect.objectContaining({ type: 'record', recordId: node.id, scope: org }),
    ]);
    expect((await store.knowledgeAbout({ node, scope: thread })).records).toHaveLength(1);
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
    expect((await store.knowledgeRelatedTo({ node: marco.id, scope: thread })).records).toHaveLength(0);

    await store.restoreKnowledge({ id: record.id });
    expect((await store.knowledgeRelatedTo({ node: marco.id, scope: thread })).records[0]?.id).toBe(record.id);
    expect((await store.listActivity({ scope: thread })).map(event => event.action)).toEqual(
      expect.arrayContaining(['record-deleted', 'record-restored']),
    );
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

    const nodeOne = await store.knowledgeAbout({ node: node.id, scope: thread, limit: 1 });
    expect(nodeOne.records[0]?.id).toBe(second.id);
    expect(nodeOne.nextCursor).toBe(second.id);
    expect(
      (await store.knowledgeAbout({ node: node.id, scope: thread, limit: 1, after: nodeOne.nextCursor })).records[0]
        ?.id,
    ).toBe(first.id);

    const claimed = await store.claimSemanticOutbox({ workerId: 'one', limit: 1, now: new Date('2026-07-01') });
    expect(claimed).toHaveLength(0);
    const pending = await store.listSemanticOutbox({ status: 'pending' });
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
});
