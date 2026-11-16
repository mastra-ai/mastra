import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { knowledgeMemoryScopes } from '../declarations';
import type { KnowledgePinnedList } from '../declarations';
import { Knowledge } from '../index';
import { PIN_LIST_ID_PREFIX, PIN_OVERFLOW_ID } from '../pinned';

const host = { author: 'host' };

async function seed(options: { pinned?: Array<string | KnowledgePinnedList>; maxPins?: number; maxTokens?: number }) {
  const store = new InMemoryStore();
  const memory = knowledgeMemoryScopes();
  const knowledge = new Knowledge({
    storage: store,
    scopes: { ...memory, 'org:$orgId': { ...memory['org:$orgId'], pinnedContext: options.pinned ?? [] } },
    tools: true,
    pinnedContext: { maxPins: options.maxPins ?? 20, maxTokens: options.maxTokens ?? 2_000 },
  });
  const storage = (await store.getStore('knowledge')) as KnowledgeStorage;
  const scope = async (address: string) =>
    (await storage.materializeScope({ address, declaration: 'org:$orgId', name: address, provenance: host })).scope;
  const acme = await scope('org:acme');
  await scope('org:globex');
  const page = (parentId: string, key: string, name: string) =>
    storage.createPage({ parentId, key, name, body: `${name}.`, provenance: host });
  const handbook = await page(acme.id, 'handbook', 'Handbook');
  const onboarding = await page(handbook.id, 'onboarding', 'Onboarding');
  await page(onboarding.id, 'laptop', 'Laptop');
  await page(handbook.id, 'travel', 'Travel');
  const tools = knowledge.createTools();
  const context = (principals: string[]) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, principals);
    return { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } } as never;
  };
  const call = (tool: string, input: Record<string, unknown>) =>
    tools[tool]!.execute!(input as never, context(['org:acme'])) as Promise<any>;
  const delivered = (principals = ['org:acme']) => knowledge.__deliveredPins(context(principals));
  return { storage, acme, handbook, onboarding, call, delivered };
}

