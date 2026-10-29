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
        pins: ['org:$orgId#policies/refund', 'org:$orgId#faq'],
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

describe('Knowledge template pages belong to config', () => {
  it('refuses to move or merge away a template page, by key path, id and name', async () => {
    const { call, read } = setup();
    const refund = await read('org:acme#policies/refund');
    const other = await call('knowledge_page', { op: 'write', scope: 'org:acme', name: 'Scratch' });
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

  it('creates a page added to the template in an existing scope on its next run', async () => {
    const first = setup();
    await first.read('org:acme#policies');
    const next = setup({
      storage: first.storage,
      pages: [{ ...TEMPLATES[0]!, pages: [...TEMPLATES[0]!.pages!, { key: 'returns', name: 'Returns' }] }],
    });
    expect((await next.read('org:acme#policies/returns')).name).toBe('Returns');
  });

  it('gives a newly created scope its template pages', async () => {
    const first = setup();
    await first.read('org:acme#policies');
    const globex = setup({ storage: first.storage, org: 'org:globex' });
    expect((await globex.read('org:globex#policies/refund')).name).toBe('Refund policy');
    expect((await globex.read('org:globex#handbook/refund')).name).toBe('Refund section');
  });

  it('turns a page removed from the template into an ordinary page, and re-attaches it when added back', async () => {
    const first = setup();
    const handbook = await first.read('org:acme#handbook');
    await first.call('knowledge_page', { op: 'write', page: 'org:acme#handbook', body: 'Read me first.' });

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
