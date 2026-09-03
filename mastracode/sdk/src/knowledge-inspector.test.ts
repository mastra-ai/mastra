import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { InMemoryDB, InMemoryKnowledgeStorage, InMemoryStore, MastraCompositeStore } from '@mastra/core/storage';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createKnowledgeInspector, KnowledgeInspectorError } from './knowledge-inspector.js';
import { MACHINE_ID_FILE, localKnowledgeOrgId } from './knowledge-scope.js';
import type { MastraCodeState } from './schema.js';

// TUI/studio sessions curate under the machine org rung (see knowledge-scope.ts);
// the inspector must read the same rung. Isolated to a temp home so the test
// never touches the real machine id.
const TEST_HOME = mkdtempSync(path.join(tmpdir(), 'mastracode-inspector-'));
const knowledgeScope = { homeDir: TEST_HOME };
afterAll(() => rmSync(TEST_HOME, { recursive: true, force: true }));
const LOCAL_ORG = localKnowledgeOrgId(knowledgeScope);
const orgScope = [`org:${LOCAL_ORG}`];
const resourceScope = [...orgScope, 'resource:project-1'];
const threadScope = [...resourceScope, 'thread:thread-1'];

function createSessionHarness(initialState: Partial<MastraCodeState> = {}) {
  let state = initialState;
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
      getResourceId: () => resourceId,
    },
    state: {
      get: () => state,
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
    setState(value: Partial<MastraCodeState>) {
      state = value;
    },
    setThreadId(value: string | null) {
      threadId = value;
    },
    emit(event: AgentControllerEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

async function createHarness(state: Partial<MastraCodeState> = {}) {
  const knowledge = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
  const storage = new MastraCompositeStore({ id: 'knowledge-inspector-test', domains: { knowledge } });
  const session = createSessionHarness(state);
  const inspector = await createKnowledgeInspector({ storage, session: session.session, knowledgeScope });
  if (!inspector) throw new Error('Expected knowledge inspector');
  return { knowledge, storage, inspector, session };
}

describe('KnowledgeInspector', () => {
  let harness: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it('derives virtual scope roots and isolates ancestor, thread, and sibling records', async () => {
    await harness.knowledge.createNode({ name: 'Org node', kind: 'concept', scope: orgScope });
    await harness.knowledge.createNode({ name: 'Resource node', kind: 'project', scope: resourceScope });
    await harness.knowledge.createNode({ name: 'Thread node', kind: 'note', scope: threadScope });
    await harness.knowledge.createNode({
      name: 'Sibling thread node',
      kind: 'note',
      scope: [...resourceScope, 'thread:thread-2'],
    });
    await harness.knowledge.createNode({
      name: 'Foreign node',
      kind: 'secret',
      scope: [...orgScope, 'resource:other-project'],
    });

    const tree = await harness.inspector.getScopeTree();
    expect(tree).toMatchObject({
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: LOCAL_ORG, available: true },
        { level: 'resource', id: 'project-1', available: true },
        { level: 'thread', id: 'thread-1', available: true },
      ],
    });
    expect(tree.identityKey).not.toContain(LOCAL_ORG);

    await expect(harness.inspector.listNodes({ level: 'org' })).resolves.toMatchObject({
      nodes: [{ name: 'Org node' }],
    });
    await expect(harness.inspector.listNodes({ level: 'resource' })).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ name: 'Org node' }),
        expect.objectContaining({ name: 'Resource node' }),
      ]),
    });
    const threadRecords = await harness.inspector.listNodes({ level: 'thread' });
    expect(threadRecords.nodes.map(item => item.name).sort()).toEqual(['Org node', 'Resource node', 'Thread node']);
    expect(JSON.stringify(threadRecords)).not.toContain('Foreign node');
    expect(JSON.stringify(threadRecords)).not.toContain('Sibling thread node');
  });

  it('ranks a stable recent window by sampled graph degree and preserves exact recent order', async () => {
    const hub = await harness.knowledge.createNode({ name: 'Hub', kind: 'project', scope: resourceScope });
    await harness.knowledge.createNode({ name: 'Leaf A', kind: 'service', scope: resourceScope });
    await harness.knowledge.createNode({ name: 'Leaf B', kind: 'service', scope: resourceScope });
    await harness.knowledge.appendKnowledge({
      node: hub.id,
      text: 'Hub links [[Leaf A]] and [[Leaf B]].',
      scope: resourceScope,
      sourceThreadId: 'thread-1',
      resolutionScope: resourceScope,
      defaultScope: resourceScope,
    });

    const connected = await harness.inspector.listNodes({ level: 'resource', sort: 'connected', limit: 1 });
    expect(connected).toMatchObject({
      sort: 'connected',
      coverage: 'recent-window',
      nodes: [{ name: 'Hub', relationshipCounts: { records: 1, outgoing: 2, incoming: 0, sampled: false } }],
    });
    expect(connected.nextCursor).toBeDefined();
    const next = await harness.inspector.listNodes({
      level: 'resource',
      sort: 'connected',
      limit: 1,
      cursor: connected.nextCursor,
    });
    expect(next.nodes[0]?.name).not.toBe('Hub');

    const recent = await harness.inspector.listNodes({ level: 'resource', sort: 'recent', limit: 3 });
    expect(recent.coverage).toBe('exact');
    expect(recent.nodes).toHaveLength(3);
    expect(recent.nodes.every(item => item.relationshipCounts !== undefined)).toBe(true);
    expect(recent.nodes.find(item => item.name === 'Hub')?.relationshipCounts).toEqual({
      records: 1,
      outgoing: 2,
      incoming: 0,
      sampled: false,
    });
    expect(recent.nodes.find(item => item.name === 'Leaf A')?.relationshipCounts).toEqual({
      records: 1,
      outgoing: 0,
      incoming: 1,
      sampled: false,
    });
  });

  it('marks bounded outgoing and incoming relationship previews as partial', async () => {
    const source = await harness.knowledge.createNode({ name: 'Source', kind: 'project', scope: resourceScope });
    await harness.knowledge.createNode({ name: 'Target', kind: 'project', scope: resourceScope });
    const outgoingNames: string[] = [];
    for (let index = 0; index < 26; index++) {
      const name = `Outgoing ${index}`;
      outgoingNames.push(name);
      await harness.knowledge.createNode({ name, kind: 'service', scope: resourceScope });
      const parent = await harness.knowledge.createNode({
        name: `Parent ${index}`,
        kind: 'project',
        scope: resourceScope,
      });
      await harness.knowledge.appendKnowledge({
        node: parent.id,
        text: `Parent ${index} references [[Target]].`,
        scope: resourceScope,
        sourceThreadId: 'thread-1',
        resolutionScope: resourceScope,
        defaultScope: resourceScope,
      });
    }
    await harness.knowledge.appendKnowledge({
      node: source.id,
      text: outgoingNames.map(name => `[[${name}]]`).join(' '),
      scope: resourceScope,
      sourceThreadId: 'thread-1',
      resolutionScope: resourceScope,
      defaultScope: resourceScope,
    });

    const sourceList = await harness.inspector.listNodes({
      level: 'resource',
      sort: 'recent',
      namePrefix: 'Source',
    });
    const targetList = await harness.inspector.listNodes({
      level: 'resource',
      sort: 'recent',
      namePrefix: 'Target',
    });
    const sourceDetail = await harness.inspector.getNode({ handle: sourceList.nodes[0]!.handle });
    const targetDetail = await harness.inspector.getNode({ handle: targetList.nodes[0]!.handle });
    expect(sourceDetail.outgoingTargets).toMatchObject({ nodes: { length: 25 }, partial: true });
    expect(targetDetail.incomingParents).toMatchObject({ nodes: { length: 25 }, partial: true });
    expect(sourceList.nodes[0]?.relationshipCounts).toEqual({ records: 1, outgoing: 25, incoming: 0, sampled: true });
    expect(targetList.nodes[0]?.relationshipCounts).toEqual({ records: 26, outgoing: 0, incoming: 25, sampled: true });
    expect(sourceDetail.relationshipCounts).toEqual({ records: 1, outgoing: 25, incoming: 0, sampled: true });
    expect(targetDetail.relationshipCounts).toEqual({ records: 26, outgoing: 0, incoming: 25, sampled: true });
  });

  it('returns content-capable node details through opaque handles with bounded relations', async () => {
    const related = await harness.knowledge.createNode({ name: 'Related', kind: 'service', scope: resourceScope });
    const node = await harness.knowledge.createNode({ name: 'Atlas', kind: 'project', scope: resourceScope });
    const parent = await harness.knowledge.createNode({ name: 'Portfolio', kind: 'program', scope: resourceScope });
    await harness.knowledge.appendKnowledge({
      node: node.id,
      text: 'Atlas deploys through [[Related]].',
      scope: resourceScope,
      sourceThreadId: 'thread-1',
      resolutionScope: resourceScope,
      defaultScope: resourceScope,
    });
    await harness.knowledge.appendKnowledge({
      node: parent.id,
      text: 'Portfolio includes [[Atlas]].',
      scope: resourceScope,
      sourceThreadId: 'thread-1',
      resolutionScope: resourceScope,
      defaultScope: resourceScope,
    });
    const page = await harness.knowledge.createNode({
      name: 'Atlas brief',
      kind: 'document',
      content: `See [[Related]].\n${'x'.repeat(40 * 1024)}`,
      scope: resourceScope,
    });

    const listedEntities = await harness.inspector.listNodes({ level: 'resource' });
    const atlas = listedEntities.nodes.find(item => item.name === 'Atlas')!;
    expect(atlas.handle).not.toContain(node.id);
    expect(atlas).not.toHaveProperty('id');

    const detail = await harness.inspector.getNode({ handle: atlas.handle });
    expect(detail.records).toEqual([
      expect.objectContaining({ text: 'Atlas deploys through [[Related]].', sourceThreadId: 'thread-1' }),
    ]);
    expect(detail.outgoingTargets).toEqual({
      nodes: [expect.objectContaining({ name: 'Related' })],
      partial: false,
    });
    expect(detail.incomingParents).toEqual({
      nodes: [expect.objectContaining({ name: 'Portfolio' })],
      partial: false,
    });
    expect(detail.relationshipCounts).toEqual({ records: 2, outgoing: 1, incoming: 1, sampled: false });
    expect(detail.node.relationshipCounts).toEqual({ records: 2, outgoing: 1, incoming: 1, sampled: false });
    expect(JSON.stringify(detail)).not.toContain(node.id);
    expect(JSON.stringify(detail)).not.toContain(related.id);
    expect(JSON.stringify(detail)).not.toContain(parent.id);

    const contentNode = listedEntities.nodes.find(item => item.name === 'Atlas brief')!;
    expect(contentNode).toMatchObject({ name: 'Atlas brief', type: 'node', kind: 'document' });
    expect(listedEntities.nodes.every(item => item.type === 'node')).toBe(true);

    const contentDetail = await harness.inspector.getNode({ handle: contentNode.handle });
    expect(contentDetail.contentTruncated).toBe(true);
    expect(new TextEncoder().encode(contentDetail.content!).byteLength).toBeLessThanOrEqual(32 * 1024);
    expect(contentDetail.links).toEqual([
      { label: 'Related', node: expect.objectContaining({ name: 'Related', type: 'node' }) },
    ]);
    expect(contentDetail.outgoingTargets.nodes).toEqual([expect.objectContaining({ name: 'Related' })]);
    expect(JSON.stringify(contentDetail)).not.toContain(page.id);
  });

  it('binds handles and cursors to the current identity, selected scope, and filters', async () => {
    await harness.knowledge.createNode({ name: 'Alpha', kind: 'note', scope: resourceScope });
    await harness.knowledge.createNode({ name: 'Beta', kind: 'note', scope: resourceScope });

    const firstPage = await harness.inspector.listNodes({ level: 'resource', kind: 'note', limit: 1 });
    expect(firstPage.nextCursor).toBeDefined();
    await expect(
      harness.inspector.listNodes({ level: 'resource', kind: 'other', cursor: firstPage.nextCursor, limit: 1 }),
    ).rejects.toMatchObject({ code: 'invalid-cursor' });
    await expect(
      harness.inspector.listNodes({ level: 'thread', kind: 'note', cursor: firstPage.nextCursor, limit: 1 }),
    ).rejects.toMatchObject({ code: 'invalid-cursor' });

    const secondPage = await harness.inspector.listNodes({
      level: 'resource',
      kind: 'note',
      cursor: firstPage.nextCursor,
      limit: 1,
    });
    expect(secondPage.nodes[0]!.name).not.toBe(firstPage.nodes[0]!.name);

    harness.session.setThreadId('thread-2');
    harness.session.emit({ type: 'thread_changed', threadId: 'thread-2' } as AgentControllerEvent);
    await expect(harness.inspector.getNode({ handle: firstPage.nodes[0]!.handle })).rejects.toMatchObject({
      code: 'invalid-handle',
    });

    harness.session.setThreadId('foreign-thread');
    const tree = await harness.inspector.getScopeTree();
    expect(tree.roots[2]).toMatchObject({ level: 'thread', available: false });
    await expect(harness.inspector.listNodes({ level: 'thread' })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('rechecks direct-read visibility and enriches activity without exposing storage ids', async () => {
    const node = await harness.knowledge.createNode({ name: 'Mutable', kind: 'note', scope: resourceScope });
    const listed = await harness.inspector.listNodes({ level: 'resource' });
    const handle = listed.nodes.find(item => item.name === 'Mutable')!.handle;
    await harness.knowledge.updateNode({
      id: node.id,
      version: node.version,
      scope: [...orgScope, 'resource:other-project'],
    });

    await expect(harness.inspector.getNode({ handle })).rejects.toBeInstanceOf(KnowledgeInspectorError);
    await expect(harness.inspector.getNode({ handle })).rejects.toMatchObject({ code: 'not-visible' });

    const privateNode = await harness.knowledge.createNode({
      name: 'Private node',
      kind: 'note',
      scope: threadScope,
    });
    await harness.knowledge.appendKnowledge({
      node: privateNode.id,
      text: 'Private item with a broader activity scope.',
      scope: resourceScope,
      sourceThreadId: 'private-source-thread',
      resolutionScope: threadScope,
      defaultScope: resourceScope,
    });
    await harness.knowledge.createNode({
      name: 'Visible page',
      kind: 'document',
      content: 'Body',
      scope: resourceScope,
    });
    const activity = await harness.inspector.listActivity({ level: 'resource' });
    expect(activity.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'node-created', record: expect.objectContaining({ name: 'Visible page' }) }),
      ]),
    );
    expect(JSON.stringify(activity)).not.toContain(node.id);
    expect(JSON.stringify(activity)).not.toContain('Private node');
    expect(JSON.stringify(activity)).not.toContain('private-source-thread');
  });

  it('wraps activity pagination cursors from newest to oldest', async () => {
    for (let index = 0; index < 5; index++) {
      await harness.knowledge.createNode({ name: `Activity ${index}`, kind: 'note', scope: resourceScope });
    }

    const first = await harness.inspector.listActivity({ level: 'resource', limit: 2 });
    const second = await harness.inspector.listActivity({ level: 'resource', cursor: first.nextCursor, limit: 2 });
    const firstNames = first.events.map(item => item.record?.name);
    const secondNames = second.events.map(item => item.record?.name);

    expect(first.nextCursor).toBeTruthy();
    expect(secondNames).toHaveLength(2);
    expect(secondNames.some(name => firstNames.includes(name))).toBe(false);
    expect([...firstNames, ...secondNames]).toEqual(['Activity 4', 'Activity 3', 'Activity 2', 'Activity 1']);
  });

  it('rejects a response when the session scope changes during a storage read', async () => {
    await harness.knowledge.createNode({ name: 'Delayed', kind: 'note', scope: resourceScope });
    const listNodes = harness.knowledge.listNodes.bind(harness.knowledge);
    let releaseRead!: () => void;
    const readBlocked = new Promise<void>(resolve => {
      releaseRead = resolve;
    });
    vi.spyOn(harness.knowledge, 'listNodes').mockImplementation(async input => {
      await readBlocked;
      return listNodes(input);
    });

    const pending = harness.inspector.listNodes({ level: 'resource' });
    await Promise.resolve();
    harness.session.setResourceId('other-project');
    releaseRead();

    await expect(pending).rejects.toMatchObject({ code: 'stale-handle' });
  });

  it('reads the same org rung the subconscious writes instead of the session owner id', async () => {
    // Regression: the inspector keyed the org rung on the session owner id
    // (`mastracode-<hash>`), a scope nothing ever writes to, so /knowledge showed
    // nothing even though curation had populated `org:local`.
    await harness.knowledge.createNode({ name: 'Curated', kind: 'concept', scope: orgScope });
    await harness.knowledge.createNode({ name: 'Orphaned', kind: 'concept', scope: ['org:owner-1'] });

    await expect(harness.inspector.listNodes({ level: 'org' })).resolves.toMatchObject({
      nodes: [{ name: 'Curated' }],
    });
    await expect(harness.inspector.listNodes({ level: 'resource' })).resolves.toMatchObject({
      nodes: [{ name: 'Curated' }],
    });
  });

  it('anchors Factory sessions on the seeded org and project ids', async () => {
    const factory = await createHarness({ factoryOrgId: 'org-42', factoryProjectId: 'proj-7' });
    await factory.knowledge.createNode({ name: 'Org node', kind: 'concept', scope: ['org:org-42'] });
    await factory.knowledge.createNode({
      name: 'Project node',
      kind: 'project',
      scope: ['org:org-42', 'resource:proj-7'],
    });
    await factory.knowledge.createNode({ name: 'Local node', kind: 'concept', scope: orgScope });

    await expect(factory.inspector.getScopeTree()).resolves.toMatchObject({
      roots: expect.arrayContaining([
        { level: 'org', id: 'org-42', available: true },
        { level: 'resource', id: 'proj-7', available: true },
      ]),
    });
    await expect(factory.inspector.listNodes({ level: 'resource' })).resolves.toMatchObject({
      nodes: expect.arrayContaining([
        expect.objectContaining({ name: 'Org node' }),
        expect.objectContaining({ name: 'Project node' }),
      ]),
    });
    const names = (await factory.inspector.listNodes({ level: 'resource' })).nodes.map(node => node.name);
    expect(names).not.toContain('Local node');

    // The thread rung stays the raw thread id even though the resource rung is
    // the project id, matching how the memory package composes thread scopes.
    await factory.knowledge.createNode({
      name: 'Thread node',
      kind: 'note',
      scope: ['org:org-42', 'resource:proj-7', 'thread:thread-1'],
    });
    await expect(factory.inspector.listNodes({ level: 'thread' })).resolves.toMatchObject({
      nodes: expect.arrayContaining([expect.objectContaining({ name: 'Thread node' })]),
    });
  });

  it('rotates handles and cursors when the org is seeded mid-session', async () => {
    const factory = await createHarness({ factoryProjectId: 'proj-7', factoryOrgUnresolved: true });
    await expect(factory.inspector.listNodes({ level: 'org' })).rejects.toMatchObject({ code: 'unavailable' });

    factory.session.setState({ factoryProjectId: 'proj-7', factoryOrgId: 'org-42' });
    await factory.knowledge.createNode({ name: 'Seeded', kind: 'concept', scope: ['org:org-42'] });
    const first = await factory.inspector.listNodes({ level: 'org' });
    expect(first.nodes.map(node => node.name)).toEqual(['Seeded']);
    const handle = first.nodes[0]!.handle;
    await expect(factory.inspector.getNode({ handle })).resolves.toMatchObject({ node: { name: 'Seeded' } });

    factory.session.setState({ factoryProjectId: 'proj-7', factoryOrgId: 'org-99' });
    await expect(factory.inspector.getNode({ handle })).rejects.toMatchObject({ code: 'invalid-handle' });
    const second = await factory.inspector.listNodes({ level: 'org' });
    expect(second.identityKey).not.toBe(first.identityKey);
    expect(second.nodes).toEqual([]);
  });

  it('fails closed when a Factory-owned session has no resolved org', async () => {
    const factory = await createHarness({ factoryProjectId: 'proj-7', factoryOrgUnresolved: true });
    await expect(factory.inspector.getScopeTree()).rejects.toMatchObject({ code: 'unavailable' });
    await expect(factory.inspector.listNodes({ level: 'org' })).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('fails closed when the local machine id is unusable instead of reading a substitute org', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'mastracode-inspector-corrupt-'));
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'garbage\n');
    try {
      const knowledge = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
      const storage = new MastraCompositeStore({ id: 'knowledge-inspector-corrupt', domains: { knowledge } });
      const inspector = await createKnowledgeInspector({
        storage,
        session: createSessionHarness().session,
        knowledgeScope: { homeDir },
      });
      if (!inspector) throw new Error('Expected knowledge inspector');
      await expect(inspector.getScopeTree()).rejects.toMatchObject({
        code: 'unavailable',
        message: expect.stringContaining(file),
      });
      await expect(inspector.listNodes({ level: 'org' })).rejects.toMatchObject({ code: 'unavailable' });
      // Repairing the file is enough; nothing was cached from the failed resolution.
      writeFileSync(file, 'abcdef012345\n');
      const tree = await inspector.getScopeTree();
      expect(tree.roots).toContainEqual({ level: 'org', id: 'mastracode-abcdef012345', available: true });
    } finally {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('rejects before touching storage when the machine id cannot be created (EACCES)', async () => {
    const homeDir = mkdtempSync(path.join(tmpdir(), 'mastracode-inspector-eacces-'));
    const file = path.join(homeDir, '.mastracode', MACHINE_ID_FILE);
    const knowledge = new InMemoryKnowledgeStorage({ db: new InMemoryDB() });
    const storage = new MastraCompositeStore({ id: 'knowledge-inspector-eacces', domains: { knowledge } });
    const inspector = await createKnowledgeInspector({
      storage,
      session: createSessionHarness().session,
      knowledgeScope: { homeDir },
    });
    if (!inspector) throw new Error('Expected knowledge inspector');
    // Seed a record under a hostname-style org: nothing may read it, and no reads may happen at all.
    await knowledge.createNode({ scope: ['org:mastracode-temporary'], type: 'entity', name: 'leak' } as never);
    const reads = [
      'listNodes',
      'getNode',
      'getNodeByName',
      'resolveNode',
      'getKnowledge',
      'listKnowledgeAbout',
      'search',
      'listActivity',
    ]
      .filter(name => typeof (knowledge as never as Record<string, unknown>)[name] === 'function')
      .map(name => vi.spyOn(knowledge as never as Record<string, (...args: never[]) => unknown>, name));
    const mkdirSpy = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
      throw Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    });
    try {
      await expect(inspector.getScopeTree()).rejects.toMatchObject({
        code: 'unavailable',
        message: expect.stringContaining('EACCES'),
      });
      await expect(inspector.listNodes({ level: 'org' })).rejects.toMatchObject({ code: 'unavailable' });
      for (const spy of reads) expect(spy).not.toHaveBeenCalled();
      expect(fs.existsSync(file)).toBe(false);
    } finally {
      mkdirSpy.mockRestore();
      for (const spy of reads) spy.mockRestore();
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('returns no capability when the composite has no knowledge domain', async () => {
    const storage = new MastraCompositeStore({
      id: 'without-knowledge',
      default: new InMemoryStore({ id: 'default-without-knowledge' }),
      domains: { knowledge: false },
    });
    await expect(
      createKnowledgeInspector({ storage, session: createSessionHarness().session, knowledgeScope }),
    ).resolves.toBeUndefined();
  });
});