describe('knowledge_pin listings', () => {
  it('pins a listing of the pages under a page, down to its depth', async () => {
    const { handbook, call, delivered } = await seed({});
    expect(
      await call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] }),
    ).toEqual({ page: handbook.id, kind: 'list', depth: 1, audience: ['org:acme'] });
    expect(await delivered()).toEqual([
      {
        id: `${PIN_LIST_ID_PREFIX}${handbook.id}`,
        name: 'Handbook',
        text: [
          'Pages under Handbook (org:acme#handbook, depth 1):',
          '- org:acme#handbook/onboarding — Onboarding (1 child)',
          '- org:acme#handbook/travel — Travel',
        ].join('\n'),
      },
    ]);

    // Pinning again sets the new depth.
    await call('knowledge_pin', {
      op: 'pin',
      kind: 'list',
      depth: 2,
      page: 'org:acme#handbook',
      audience: ['org:acme'],
    });
    expect((await delivered())[0]!.text).toBe(
      [
        'Pages under Handbook (org:acme#handbook, depth 2):',
        '- org:acme#handbook/onboarding — Onboarding (1 child)',
        '  - org:acme#handbook/onboarding/laptop — Laptop',
        '- org:acme#handbook/travel — Travel',
      ].join('\n'),
    );
  });

  it('keeps a page pin and a listing pin of the same page apart: each pinned and unpinned on its own', async () => {
    const { handbook, call, delivered } = await seed({});
    await call('knowledge_pin', { op: 'pin', page: 'org:acme#handbook', audience: ['org:acme'] });
    await call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] });
    expect((await delivered()).map(pin => pin.id).sort()).toEqual(
      [handbook.id, `${PIN_LIST_ID_PREFIX}${handbook.id}`].sort(),
    );

    expect(await call('knowledge_pin', { op: 'unpin', page: 'org:acme#handbook', audience: ['org:acme'] })).toEqual({
      page: handbook.id,
      kind: 'page',
      audience: [],
    });
    expect((await delivered()).map(pin => pin.id)).toEqual([`${PIN_LIST_ID_PREFIX}${handbook.id}`]);

    await call('knowledge_pin', { op: 'unpin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] });
    expect(await delivered()).toEqual([]);
  });

  it('changes the listing when a listed page is added, renamed or removed', async () => {
    const { storage, handbook, call, delivered } = await seed({});
    await call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] });
    const text = async () => (await delivered())[0]!.text;

    const added = await storage.createPage({
      parentId: handbook.id,
      key: 'expenses',
      name: 'Expenses',
      provenance: host,
    });
    expect(await text()).toContain('- org:acme#handbook/expenses — Expenses');

    const renamed = await storage.updatePage({
      id: added.id,
      expectedVersion: added.version,
      name: 'Spending',
      provenance: host,
    });
    expect(await text()).toContain('- org:acme#handbook/expenses — Spending');

    await storage.deletePage({ id: added.id, expectedVersion: renamed.version, deletedBy: 'host' });
    expect(await text()).not.toContain('expenses');
  });

  it('reaches only runs that hold an audience scope and can read the listed page', async () => {
    const { storage, handbook, delivered } = await seed({});
    // org:globex can't read org:acme's pages, even when it is the audience.
    await storage.addPinAudience({ pageId: handbook.id, kind: 'list', audience: ['org:globex'], createdBy: 'host' });
    expect(await delivered(['org:globex'])).toEqual([]);
    expect(await delivered(['org:acme'])).toEqual([]);
  });

  it('takes one pin slot and counts against the token budget; one that does not fit is named on the overflow line', async () => {
    const { storage, acme, call, delivered } = await seed({ maxPins: 1 });
    const extra = await storage.createPage({
      parentId: acme.id,
      key: 'extra',
      name: 'Extra',
      body: 'Extra.',
      provenance: host,
    });
    await call('knowledge_pin', { op: 'pin', page: 'org:acme#extra', audience: ['org:acme'] });
    await call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] });
    const pins = await delivered();
    expect(pins.map(pin => pin.id)).toEqual([expect.stringMatching(/^list:/), PIN_OVERFLOW_ID]);
    expect(pins[1]!.text).toBe('Also pinned (open with knowledge_read): Extra');

    await call('knowledge_pin', { op: 'unpin', page: 'org:acme#extra', audience: ['org:acme'] });
    await call('knowledge_pin', { op: 'pin', page: extra.id, audience: ['org:acme'] });
    expect((await delivered()).at(-1)!.text).toBe('Also pinned (open with knowledge_read): Handbook (listing)');
  });

  it('delivers a stored listing of a page config already lists once, as the config listing', async () => {
    const { handbook, call, delivered } = await seed({ pinned: [{ list: 'org:$orgId#handbook', depth: 2 }] });
    await call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] });
    const pins = await delivered();
    expect(pins.map(pin => pin.id)).toEqual([`${PIN_LIST_ID_PREFIX}${handbook.id}`]);
    expect(pins[0]!.text).toContain('depth 2');
  });

  it('refuses depth on a page pin or an unpin, and a depth outside 1 to 3', async () => {
    const { call } = await seed({});
    await expect(
      call('knowledge_pin', { op: 'pin', depth: 2, page: 'org:acme#handbook', audience: ['org:acme'] }),
    ).rejects.toThrow(/depth only goes with op "pin" and kind "list"/);
    await expect(
      call('knowledge_pin', { op: 'unpin', kind: 'list', depth: 2, page: 'org:acme#handbook', audience: ['org:acme'] }),
    ).rejects.toThrow(/depth only goes with/);
    expect(
      await call('knowledge_pin', {
        op: 'pin',
        kind: 'list',
        depth: 4,
        page: 'org:acme#handbook',
        audience: ['org:acme'],
      }),
    ).toMatchObject({ error: true, validationErrors: { fields: { depth: { errors: ['must be <= 3'] } } } });
  });

  it('works with a storage adapter from before pin kinds: page pins still deliver, a listing pin is refused before anything is stored', async () => {
    const { storage, handbook, call, delivered } = await seed({});
    // An adapter from before kinds doesn't report them, ignores kind and depth, and returns pins without them.
    const strip = <T extends { kind?: unknown; depth?: unknown }>({ kind: _k, depth: _d, ...rest }: T) => rest;
    const capabilities = storage.getCapabilities.bind(storage);
    const add = storage.addPinAudience.bind(storage);
    const list = storage.listPins.bind(storage);
    storage.getCapabilities = () => {
      const { supportsPinKinds: _s, ...rest } = capabilities();
      return rest;
    };
    storage.addPinAudience = async ({ kind: _k, depth: _d, ...input }) => strip(await add(input)) as never;
    storage.listPins = async input => {
      const { kind: _k, ...rest } = input;
      const listed = await list(rest);
      return { ...listed, pins: listed.pins.map(pin => strip(pin) as never) };
    };
    await expect(
      call('knowledge_pin', { op: 'pin', kind: 'list', page: 'org:acme#handbook', audience: ['org:acme'] }),
    ).rejects.toThrow(/predates listing pins/);
    expect((await list({ audience: 'all', read: 'all' })).pins).toEqual([]);

    await call('knowledge_pin', { op: 'pin', page: 'org:acme#handbook', audience: ['org:acme'] });
    expect((await delivered()).map(pin => pin.id)).toEqual([handbook.id]);
  });
});
