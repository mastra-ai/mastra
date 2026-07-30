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
  it('keeps entity and page APIs separate with type-scoped uniqueness', async () => {
    const store = createStore();
    const entity = await store.createEntity({ name: 'Deploy', kind: 'task', scope: resource });
    const duplicate = await store.createEntity({ name: 'deploy', kind: 'event', scope: [...resource].reverse() });
    const page = await store.createPage({ name: 'Deploy', body: 'Runbook for [[Deploy]]', scope: resource });

    expect(duplicate.id).toBe(entity.id);
    expect(await store.getEntity(page.id)).toBeNull();
    expect(await store.getPage(entity.id)).toBeNull();
    expect(await store.listEntities({ scope: thread })).toEqual([expect.objectContaining({ id: entity.id })]);
    expect(await store.listPages({ scope: thread })).toEqual([expect.objectContaining({ id: page.id })]);
    await expect(store.createEntity({ name: 'bad', kind: 'page', scope: resource })).rejects.toThrow('reserved');
  });

  it('resolves names from narrow to broad scope without crossing siblings', async () => {
    const store = createStore();
    const broad = await store.createEntity({ name: 'Jane', kind: 'person', scope: org });
    const narrow = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
    const siblingOnly = await store.createEntity({ name: 'Marco', kind: 'person', scope: sibling });

    expect((await store.resolveEntity({ name: 'Jane', scope: thread }))?.id).toBe(narrow.id);
    expect((await store.resolveEntity({ name: 'Jane', scope: org }))?.id).toBe(broad.id);
    expect(await store.resolveEntity({ name: 'Marco', scope: thread })).toBeNull();
    expect(siblingOnly.scope).toEqual(sibling);
  });

  it('stamps provenance, derives mentions, and separates facts about from touching', async () => {
    const store = createStore();
    const jane = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
    const fact = await store.appendFact({
      parentEntityId: jane.id,
      text: 'Paired with [[Marco]] on [[deploy fix]].',
      scope: thread,
      sourceThreadId: 't1',
      when: new Date('2026-07-01'),
      maxScope: 'resource',
      resolutionScope: thread,
      defaultScope: resource,
    });
    const marco = await store.resolveEntity({ name: 'Marco', scope: thread });

    expect(fact.id).toHaveLength(26);
    expect(fact.capturedAt).toBeInstanceOf(Date);
    expect(fact.when?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect((await store.factsAbout({ entityId: jane.id, scope: thread })).facts).toHaveLength(1);
    expect((await store.factsAbout({ entityId: marco!.id, scope: thread })).facts).toHaveLength(0);
    expect((await store.factsTouching({ entityId: marco!.id, scope: thread })).facts[0]?.id).toBe(fact.id);
    expect((await store.factsTouching({ entityId: marco!.id, scope: sibling })).facts).toHaveLength(0);
  });

  it('does not expose facts through a scope that cannot see their parent entity', async () => {
    const store = createStore();
    const entity = await store.createEntity({ name: 'Resource Secret', kind: 'task', scope: resource });
    await store.appendFact({
      parentEntityId: entity.id,
      text: 'org-visible wording',
      scope: org,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    expect((await store.factsAbout({ entityId: entity.id, scope: org })).facts).toEqual([]);
    expect(await store.search({ query: 'org-visible', scope: org })).toEqual([]);
    expect((await store.factsAbout({ entityId: entity.id, scope: thread })).facts).toHaveLength(1);
  });

  it('soft deletes and restores facts without losing mention relationships', async () => {
    const store = createStore();
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

    const removed = await store.removeFact({ id: fact.id, deletedBy: 'curator' });
    expect(removed.deletedAt).toBeInstanceOf(Date);
    expect(await store.getFact({ id: fact.id })).toBeNull();
    expect(await store.getFact({ id: fact.id, includeDeleted: true })).toEqual(
      expect.objectContaining({ deletedBy: 'curator' }),
    );
    expect((await store.factsTouching({ entityId: marco.id, scope: thread })).facts).toHaveLength(0);

    await store.restoreFact({ id: fact.id });
    expect((await store.factsTouching({ entityId: marco.id, scope: thread })).facts[0]?.id).toBe(fact.id);
    expect((await store.listActivity({ scope: thread })).map(event => event.action)).toEqual(
      expect.arrayContaining(['fact-deleted', 'fact-restored']),
    );
  });

  it('enforces CAS, merge tombstones, and path-compressed reads', async () => {
    const store = createStore();
    const jane = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
    const duplicate = await store.createEntity({ name: 'Jane Doe', kind: 'person', scope: resource });
    const updated = await store.updateEntity({ id: jane.id, version: jane.version, kind: 'customer' });
    await expect(store.updateEntity({ id: jane.id, version: jane.version, kind: 'stale' })).rejects.toBeInstanceOf(
      KnowledgeConflictError,
    );

    const third = await store.createEntity({ name: 'J. Doe', kind: 'person', scope: resource });
    await store.mergeEntities({ sourceId: duplicate.id, targetId: jane.id, sourceVersion: duplicate.version });
    await store.mergeEntities({ sourceId: third.id, targetId: duplicate.id, sourceVersion: third.version });
    expect(await store.getEntity(duplicate.id)).toEqual(expect.objectContaining({ mergedInto: jane.id }));
    expect(await store.getEntity(third.id)).toEqual(expect.objectContaining({ mergedInto: jane.id }));
    expect((await store.resolveEntity({ name: updated.name, scope: thread }))?.kind).toBe('customer');
  });

  it('reindexes documents affected by merges and deletes the old semantic scope on rescope', async () => {
    const store = createStore();
    const target = await store.createEntity({ name: 'Jane', kind: 'person', scope: resource });
    const duplicate = await store.createEntity({ name: 'Jane Doe', kind: 'person', scope: resource });
    await store.createPage({ name: 'People', body: 'Contact [[Jane Doe]]', scope: resource });
    const parent = await store.createEntity({ name: 'Project', kind: 'task', scope: resource });
    const fact = await store.appendFact({
      parentEntityId: parent.id,
      text: 'Owned by [[Jane Doe]]',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
      maxScope: 'org',
    });
    const beforeMerge = (await store.listSemanticOutbox()).length;

    await store.mergeEntities({ sourceId: duplicate.id, targetId: target.id, sourceVersion: duplicate.version });

    const mergeEntries = (await store.listSemanticOutbox()).slice(beforeMerge);
    expect(mergeEntries.map(entry => entry.documentType)).toEqual(expect.arrayContaining(['page', 'fact', 'entity']));

    const beforeRescope = (await store.listSemanticOutbox()).length;
    await store.rescopeFact({ id: fact.id, scope: org });
    const rescopeEntries = (await store.listSemanticOutbox()).slice(beforeRescope);
    expect(rescopeEntries).toEqual([
      expect.objectContaining({ operation: 'delete', scope: resource }),
      expect.objectContaining({ operation: 'upsert', scope: org }),
    ]);
  });

  it('enforces ceilings and monotonic curation cursors', async () => {
    const store = createStore();
    const entity = await store.createEntity({ name: 'Secret', kind: 'task', scope: resource });
    const fact = await store.appendFact({
      parentEntityId: entity.id,
      text: 'Private detail',
      scope: resource,
      sourceThreadId: 't1',
      maxScope: 'resource',
      resolutionScope: thread,
      defaultScope: resource,
    });

    await expect(store.rescopeFact({ id: fact.id, scope: org })).rejects.toThrow('ceiling');
    await store.raiseCeiling({ id: fact.id, maxScope: 'org' });
    await expect(store.rescopeFact({ id: fact.id, scope: org })).resolves.toEqual(
      expect.objectContaining({ scope: org }),
    );

    await store.advanceCurationCursor({ sourceThreadId: 't1', agent: 'curate', lastFactId: fact.id });
    await expect(
      store.advanceCurationCursor({ sourceThreadId: 't1', agent: 'curate', lastFactId: '00000000000000000000000000' }),
    ).rejects.toThrow('cannot move backwards');
  });

  it('paginates facts newest-first and supports semantic outbox recovery', async () => {
    const store = createStore();
    const entity = await store.createEntity({ name: 'Deploy', kind: 'task', scope: resource });
    const first = await store.appendFact({
      id: '01J00000000000000000000000',
      parentEntityId: entity.id,
      text: 'first',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    const second = await store.appendFact({
      id: '01J00000000000000000000001',
      parentEntityId: entity.id,
      text: 'second',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });

    const pageOne = await store.factsAbout({ entityId: entity.id, scope: thread, limit: 1 });
    expect(pageOne.facts[0]?.id).toBe(second.id);
    expect(pageOne.nextCursor).toBe(second.id);
    expect(
      (await store.factsAbout({ entityId: entity.id, scope: thread, limit: 1, after: pageOne.nextCursor })).facts[0]
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
    const entity = await store.createEntity({ name: 'Deploy', kind: 'task', scope: resource });
    const fact = await store.appendFact({
      parentEntityId: entity.id,
      text: 'detail',
      scope: resource,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    await store.removeFact({ id: fact.id, deletedBy: 'curator' });
    const count = (await store.listSemanticOutbox()).length;
    await store.removeFact({ id: fact.id, deletedBy: 'curator' });
    expect(await store.listSemanticOutbox()).toHaveLength(count);
  });

  it('searches visible graph and page content while excluding deleted facts', async () => {
    const store = createStore();
    const entity = await store.createEntity({ name: 'Deploy', kind: 'task', scope: resource });
    const fact = await store.appendFact({
      parentEntityId: entity.id,
      text: 'Use the release checklist',
      scope: thread,
      sourceThreadId: 't1',
      resolutionScope: thread,
      defaultScope: resource,
    });
    await store.createPage({ name: 'Runbook', body: 'Release checklist details', scope: resource });

    expect((await store.search({ query: 'release', scope: thread })).map(result => result.type)).toEqual([
      'page',
      'fact',
    ]);
    await store.removeFact({ id: fact.id, deletedBy: 'curator' });
    expect((await store.search({ query: 'release', scope: thread })).map(result => result.type)).toEqual(['page']);
  });
});
