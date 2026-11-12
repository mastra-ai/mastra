import { describe, expect, it, vi } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { ConsoleLogger } from '../../logger';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { knowledgeMemoryScopes } from '../declarations';
import type { KnowledgePageTemplate } from '../declarations';
import { Knowledge } from '../index';

const memory = knowledgeMemoryScopes();

const TEMPLATES: KnowledgePageTemplate[] = [
  { key: 'policies', name: 'Policies', pages: [{ key: 'refund', name: 'Refund policy' }] },
  { key: 'handbook', name: 'Handbook', pages: [{ key: 'refund', name: 'Refund section' }] },
];

/** One run against `storage`; a new call is a new Knowledge instance (a restart with that config). */
function setup({
  storage = new InMemoryStore(),
  pages = TEMPLATES,
  org = 'org:acme',
}: { storage?: InMemoryStore; pages?: KnowledgePageTemplate[]; org?: string } = {}) {
  const knowledge = new Knowledge({
    storage,
    tools: true,
    pinnedContext: true,
    scopes: {
      ...memory,
      // Owner, so refusals below come from the template rule rather than from roles.
      'org:$orgId': {
        ...memory['org:$orgId'],
        access: [{ principal: 'self', role: 'owner' }],
        pages,
        pinnedContext: ['org:$orgId#policies/refund', 'org:$orgId#faq'],
      },
    },
  });
  const tools = knowledge.createTools();
  const requestContext = new RequestContext();
  setRunAgentScopes(requestContext, [org]);
  const context = { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context as never) as Promise<any>;
  const delivered = async () => (await knowledge.__deliveredPins(context as never)).map(pin => pin.text);
  const read = async (page: string) => (await call('knowledge_read', { page })).page;
  return { storage, knowledge, call, read, delivered };
}

describe('Knowledge page key paths', () => {
  it('resolves nested key paths in tool refs, with sibling pages sharing a key under different parents', async () => {
    const { call, read } = setup();
    await call('knowledge_page', { op: 'write', page: 'org:acme#policies/refund', body: 'Refunds within 30 days.' });
    await call('knowledge_page', { op: 'write', page: 'org:acme#handbook/refund', body: 'See the policy.' });
    expect((await read('org:acme#policies/refund')).body).toBe('Refunds within 30 days.');
    expect((await read('org:acme#handbook/refund')).body).toBe('See the policy.');
    await expect(read('org:acme#refund')).rejects.toThrow(/not found/);
    await expect(read('org:acme#policies#refund')).rejects.toThrow(/not found/);
  });

  it('refuses a created page key containing "/", "#" or "%"', async () => {
    const { call } = setup();
    for (const key of ['a/b', 'a#b', '50%']) {
      await expect(call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Bad', key })).rejects.toThrow(
        /must not contain "\/", "#" or "%"/,
      );
    }
  });
});

