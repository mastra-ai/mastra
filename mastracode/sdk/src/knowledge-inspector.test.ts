import type { AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { InMemoryDB, InMemoryKnowledgeStorage, InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createKnowledgeInspector, KnowledgeInspectorError } from './knowledge-inspector.js';
import type { MastraCodeState } from './schema.js';

const orgScope = ['org:owner-1'];
const resourceScope = ['org:owner-1', 'resource:project-1'];
const threadScope = ['org:owner-1', 'resource:project-1', 'thread:thread-1'];

function createSessionHarness() {
  let resourceId = 'project-1';
  let threadId: string | null = 'thread-1';
  const threadResources = new Map([
    ['thread-1', 'project-1'],
    ['thread-2', 'project-1'],
    ['foreign-thread', 'other-project'],
  ]);
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  const session = {
    identity: {
      getOwnerId: () => 'owner-1',
      getResourceId: () => resourceId,
    },
    thread: {
      getId: () => threadId,
      getById: async ({ threadId: requestedId }: { threadId: string }) => {
        const threadResourceId = threadResources.get(requestedId);
        return threadResourceId
          ? {
              id: requestedId,
              resourceId: threadResourceId,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
          : null;
      },
    },
    subscribe: (listener: (event: AgentControllerEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as Session<MastraCodeState>;

  return {
    session,
    setResourceId(value: string) {
      resourceId = value;
    },
    setThreadId(value: string | null) {
      threadId = value;
    },
    emit(event: AgentControllerEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

async function createHarness() {
  const knowledge = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
  const storage = new MastraCompositeStore({ id: 'knowledge-inspector-test', domains: { knowledge } });
  const session = createSessionHarness();
  const inspector = await createKnowledgeInspector({ storage, session: session.session });
  if (!inspector) throw new Error('Expected knowledge inspector');
  return { knowledge, storage, inspector, session };
}

describe('KnowledgeInspector', () => {
  let harness: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it('derives virtual scope roots and isolates ancestor, thread, and sibling records', async () => {
    await harness.knowledge.createEntity({ name: 'Org entity', kind: 'concept', scope: orgScope });
    await harness.knowledge.createEntity({ name: 'Resource entity', kind: 'project', scope: resourceScope });
    await harness.knowledge.createEntity({ name: 'Thread entity', kind: 'note', scope: threadScope });
    await harness.knowledge.createEntity({
      name: 'Sibling thread entity',
      kind: 'note',
      scope: ['org:owner-1', 'resource:project-1', 'thread:thread-2'],
    });
    await harness.knowledge.createEntity({
      name: 'Foreign entity',
      kind: 'secret',
      scope: ['org:owner-1', 'resource:other-project'],
    });

    const tree = await harness.inspector.getScopeTree();
    expect(tree).toMatchObject({
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: 'owner-1', available: true },
        { level: 'resource', id: 'project-1', available: true },
        { level: 'thread', id: 'thread-1', available: true },
      ],
    });
    expect(tree.identityKey).not.toContain('owner-1');

    await expect(harness.inspector.listEntities({ level: 'org' })).resolves.toMatchObject({
      items: [{ name: 'Org entity' }],
    });
    await expect(harness.inspector.listEntities({ level: 'resource' })).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ name: 'Org entity' }),
        expect.objectContaining({ name: 'Resource entity' }),
      ]),
    });
    const threadRecords = await harness.inspector.listEntities({ level: 'thread' });
    expect(threadRecords.items.map(item => item.name).sort()).toEqual([
      'Org entity',
      'Resource entity',
      'Thread entity',
    ]);
    expect(JSON.stringify(threadRecords)).not.toContain('Foreign entity');
    expect(JSON.stringify(threadRecords)).not.toContain('Sibling thread entity');
  });

  it('returns entity and page details through opaque handles with bounded relations and content', async () => {
    const related = await harness.knowledge.createEntity({ name: 'Related', kind: 'service', scope: resourceScope });
    const entity = await harness.knowledge.createEntity({ name: 'Atlas', kind: 'project', scope: resourceScope });
    await harness.knowledge.appendFact({
      parentEntityId: entity.id,
      text: 'Atlas deploys through [[Related]].',
      scope: resourceScope,
      sourceThreadId: 'thread-1',
      resolutionScope: resourceScope,
      defaultScope: resourceScope,
    });
    const page = await harness.knowledge.createPage({
      name: 'Atlas brief',
      body: `See [[Related]].\n${'x'.repeat(40 * 1024)}`,
      scope: resourceScope,
    });

    const listedEntities = await harness.inspector.listEntities({ level: 'resource' });
    const atlas = listedEntities.items.find(item => item.name === 'Atlas')!;
    expect(atlas.handle).not.toContain(entity.id);
    expect(atlas).not.toHaveProperty('id');

    const detail = await harness.inspector.getEntity({ handle: atlas.handle });
    expect(detail.facts).toEqual([
      expect.objectContaining({ text: 'Atlas deploys through [[Related]].', sourceThreadId: 'thread-1' }),
    ]);
    expect(detail.relatedEntities).toEqual([expect.objectContaining({ name: 'Related' })]);
    expect(JSON.stringify(detail)).not.toContain(entity.id);
    expect(JSON.stringify(detail)).not.toContain(related.id);

    const listedPages = await harness.inspector.listPages({ level: 'resource' });
    expect(listedPages.items).toHaveLength(1);
    expect(listedPages.items[0]).toMatchObject({ name: 'Atlas brief', type: 'page' });
    expect(listedEntities.items.every(item => item.type === 'entity')).toBe(true);

    const pageDetail = await harness.inspector.getPage({ handle: listedPages.items[0]!.handle });
    expect(pageDetail.bodyTruncated).toBe(true);
    expect(new TextEncoder().encode(pageDetail.body).byteLength).toBeLessThanOrEqual(32 * 1024);
    expect(pageDetail.links).toEqual([
      { label: 'Related', entity: expect.objectContaining({ name: 'Related', type: 'entity' }) },
    ]);
    expect(JSON.stringify(pageDetail)).not.toContain(page.id);
  });

  it('binds handles and cursors to the current identity, selected scope, and filters', async () => {
    await harness.knowledge.createEntity({ name: 'Alpha', kind: 'note', scope: resourceScope });
    await harness.knowledge.createEntity({ name: 'Beta', kind: 'note', scope: resourceScope });

    const firstPage = await harness.inspector.listEntities({ level: 'resource', kind: 'note', limit: 1 });
    expect(firstPage.nextCursor).toBeDefined();
    await expect(
      harness.inspector.listEntities({ level: 'resource', kind: 'other', cursor: firstPage.nextCursor, limit: 1 }),
    ).rejects.toMatchObject({ code: 'invalid-cursor' });
    await expect(
      harness.inspector.listEntities({ level: 'thread', kind: 'note', cursor: firstPage.nextCursor, limit: 1 }),
    ).rejects.toMatchObject({ code: 'invalid-cursor' });

    const secondPage = await harness.inspector.listEntities({
      level: 'resource',
      kind: 'note',
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.items[0]!.name).not.toBe(firstPage.items[0]!.name);

    harness.session.setThreadId('thread-2');
    harness.session.emit({ type: 'thread_changed', threadId: 'thread-2' } as AgentControllerEvent);
    await expect(harness.inspector.getEntity({ handle: firstPage.items[0]!.handle })).rejects.toMatchObject({
      code: 'invalid-handle',
    });

    harness.session.setThreadId('foreign-thread');
    const tree = await harness.inspector.getScopeTree();
    expect(tree.roots[2]).toMatchObject({ level: 'thread', available: false });
    await expect(harness.inspector.listEntities({ level: 'thread' })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rechecks direct-read visibility and enriches activity without exposing storage ids', async () => {
    const entity = await harness.knowledge.createEntity({ name: 'Mutable', kind: 'note', scope: resourceScope });
    const listed = await harness.inspector.listEntities({ level: 'resource' });
    const handle = listed.items.find(item => item.name === 'Mutable')!.handle;
    await harness.knowledge.updateEntity({
      id: entity.id,
      version: entity.version,
      scope: ['org:owner-1', 'resource:other-project'],
    });

    await expect(harness.inspector.getEntity({ handle })).rejects.toBeInstanceOf(KnowledgeInspectorError);
    await expect(harness.inspector.getEntity({ handle })).rejects.toMatchObject({ code: 'not-visible' });

    const privateEntity = await harness.knowledge.createEntity({
      name: 'Private entity',
      kind: 'note',
      scope: threadScope,
    });
    await harness.knowledge.appendFact({
      parentEntityId: privateEntity.id,
      text: 'Private fact with a broader activity scope.',
      scope: resourceScope,
      sourceThreadId: 'private-source-thread',
      resolutionScope: threadScope,
      defaultScope: resourceScope,
    });
    await harness.knowledge.createPage({ name: 'Visible page', body: 'Body', scope: resourceScope });
    const activity = await harness.inspector.listActivity({ level: 'resource' });
    expect(activity.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'page-created', record: expect.objectContaining({ name: 'Visible page' }) }),
      ]),
    );
    expect(JSON.stringify(activity)).not.toContain(entity.id);
    expect(JSON.stringify(activity)).not.toContain('Private entity');
    expect(JSON.stringify(activity)).not.toContain('private-source-thread');
  });

  it('rejects a response when the session scope changes during a storage read', async () => {
    await harness.knowledge.createEntity({ name: 'Delayed', kind: 'note', scope: resourceScope });
    const listEntities = harness.knowledge.listEntities.bind(harness.knowledge);
    let releaseRead!: () => void;
    const readBlocked = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    vi.spyOn(harness.knowledge, 'listEntities').mockImplementation(async input => {
      await readBlocked;
      return listEntities(input);
    });

    const pending = harness.inspector.listEntities({ level: 'resource' });
    await Promise.resolve();
    harness.session.setResourceId('other-project');
    releaseRead();

    await expect(pending).rejects.toMatchObject({ code: 'stale-handle' });
  });

  it('returns no capability when the composite has no knowledge domain', async () => {
    const storage = new MastraCompositeStore({
      id: 'without-knowledge',
      default: new InMemoryStore({ id: 'default-without-knowledge' }),
      domains: { knowledge: false },
    });
    await expect(
      createKnowledgeInspector({ storage, session: createSessionHarness().session }),
    ).resolves.toBeUndefined();
  });
});
