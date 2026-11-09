import { Knowledge } from '@mastra/core/knowledge';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { KnowledgeRoutes } from './knowledge.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';
const host = { author: 'host' };

/** Factory-style declarations: an org, its projects, and private session threads under a project. */
const scopes = {
  'org:$orgId': { access: [{ principal: 'self' as const, role: 'editor' as const }] },
  'project:$projectId': { access: [{ principal: 'self' as const, role: 'editor' as const }], belongsTo: 'org:$orgId' },
  'thread:$threadId': {
    access: [{ principal: 'self' as const, role: 'owner' as const }],
    belongsTo: 'project:$projectId',
  },
};

/**
 * org-1 ─┬─ Handbook
 *        ├─ project P ─ Deploy runbook (a note mentions Handbook) · thread T ─ Session scratch
 *        └─ project Q ─ Q secret
 * org-2 ─ Other org notes
 */
async function createHarness(
  options: {
    user?: { workosId: string; organizationId?: string } | null;
    declarations?: ConstructorParameters<typeof Knowledge>[0]['scopes'];
  } = {},
) {
  const factory = await createFactoryStorageForTests();
  const project = await factory.projects.create({ orgId: ORG, userId: 'user-1', input: { name: 'P' } });
  const other = await factory.projects.create({ orgId: ORG, userId: 'user-1', input: { name: 'Q' } });
  const foreign = await factory.projects.create({ orgId: OTHER_ORG, userId: 'user-2', input: { name: 'X' } });

  const knowledge = new Knowledge({
    id: 'knowledge',
    storage: new InMemoryStore(),
    scopes: options.declarations ?? scopes,
  });
  const store: KnowledgeStorage = await knowledge.getStorage();
  const scope = async (address: string, declaration: string, name: string, parentId?: string) =>
    (await store.materializeScope({ address, declaration, name, provenance: host, ...(parentId ? { parentId } : {}) }))
      .scope;
  const org = await scope(`org:${ORG}`, 'org:$orgId', 'Org one');
  const p = await scope(`project:${project.id}`, 'project:$projectId', 'Project P', org.id);
  const q = await scope(`project:${other.id}`, 'project:$projectId', 'Project Q', org.id);
  const thread = await scope('thread:t-1', 'thread:$threadId', 'Session T', p.id);
  const otherOrg = await scope(`org:${OTHER_ORG}`, 'org:$orgId', 'Org two');
  const handbook = await store.createPage({ parentId: org.id, name: 'Handbook', provenance: host });
  const runbook = await store.createPage({ parentId: p.id, name: 'Deploy runbook', provenance: host });
  await store.createPage({ parentId: q.id, name: 'Q secret', provenance: host });
  await store.createPage({ parentId: thread.id, name: 'Session scratch', provenance: host });
  await store.createPage({ parentId: otherOrg.id, name: 'Other org notes', provenance: host });
  await store.addNote({
    pageId: runbook.id,
    text: 'Follow the [[Handbook]] before deploying',
    stampScopeIds: [p.id],
    mentions: [handbook.id],
    provenance: { author: 'agent:alex' },
  });

  const app = new Hono();
  const user = options.user === undefined ? { workosId: 'user-1', organizationId: ORG } : options.user;
  app.use('*', async (context, next) => {
    if (user) context.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new KnowledgeRoutes({
      auth: fakeRouteAuth(),
      projects: factory.projects,
      knowledge: async () => knowledge,
    }).routes(),
  );
  const get = async (path: string, projectId = project.id) => {
    const response = await app.request(`/web/factory/projects/${projectId}/knowledge${path}`);
    return { status: response.status, body: (await response.json()) as any };
  };
  return {
    get,
    app,
    store,
    handbook,
    projectId: project.id,
    otherProjectId: other.id,
    foreignProjectId: foreign.id,
    org,
    p,
    q,
    thread,
    runbook,
  };
}

const names = (pages: Array<{ name: string }>) => pages.map(page => page.name).sort();

describe('Factory Knowledge routes on the page store', () => {
  it("labels scope pages with their declaration's displayLabel, filling in the address's params", async () => {
    const h = await createHarness({
      declarations: {
        ...scopes,
        'org:$orgId': { ...scopes['org:$orgId'], displayLabel: 'Organization $orgId' },
        'project:$projectId': { ...scopes['project:$projectId'], displayLabel: 'Project' },
      },
    });
    const labels = (pages: Array<{ name: string; displayLabel?: string }>) =>
      pages.map(page => [page.name, page.displayLabel]).sort();
    expect(labels((await h.get('/graph')).body.pages)).toEqual([
      ['Deploy runbook', undefined],
      ['Handbook', undefined],
      ['Org one', `Organization ${ORG}`],
      ['Project P', 'Project'],
    ]);
    expect(labels((await h.get('/tree')).body.pages)).toEqual([['Org one', `Organization ${ORG}`]]);
    const page = await h.get(`/pages/${h.runbook.id}`);
    expect(labels(page.body.ancestors)).toEqual([
      ['Org one', `Organization ${ORG}`],
      ['Project P', 'Project'],
    ]);
  });

  it("shows a member the org and the viewed project's pages, never another project's, a session's or another org's", async () => {
    const h = await createHarness();
    const graph = await h.get('/graph');
    expect(graph.status).toBe(200);
    expect(names(graph.body.pages)).toEqual(['Deploy runbook', 'Handbook', 'Org one', 'Project P']);
    expect(graph.body.edges).toContainEqual(expect.objectContaining({ kind: 'mention' }));

    const roots = await h.get('/tree');
    expect(names(roots.body.pages)).toEqual(['Org one']);
    const underOrg = await h.get(`/tree?parentId=${h.org.id}`);
    expect(names(underOrg.body.pages)).toEqual(['Handbook', 'Project P']);
  });

  it('reads the other project through its own route', async () => {
    const h = await createHarness();
    const graph = await h.get('/graph', h.otherProjectId);
    expect(names(graph.body.pages)).toEqual(['Handbook', 'Org one', 'Project Q', 'Q secret']);
  });

  it('returns a readable page with its notes and 404s a page outside the read scope', async () => {
    const h = await createHarness();
    const page = await h.get(`/pages/${h.runbook.id}`);
    expect(page.status).toBe(200);
    expect(page.body.page.name).toBe('Deploy runbook');
    expect(page.body.notes.map((note: { text: string }) => note.text)).toEqual([
      'Follow the [[Handbook]] before deploying',
    ]);
    expect((await h.get(`/pages/${h.q.id}`)).status).toBe(404);
    expect((await h.get(`/pages/${h.thread.id}`)).status).toBe(404);
    expect((await h.get('/pages/missing')).status).toBe(404);
  });

  it('searches and lists activity within the read scope only', async () => {
    const h = await createHarness();
    const search = await h.get('/search?q=secret');
    expect(search.body.results).toEqual([]);
    const hits = await h.get('/search?q=runbook');
    expect(hits.body.results.map((hit: { page: { name: string } }) => hit.page.name)).toEqual(['Deploy runbook']);
    const activity = await h.get('/activity');
    expect(activity.status).toBe(200);
    for (const event of activity.body.events) {
      expect([h.org.id, h.p.id]).toContain(event.scopeId);
    }
  });

  it('404s a project in another org and a malformed project id, and 401s a signed-out caller', async () => {
    const h = await createHarness();
    expect((await h.get('/graph', h.foreignProjectId)).status).toBe(404);
    expect((await h.get('/graph', 'not-a-uuid')).status).toBe(404);
    const signedOut = await createHarness({ user: null });
    expect((await signedOut.get('/graph')).status).toBe(401);
  });

  it('refuses a caller with no organization', async () => {
    const h = await createHarness({ user: { workosId: 'user-1' } });
    expect((await h.get('/graph')).status).toBe(403);
  });

  it('500s with the declaration error when the host does not declare project scopes', async () => {
    // A host on the SDK's default declarations: org and thread, but no `project:` type.
    const withoutProjects = {
      'org:$orgId': scopes['org:$orgId'],
      'thread:$threadId': { access: [{ principal: 'self' as const, role: 'owner' as const }] },
    };
    const h = await createHarness({ declarations: withoutProjects as unknown as typeof scopes });
    const response = await h.get('/graph');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('knowledge_misconfigured');
  });

  it('returns grants between the scopes shown, only from principal scopes the member can read', async () => {
    const h = await createHarness({
      declarations: {
        ...scopes,
        'role:$orgId:admin': {},
        'project:$projectId': {
          ...scopes['project:$projectId'],
          access: [
            ...scopes['project:$projectId'].access,
            { principal: 'org:$orgId' as const, role: 'contributor' as const },
            { principal: 'role:$orgId:admin' as const, role: 'owner' as const },
          ],
        },
      },
    });
    const graph = await h.get('/graph');
    expect(graph.status).toBe(200);
    // The org rule makes both projects readable, so both grants show; the unwritten admin role and the
    // projects' own `self` rules draw nothing.
    expect(graph.body.grants).toEqual(
      expect.arrayContaining([
        { principal: `org:${ORG}`, principalId: h.org.id, target: h.p.id, role: 'contributor' },
        { principal: `org:${ORG}`, principalId: h.org.id, target: h.q.id, role: 'contributor' },
      ]),
    );
    expect(graph.body.grants).toHaveLength(2);
  });

  it('rejects out-of-range limits', async () => {
    const h = await createHarness();
    expect((await h.get('/tree?limit=0')).status).toBe(400);
    expect((await h.get('/graph?maxPages=100000')).status).toBe(400);
  });

  describe('change stream', () => {
    /** Reads SSE frames from the events route until `count` change frames arrive, then disconnects. */
    async function openStream(h: Awaited<ReturnType<typeof createHarness>>) {
      const abort = new AbortController();
      const response = await h.app.request(`/web/factory/projects/${h.projectId}/knowledge/events`, {
        signal: abort.signal,
      });
      const reader = response.body!.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      const next = async () => {
        for (;;) {
          const end = buffer.indexOf('\n\n');
          if (end >= 0) {
            const frame = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const data = frame.split('\n').find(line => line.startsWith('data: '));
            if (data) return JSON.parse(data.slice(6));
            continue;
          }
          const { value, done } = await reader.read();
          if (done) throw new Error('stream ended');
          buffer += value;
        }
      };
      return { response, next, reader, close: () => abort.abort() };
    }

    it("streams the viewed project's changes and nothing from another project or a session", async () => {
      const h = await createHarness();
      const stream = await openStream(h);
      expect(stream.response.status).toBe(200);
      expect(stream.response.headers.get('content-type')).toContain('text/event-stream');

      await h.store.createPage({ parentId: h.q.id, name: 'Another Q secret', provenance: host });
      await h.store.createPage({ parentId: h.thread.id, name: 'More scratch', provenance: host });
      await h.store.addNote({
        pageId: h.runbook.id,
        text: 'Roll back first',
        stampScopeIds: [h.p.id],
        mentions: [],
        provenance: host,
      });

      const change = await stream.next();
      expect(change).toMatchObject({ kind: 'note', op: 'add', pageId: h.runbook.id });
      stream.close();
    });

    it('closes after five minutes so the browser reconnects and the read scope is checked again', async () => {
      const h = await createHarness();
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
      try {
        const stream = await openStream(h);
        const ended = (async () => {
          for (;;) if ((await stream.reader.read()).done) return true;
        })();
        await vi.advanceTimersByTimeAsync(5 * 60_000 - 1);
        expect(await Promise.race([ended, Promise.resolve(false)])).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(await ended).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('refuses a project in another org before opening a stream', async () => {
      const h = await createHarness();
      const response = await h.app.request(`/web/factory/projects/${h.foreignProjectId}/knowledge/events`);
      expect(response.status).toBe(404);
    });
  });
});
