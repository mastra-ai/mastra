import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

function setup(storage = new InMemoryStore()) {
  const knowledge = new Knowledge({
    storage,
    tools: true,
    scopes: {
      ...memory,
      'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'owner' }] },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, ['org:acme']);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  const write = async (name: string, body: string, extra: Record<string, unknown> = {}) =>
    (await call('knowledge_page', { op: 'write', scope: 'org:acme', name, body, ...extra })).page;
  const edit = async (page: { id: string; version: number }, patch: Record<string, unknown>) =>
    (await call('knowledge_page', { op: 'write', page: page.id, expectedVersion: page.version, ...patch })).page;
  const store = async () => (await storage.getStore('knowledge'))!;
  const out = async (pageId: string) =>
    (await (await store()).listPageLinks({ pageIds: [pageId], read: 'all', direction: 'out' })).map(
      link => link.toPageId,
    );
  return { knowledge, storage, call, write, edit, store, out };
}

describe('Knowledge page link index', () => {
  it('indexes body links by id, path, scope address and name, and skips code', async () => {
    const { write, out, store } = setup();
    const refunds = await write('Refunds', 'How refunds work.', { key: 'refunds' });
    const shipping = await write('Shipping', 'How shipping works.');
    const hub = await write(
      'Hub',
      `See [[Refunds]], [[org:acme#refunds]] and [[${shipping.id}]]. Home: [[org:acme]].\n\n` +
        '```\n[[Shipping]] in code\n```\n\nand `[[Shipping]]` inline.',
    );
    const scope = (await (await store()).getScopesByAddress(['org:acme']))[0]!;
    expect((await out(hub.id)).sort()).toEqual([refunds.id, shipping.id, scope.id].sort());
    const counts = await (await store()).countPageLinks({ pageIds: [refunds.id, hub.id], read: 'all' });
    // Two refs from one page to the same target count as one linking page.
    expect(counts[refunds.id]).toEqual({ in: 1, out: 0 });
  });

  it('leaves a ref longer than the stored ref limit as plain text', async () => {
    const { write, store } = setup();
    const target = await write('Target', 't');
    const hub = await write('Hub', `See [[Target]] and [[${'x'.repeat(513)}]].`);
    const links = await (await store()).listPageBodyLinkSources({ toPageIds: [target.id] });
    expect(links).toEqual([hub.id]);
    const rows = await (await store()).listPageBodyLinkSources({ refs: ['x'.repeat(513)] });
    expect(rows).toEqual([]);
  });

  it('resolves a dangling link once its target page is created, and unresolves it on delete', async () => {
    const { call, write, out } = setup();
    const hub = await write('Hub', 'Later: [[Returns]].');
    expect(await out(hub.id)).toEqual([]);
    const returns = await write('Returns', 'How returns work.');
    expect(await out(hub.id)).toEqual([returns.id]);
    await call('knowledge_page', { op: 'delete', page: returns.id });
    expect(await out(hub.id)).toEqual([]);
  });

  it('replaces outgoing links when the body is rewritten', async () => {
    const { write, edit, out } = setup();
    const a = await write('Alpha', 'a');
    const b = await write('Beta', 'b');
    const hub = await write('Hub', 'See [[Alpha]].');
    expect(await out(hub.id)).toEqual([a.id]);
    await edit(hub, { body: 'See [[Beta]] instead.' });
    expect(await out(hub.id)).toEqual([b.id]);
  });

  it('follows renames and moves for links by name and by path', async () => {
    const { call, write, edit, out } = setup();
    const folder = await write('Folder', 'f', { key: 'folder' });
    const doc = await write('Doc', 'd', { key: 'doc' });
    const byName = await write('By name', 'See [[Policy]].');
    const byPath = await write('By path', 'See [[org:acme#folder/doc]].');
    expect(await out(byName.id)).toEqual([]);
    expect(await out(byPath.id)).toEqual([]);

    await edit(doc, { name: 'Policy' });
    expect(await out(byName.id)).toEqual([doc.id]);

    await call('knowledge_page', { op: 'move', page: doc.id, scope: 'org:acme', parent: folder.id });
    expect(await out(byPath.id)).toEqual([doc.id]);
  });

  it('points links at a merged page to nothing and keeps links into the target', async () => {
    const { call, write, out } = setup();
    const keep = await write('Keep', 'k');
    const gone = await write('Gone', 'g');
    const toGone = await write('To gone', 'See [[Gone]].');
    const toKeep = await write('To keep', 'See [[Keep]].');
    await call('knowledge_page', { op: 'merge', page: gone.id, into: keep.id });
    expect(await out(toGone.id)).toEqual([]);
    expect(await out(toKeep.id)).toEqual([keep.id]);
  });

  it('reindexLinks backfills pages written straight to the store', async () => {
    const { knowledge, write, store, out } = setup();
    const target = await write('Target', 't');
    const hub = await write('Hub', 'nothing yet');
    const knowledgeStore = await store();
    await knowledgeStore.updatePage({
      id: hub.id,
      expectedVersion: hub.version,
      body: 'See [[Target]].',
      provenance: { author: 'host' },
    });
    expect(await out(hub.id)).toEqual([]);
    expect(await knowledge.reindexLinks()).toBeGreaterThanOrEqual(3);
    expect(await out(hub.id)).toEqual([target.id]);
  });
});