describe('Knowledge results name pages by full ref', () => {
  async function nested() {
    const env = setup({ pages: [] });
    const { call } = env;
    const guides = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Guides', key: 'guides' });
    const ops = await call('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      parent: guides.page.id,
      name: 'Observability',
      key: 'observability',
    });
    const logging = await call('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      parent: ops.page.id,
      name: 'Logging',
      key: 'logging',
      body: 'Logging setup for zebrafish services.',
    });
    // No key: only its id reads it back.
    const loose = await call('knowledge_page', {
      op: 'write',
      scope: 'org:acme',
      parent: ops.page.id,
      name: 'Zebrafish tracing',
      body: 'Tracing for zebrafish services.',
    });
    return { ...env, guides, ops, logging, loose };
  }

  it('returns the full key path from write, search and read, and every ref reads back the same page', async () => {
    const { call, read, logging, loose, ops } = await nested();
    expect(logging.page.ref).toBe('org:acme#guides/observability/logging');
    expect(logging.page).not.toHaveProperty('key');
    expect(loose.page.ref).toBe(loose.page.id);

    const { results } = await call('knowledge_search', { query: 'zebrafish' });
    const refs = results.map((hit: any) => hit.page.ref);
    expect(refs).toEqual(expect.arrayContaining(['org:acme#guides/observability/logging', loose.page.id]));
    for (const hit of results) expect((await read(hit.page.ref)).id).toBe(hit.page.id);

    const parent = await call('knowledge_read', { page: 'org:acme#guides/observability' });
    expect(parent.page.ref).toBe('org:acme#guides/observability');
    expect(parent.page.id).toBe(ops.page.id);
    for (const child of parent.children) expect((await read(child.ref)).id).toBe(child.id);
    expect(parent.children.map((child: any) => child.ref)).toContain('org:acme#guides/observability/logging');

    expect((await call('knowledge_read', { page: 'org:acme' })).page.ref).toBe('org:acme');
  });

  it('names close matches by full ref when a guessed path is not found', async () => {
    const { read } = await nested();
    await expect(read('org:acme#logging')).rejects.toThrow(
      'Knowledge page "org:acme#logging" not found. Close matches: org:acme#guides/observability/logging (Logging).',
    );
    await expect(read('org:acme#no-such-page')).rejects.toThrow('Knowledge page "org:acme#no-such-page" not found.');
  });

  it('lists an ambiguous name by full refs', async () => {
    const { call, read, guides } = await nested();
    await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Logging', key: 'logging' });
    await expect(read('Logging')).rejects.toThrow(/use one of these refs: .*org:acme#logging/);
    await expect(read('Logging')).rejects.toThrow(/org:acme#guides\/observability\/logging/);
    expect(guides.page.ref).toBe('org:acme#guides');
  });
});

