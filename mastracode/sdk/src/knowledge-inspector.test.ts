import type { AgentScopeEntry } from '@mastra/core/agent';
import type { AgentControllerEvent, Session } from '@mastra/core/agent-controller';
import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import type { KnowledgePage, KnowledgeStorage } from '@mastra/core/storage';

import { beforeEach, describe, expect, it } from 'vitest';

import { createKnowledgeInspector, KnowledgeInspectorError } from './knowledge-inspector.js';
import { LOCAL_KNOWLEDGE_ORG_ID } from './knowledge-scope.js';
import type { MastraCodeState } from './schema.js';

// The built-in Knowledge (`knowledge: true`) writes under the fixed local org, which the host
// passes as its scope; the inspector must read the same scopes.
const LOCAL_HOST: AgentScopeEntry[] = [{ scope: `org:${LOCAL_KNOWLEDGE_ORG_ID}`, access: 'write' }];
const host = { author: 'host' };

const declarations = {
  ...knowledgeMemoryScopes(),
  'project:$projectId': { access: [{ principal: 'self' as const, role: 'editor' as const }] },
};

function createSessionHarness(initialState: Partial<MastraCodeState> = {}) {
  let state = initialState;
  let threadId: string | null = 'thread-1';
  const threadResources = new Map([
    ['thread-1', 'project-1'],
    ['thread-2', 'project-1'],
    ['foreign-thread', 'other-project'],
  ]);
  const listeners = new Set<(event: AgentControllerEvent) => void>();
  const session = {
    identity: { getResourceId: () => 'project-1' },
    state: { get: () => state },
    thread: {
      getId: () => threadId,
      getById: async ({ threadId: requestedId }: { threadId: string }) => {
        const resourceId = threadResources.get(requestedId);
        return resourceId ? { id: requestedId, resourceId, createdAt: new Date(), updatedAt: new Date() } : null;
      },
    },
    subscribe: (listener: (event: AgentControllerEvent) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } as unknown as Session<MastraCodeState>;

  return {
    session,
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

/** Seeds pages straight into the page store, the way the code agent's tools leave them. */
function seeder(store: KnowledgeStorage) {
  const scopes = new Map<string, KnowledgePage>();
  const scope = async (address: string, declaration: string, parent?: string) => {
    if (!scopes.has(address)) {
      const parentId = parent ? (await scopeOf(parent)).id : null;
      const { scope: page } = await store.materializeScope({
        address,
        declaration,
        name: address,
        parentId,
        provenance: host,
      });
      scopes.set(address, page);
    }
    return scopes.get(address)!;
  };
  const scopeOf = (address: string) => {
    const type = address.slice(0, address.indexOf(':'));
    if (type === 'org') return scope(address, 'org:$orgId');
    if (type === 'project') return scope(address, 'project:$projectId');
    if (type === 'resource') return scope(address, 'resource:$resourceId', `org:${LOCAL_KNOWLEDGE_ORG_ID}`);
    return scope(address, 'thread:$threadId', 'resource:project-1');
  };
  return {
    scopeOf,
    async page(address: string, name: string, body?: string) {
      return store.createPage({ parentId: (await scopeOf(address)).id, name, body, provenance: host });
    },
    async note(page: KnowledgePage, text: string, mentions: KnowledgePage[] = [], sourceThreadId = 'thread-1') {
      return store.addNote({
        pageId: page.id,
        text,
        stampScopeIds: [page.scopeId],
        mentions: mentions.map(mention => mention.id),
        provenance: { author: 'agent:code', sourceThreadId },
      });
    },
  };
}

async function createHarness(state: Partial<MastraCodeState> = {}, hostScopes: AgentScopeEntry[] = LOCAL_HOST) {
  const knowledge = new Knowledge({ storage: new InMemoryStore({ id: 'inspector' }), scopes: declarations });
  const store = await knowledge.getStorage();
  const session = createSessionHarness(state);
  const inspector = await createKnowledgeInspector({ knowledge, session: session.session, hostScopes });
  if (!inspector) throw new Error('Expected knowledge inspector');
  return { knowledge, store, seed: seeder(store), inspector, session };
}

const names = (list: { nodes: { name: string }[] }) => list.nodes.map(node => node.name).sort();

describe('KnowledgeInspector', () => {
  let harness: Awaited<ReturnType<typeof createHarness>>;

  beforeEach(async () => {
    harness = await createHarness();
  });

  it('reads each level with its principals and never shows sibling threads or other projects', async () => {
    await harness.seed.page('org:local', 'Org page');
    await harness.seed.page('resource:project-1', 'Resource page');
    await harness.seed.page('thread:thread-1', 'Thread page');
    await harness.seed.page('thread:thread-2', 'Sibling thread page');
    await harness.seed.page('resource:other-project', 'Foreign page');

    const tree = await harness.inspector.getScopeTree();
    expect(tree).toMatchObject({
      defaultLevel: 'resource',
      roots: [
        { level: 'org', id: 'org:local', available: true },
        { level: 'resource', id: 'project-1', available: true },
        { level: 'thread', id: 'thread-1', available: true },
      ],
    });

    expect(names(await harness.inspector.listNodes({ level: 'org' }))).toEqual(['Org page']);
    expect(names(await harness.inspector.listNodes({ level: 'resource' }))).toEqual(['Org page', 'Resource page']);
    const thread = await harness.inspector.listNodes({ level: 'thread' });
    expect(names(thread)).toEqual(['Org page', 'Resource page', 'Thread page']);
    expect(thread.nodes.find(node => node.name === 'Thread page')!.scope).toEqual({ level: 'thread', id: 'thread-1' });
    expect(JSON.stringify(thread)).not.toMatch(/Sibling thread page|Foreign page/);
  });

  it('opens a page with its notes, mentions both ways, body links and readable-only relations', async () => {
    const beta = await harness.seed.page('resource:project-1', 'Beta service');
    const atlas = await harness.seed.page(
      'resource:project-1',
      'Atlas launch',
      'Ships with [[Beta service]]. [[No such page 9fca]] stays unresolved.',
    );
    const secret = await harness.seed.page('resource:other-project', 'Foreign secret');
    await harness.seed.note(atlas, 'Atlas launch depends on [[Beta service]].', [beta]);
    await harness.seed.note(atlas, 'Atlas launch shares a vendor with [[Foreign secret]].', [secret]);
    await harness.seed.note(beta, 'Beta service is required by [[Atlas launch]].', [atlas]);

    const list = await harness.inspector.listNodes({ level: 'resource' });
    const handle = list.nodes.find(node => node.name === 'Atlas launch')!.handle;
    const detail = await harness.inspector.getNode({ handle });

    // The note mentioning an unreadable page is hidden, so only one note shows.
    expect(detail.records.map(note => note.text)).toEqual(['Atlas launch depends on [[Beta service]].']);
    expect(detail.records[0]).toMatchObject({
      scope: { level: 'resource', id: 'project-1' },
      sourceThreadId: 'thread-1',
    });
    expect(detail.mentioningRecords.map(note => note.text)).toEqual(['Beta service is required by [[Atlas launch]].']);
    expect(detail.outgoingTargets.nodes.map(node => node.name)).toEqual(['Beta service']);
    expect(detail.incomingParents.nodes.map(node => node.name)).toEqual(['Beta service']);
    expect(detail.content).toContain('Ships with [[Beta service]]');
    expect(detail.links.map(link => [link.label, link.node?.name])).toEqual([
      ['Beta service', 'Beta service'],
      ['No such page 9fca', undefined],
    ]);
    expect(detail.relationshipCounts).toEqual({ records: 2, outgoing: 1, incoming: 1, sampled: false });
    expect(JSON.stringify(detail)).not.toContain('Foreign secret');
  });

  it('gives each page a stable id, so same-named pages stay distinct and repeats match', async () => {
    const handbook = await harness.seed.page('resource:project-1', 'Handbook');
    const guide = await harness.seed.page('resource:project-1', 'Guide');
    const first = await harness.store.createPage({ parentId: handbook.id, name: 'Policy', provenance: host });
    const second = await harness.store.createPage({ parentId: guide.id, name: 'Policy', provenance: host });

    const listed = (await harness.inspector.listNodes({ level: 'resource' })).nodes.filter(n => n.name === 'Policy');
    expect(listed.map(node => node.id).sort()).toEqual([first.id, second.id].sort());
    const again = (await harness.inspector.listNodes({ level: 'resource' })).nodes.filter(n => n.name === 'Policy');
    expect(again.map(node => node.id).sort()).toEqual(listed.map(node => node.id).sort());
    expect(again.map(node => node.handle)).not.toEqual(listed.map(node => node.handle));
  });

  it('pages notes through opaque cursors', async () => {
    const page = await harness.seed.page('resource:project-1', 'Checkpoints');
    for (let index = 0; index < 5; index++) await harness.seed.note(page, `Checkpoint ${index + 1} is complete.`);
    const handle = (await harness.inspector.listNodes({ level: 'resource' })).nodes[0]!.handle;
    const first = await harness.inspector.getNode({ handle, recordLimit: 3 });
    expect(first.records).toHaveLength(3);
    expect(first.recordsNextCursor).toBeDefined();
    const second = await harness.inspector.getNode({ handle, recordLimit: 3, recordsCursor: first.recordsNextCursor });
    expect(second.records.map(note => note.text)).toEqual(['Checkpoint 4 is complete.', 'Checkpoint 5 is complete.']);
    expect(second.recordsNextCursor).toBeUndefined();
  });

  it('lists every page by name exactly, and ranks the first pages by links for the connected sort', async () => {
    const hub = await harness.seed.page('resource:project-1', 'Zeta hub');
    const leafA = await harness.seed.page('resource:project-1', 'Leaf A');
    const leafB = await harness.seed.page('resource:project-1', 'Leaf B');
    await harness.seed.page('resource:project-1', 'Alone');
    await harness.seed.note(hub, 'Zeta hub runs [[Leaf A]] and [[Leaf B]].', [leafA, leafB]);

    const first = await harness.inspector.listNodes({ level: 'resource', sort: 'name', limit: 2 });
    expect(first).toMatchObject({ coverage: 'exact', sort: 'name' });
    const second = await harness.inspector.listNodes({
      level: 'resource',
      sort: 'name',
      limit: 2,
      cursor: first.nextCursor,
    });
    expect([...first.nodes, ...second.nodes].map(node => node.name)).toEqual(['Alone', 'Leaf A', 'Leaf B', 'Zeta hub']);

    const connected = await harness.inspector.listNodes({ level: 'resource', sort: 'connected' });
    expect(connected.coverage).toBe('window');
    expect(connected.nodes[0]).toMatchObject({ name: 'Zeta hub', relationshipCounts: { outgoing: 2, incoming: 0 } });

    await expect(
      harness.inspector.listNodes({ level: 'resource', sort: 'connected', cursor: first.nextCursor }),
    ).rejects.toMatchObject({ code: 'invalid-cursor' });
  });

  it('filters by name prefix', async () => {
    await harness.seed.page('resource:project-1', 'Deploy policy');
    await harness.seed.page('resource:project-1', 'Release notes');
    expect(names(await harness.inspector.listNodes({ level: 'resource', namePrefix: 'Dep' }))).toEqual([
      'Deploy policy',
    ]);
  });

  it('binds handles to the session identity and rotates them when the thread changes', async () => {
    await harness.seed.page('thread:thread-1', 'Thread page');
    const handle = (await harness.inspector.listNodes({ level: 'thread' })).nodes[0]!.handle;
    await expect(harness.inspector.getNode({ handle })).resolves.toMatchObject({ node: { name: 'Thread page' } });

    harness.session.setThreadId('thread-2');
    harness.session.emit({ type: 'thread_changed', threadId: 'thread-2' } as AgentControllerEvent);
    await expect(harness.inspector.getNode({ handle })).rejects.toBeInstanceOf(KnowledgeInspectorError);
    expect(names(await harness.inspector.listNodes({ level: 'thread' }))).toEqual([]);
  });

  it('reports a page that became unreadable as not visible', async () => {
    const page = await harness.seed.page('resource:project-1', 'Moving page');
    const handle = (await harness.inspector.listNodes({ level: 'resource' })).nodes[0]!.handle;
    const foreign = await harness.seed.scopeOf('resource:other-project');
    await harness.store.movePage({
      id: page.id,
      expectedVersion: page.version,
      parentId: foreign.id,
      provenance: host,
    });
    await expect(harness.inspector.getNode({ handle })).rejects.toMatchObject({ code: 'not-visible' });
  });

  it('lists readable activity newest first with page summaries, and pages through it', async () => {
    const page = await harness.seed.page('resource:project-1', 'Runbook');
    await harness.seed.note(page, 'Runbook step one.');
    await harness.seed.page('resource:other-project', 'Foreign runbook');

    const first = await harness.inspector.listActivity({ level: 'resource', limit: 1 });
    expect(first.events).toEqual([
      expect.objectContaining({
        action: 'note-added',
        recordType: 'note',
        record: expect.objectContaining({ name: 'Runbook' }),
      }),
    ]);
    const rest = await harness.inspector.listActivity({ level: 'resource', cursor: first.nextCursor });
    expect(rest.events.map(event => event.action)).toContain('page-created');
    expect(JSON.stringify([first, rest])).not.toContain('Foreign runbook');
  });

  it('reads Factory sessions under their org and project, isolated from other projects', async () => {
    harness = await createHarness({ factoryOrgId: 'acme', factoryProjectId: 'p1' }, []);
    await harness.seed.page('org:acme', 'Acme handbook');
    await harness.seed.page('project:p1', 'P1 plan');
    await harness.seed.page('project:p2', 'P2 plan');
    await harness.seed.page('org:local', 'Local page');

    expect((await harness.inspector.getScopeTree()).roots[0]).toMatchObject({ id: 'org:acme + project:p1' });
    expect(names(await harness.inspector.listNodes({ level: 'org' }))).toEqual(['Acme handbook', 'P1 plan']);
  });

  it('fails closed when a Factory-owned session has no resolved org', async () => {
    harness = await createHarness({ factoryProjectId: 'p1' }, []);
    await expect(harness.inspector.getScopeTree()).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('is unavailable when the session holds a scope Knowledge does not declare', async () => {
    harness = await createHarness({}, [{ scope: 'team:x', access: 'write' }]);
    await expect(harness.inspector.listNodes({ level: 'org' })).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringContaining('team:x'),
    });
  });

  it('selects a registered Knowledge by key, refuses an unknown key, and needs a Knowledge runtime', async () => {
    const keyed = new Knowledge({ id: 'keyed', storage: new InMemoryStore({ id: 'keyed' }), scopes: declarations });
    const mastra = new Mastra({ knowledge: { keyed }, logger: false });
    const { session } = createSessionHarness();
    await seeder(await keyed.getStorage()).page('org:local', 'Keyed page');

    const inspector = await createKnowledgeInspector({ knowledge: 'keyed', mastra, session, hostScopes: LOCAL_HOST });
    expect(names(await inspector!.listNodes({ level: 'org' }))).toEqual(['Keyed page']);
    await expect(
      createKnowledgeInspector({ knowledge: 'missing', mastra, session, hostScopes: LOCAL_HOST }),
    ).rejects.toMatchObject({ code: 'unavailable' });
    await expect(createKnowledgeInspector({ session, hostScopes: LOCAL_HOST })).resolves.toBeUndefined();
  });
});