describe('Knowledge template pages belong to config', () => {
  it('refuses to move or merge away a template page, by key path, id and name', async () => {
    const { call, read } = setup();
    const other = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Scratch' });
    const refund = await read('org:acme#policies/refund');
    for (const page of ['org:acme#policies/refund', refund.id, 'Refund policy']) {
      await expect(call('knowledge_page', { op: 'move', page, scope: 'org:acme' })).rejects.toThrow(
        `"org:acme#policies/refund" is declared in config; change the scope's pages to move it.`,
      );
      await expect(call('knowledge_page', { op: 'merge', page, into: other.page.id })).rejects.toThrow(
        `"org:acme#policies/refund" is declared in config; change the scope's pages to remove it.`,
      );
    }
    await expect(call('knowledge_page', { op: 'move', page: 'Policies', scope: 'org:acme' })).rejects.toThrow(
      /"org:acme#policies" is declared in config/,
    );
    expect((await read('org:acme#policies/refund')).id).toBe(refund.id);
  });

  it('keeps a template page editable: body, name, description and notes', async () => {
    const { call, read } = setup();
    await call('knowledge_page', {
      op: 'write',
      page: 'org:acme#policies/refund',
      name: 'Refunds',
      description: 'How refunds work.',
      body: 'Refunds within 30 days.',
    });
    await call('knowledge_note', {
      op: 'add',
      page: 'org:acme#policies/refund',
      scope: ['org:acme'],
      text: 'Annual plans refund pro rata.',
    });
    const page = await read('org:acme#policies/refund');
    expect(page).toMatchObject({ name: 'Refunds', description: 'How refunds work.', body: 'Refunds within 30 days.' });
    const { notes } = await call('knowledge_read', { page: 'org:acme#policies/refund' });
    expect(notes.map((note: { text: string }) => note.text)).toEqual(['Annual plans refund pro rata.']);
  });

  it('lets an ordinary page merge into a template page', async () => {
    const { call, read } = setup();
    const draft = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Refund draft' });
    await call('knowledge_note', {
      op: 'add',
      page: draft.page.id,
      scope: ['org:acme'],
      text: 'Gift cards never refund.',
    });
    await call('knowledge_page', { op: 'merge', page: draft.page.id, into: 'org:acme#policies/refund' });
    const { notes } = await call('knowledge_read', { page: 'org:acme#policies/refund' });
    expect(notes.map((note: { text: string }) => note.text)).toEqual(['Gift cards never refund.']);
    await expect(read('Refund draft')).rejects.toThrow(/not found/);
  });

  it('creates a page added to the template in an existing scope on its next writing run', async () => {
    const first = setup();
    await first.call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Scratch' });
    const next = setup({
      storage: first.storage,
      pages: [{ ...TEMPLATES[0]!, pages: [...TEMPLATES[0]!.pages!, { key: 'returns', name: 'Returns' }] }],
    });
    await expect(next.read('org:acme#policies/returns')).rejects.toThrow(/not found/);
    await next.call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Scratch 2' });
    expect((await next.read('org:acme#policies/returns')).name).toBe('Returns');
  });

  it('gives a newly created scope its template pages', async () => {
    const first = setup();
    await first.call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Scratch' });
    const globex = setup({ storage: first.storage, org: 'org:globex' });
    await globex.call('knowledge_page', { op: 'write', scope: 'org:globex', name: 'Scratch' });
    expect((await globex.read('org:globex#policies/refund')).name).toBe('Refund policy');
    expect((await globex.read('org:globex#handbook/refund')).name).toBe('Refund section');
  });

  it('turns a page removed from the template into an ordinary page, and re-attaches it when added back', async () => {
    const first = setup();
    await first.call('knowledge_page', { op: 'write', page: 'org:acme#handbook', body: 'Read me first.' });
    const handbook = await first.read('org:acme#handbook');

    const removed = setup({ storage: first.storage, pages: [TEMPLATES[0]!] });
    expect((await removed.read('org:acme#handbook')).id).toBe(handbook.id);
    const archive = await removed.call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Archive' });
    await removed.call('knowledge_page', {
      op: 'move',
      page: 'org:acme#handbook',
      scope: 'org:acme',
      parent: archive.page.id,
    });
    await expect(removed.read('org:acme#handbook')).rejects.toThrow(/not found/);
    await removed.call('knowledge_page', { op: 'move', page: handbook.id, scope: 'org:acme' });

    const restored = setup({ storage: first.storage });
    const again = await restored.read('org:acme#handbook');
    expect(again.id).toBe(handbook.id);
    expect(again.body).toBe('Read me first.');
    await expect(restored.call('knowledge_page', { op: 'move', page: handbook.id, scope: 'org:acme' })).rejects.toThrow(
      /declared in config/,
    );
    const handbookPages = (await first.storage.getStore('knowledge'))!;
    const { pages } = await handbookPages.listPages({ read: 'all' });
    expect(pages.filter(page => page.key === 'handbook')).toHaveLength(1);
  });

  it('delivers a config pin at a template page, and nothing, silently, for a non-template pin whose page moved', async () => {
    const { call, delivered } = setup();
    const spies = (['warn', 'debug', 'error'] as const).map(level => vi.spyOn(ConsoleLogger.prototype, level));
    try {
      await call('knowledge_page', { op: 'write', page: 'org:acme#policies/refund', body: 'Refunds within 30 days.' });
      const faq = await call('knowledge_page', {
        op: 'write',
        scope: 'org:acme',
        name: 'FAQ',
        key: 'faq',
        body: 'Ask us.',
      });
      expect((await delivered()).join('\n')).toContain('Ask us.');

      await call('knowledge_page', { op: 'move', page: faq.page.id, scope: 'org:acme', parent: 'org:acme#policies' });
      const pins = await delivered();
      expect(pins.join('\n')).toContain('Refunds within 30 days.');
      expect(pins.join('\n')).not.toContain('Ask us.');
      expect(spies.flatMap(spy => spy.mock.calls)).toEqual([]);
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});
