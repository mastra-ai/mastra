import { describe, expect, it } from 'vitest';
import { setRunAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import type { KnowledgeStorage } from '../../storage/domains/knowledge';
import { knowledgeMemoryScopes } from '../declarations';
import type { KnowledgePinnedList } from '../declarations';
import { Knowledge } from '../index';
import { PIN_LIST_ID_PREFIX } from '../pinned';

const host = { author: 'host' };

async function seed(pinned: Array<string | KnowledgePinnedList>, maxTokens = 2_000) {
  const store = new InMemoryStore();
  const scopes = {
    ...knowledgeMemoryScopes(),
    'org:$orgId': { pinnedContext: pinned },
    'docs:$orgId': { access: [{ principal: 'org:$orgId', role: 'viewer' as const }] },
  };
  const knowledge = new Knowledge({ storage: store, scopes, tools: true, pinnedContext: { maxTokens } });
  const storage = (await store.getStore('knowledge')) as KnowledgeStorage;
  const scope = async (address: string, declaration: string) =>
    (await storage.materializeScope({ address, declaration, name: address, provenance: host })).scope;
  await scope('org:acme', 'org:$orgId');
  await scope('org:globex', 'org:$orgId');
  const docs = await scope('docs:acme', 'docs:$orgId');
  const page = (parentId: string, key: string, name: string) =>
    storage.createPage({ parentId, key, name, body: `${name}.`, provenance: host });
  const guides = await page(docs.id, 'guides', 'Guides');
  const agents = await page(guides.id, 'agents', 'Agents');
  await page(agents.id, 'tools', 'Tools');
  await page(agents.id, 'memory', 'Memory');
  await page(guides.id, 'workflows', 'Workflows');
  const context = (principals: string[]) => {
    const requestContext = new RequestContext();
    setRunAgentScopes(requestContext, principals);
    return { requestContext, agent: { agentId: 'a', resourceId: 'u-1', threadId: 't-1' } } as never;
  };
  return { knowledge, storage, docs, guides, agents, context };
}

describe('Knowledge pinned listings', () => {
  it('delivers a pinned listing of a page tree with refs, names and child counts, down to its depth', async () => {
    const { knowledge, guides, context } = await seed([{ list: 'docs:$orgId#guides' }]);
    const pins = await knowledge.__deliveredPins(context(['org:acme']));
    expect(pins).toEqual([
      {
        id: `${PIN_LIST_ID_PREFIX}${guides.id}`,
        name: 'Guides',
        text: [
          'Pages under Guides (docs:acme#guides, depth 1):',
          '- docs:acme#guides/agents — Agents (2 children)',
          '- docs:acme#guides/workflows — Workflows',
        ].join('\n'),
      },
    ]);

    const deeper = await seed([{ list: 'docs:$orgId#guides', depth: 2 }]);
    const [listing] = await deeper.knowledge.__deliveredPins(deeper.context(['org:acme']));
    expect(listing!.text).toBe(
      [
        'Pages under Guides (docs:acme#guides, depth 2):',
        '- docs:acme#guides/agents — Agents (2 children)',
        '  - docs:acme#guides/agents/tools — Tools',
        '  - docs:acme#guides/agents/memory — Memory',
        '- docs:acme#guides/workflows — Workflows',
      ].join('\n'),
    );
  });

  it('lists a whole scope when the listing names the scope alone', async () => {
    const { knowledge, docs, context } = await seed([{ list: 'docs:$orgId' }]);
    const pins = await knowledge.__deliveredPins(context(['org:acme']));
    expect(pins.map(pin => [pin.id, pin.text])).toEqual([
      [
        `${PIN_LIST_ID_PREFIX}${docs.id}`,
        'Pages under docs:acme (docs:acme, depth 1):\n- docs:acme#guides — Guides (2 children)',
      ],
    ]);
  });

  it('changes the entry when a listed child is added, renamed or removed, and not otherwise', async () => {
    const { knowledge, storage, agents, guides, context } = await seed([{ list: 'docs:$orgId#guides' }]);
    const text = async () => (await knowledge.__deliveredPins(context(['org:acme'])))[0]!.text;
    const before = await text();
    expect(await text()).toBe(before);

    const added = await storage.createPage({ parentId: guides.id, key: 'rag', name: 'RAG', provenance: host });
    expect(await text()).toContain('- docs:acme#guides/rag — RAG');

    const renamed = await storage.updatePage({
      id: added.id,
      expectedVersion: added.version,
      name: 'Retrieval',
      provenance: host,
    });
    expect(await text()).toContain('- docs:acme#guides/rag — Retrieval');

    await storage.createPage({ parentId: agents.id, key: 'voice', name: 'Voice', provenance: host });
    expect(await text()).toContain('Agents (3 children)');

    await storage.deletePage({ id: added.id, expectedVersion: renamed.version, deletedBy: 'host' });
    expect(await text()).not.toContain('guides/rag');
  });

  it('reaches only runs that can read the listed page', async () => {
    const { knowledge, context } = await seed([{ list: 'docs:$orgId#guides' }]);
    expect(await knowledge.__deliveredPins(context(['org:globex']))).toEqual([]);
  });

  it('cuts a listing at whole lines inside the token budget and points at knowledge_list for the rest', async () => {
    const { knowledge, storage, guides, context } = await seed([{ list: 'docs:$orgId#guides' }], 60);
    for (let i = 0; i < 20; i++) {
      await storage.createPage({ parentId: guides.id, key: `p${i}`, name: `Page number ${i}`, provenance: host });
    }
    const [listing] = await knowledge.__deliveredPins(context(['org:acme']));
    const lines = listing!.text.split('\n');
    expect(lines[0]).toBe('Pages under Guides (docs:acme#guides, depth 1):');
    expect(lines.at(-1)).toMatch(/^…and \d+ more; knowledge_list from: "docs:acme#guides"$/);
    expect(lines.length).toBeLessThan(22);
    for (const line of lines.slice(1, -1)) expect(line).toMatch(/^- docs:acme#guides\/\S+ — /);
  });

  it('shares the budget with pinned pages: both always delivered, an equal share each when they overflow', async () => {
    const { knowledge, context } = await seed([{ list: 'docs:$orgId#guides', depth: 2 }, 'docs:$orgId#guides/agents']);
    const pins = await knowledge.__deliveredPins(context(['org:acme']));
    expect(pins.map(pin => pin.text.split('\n')[0])).toEqual([
      'Agents (docs:acme#guides/agents, v1, no notes): Agents.',
      'Pages under Guides (docs:acme#guides, depth 2):',
    ]);
  });

  it.each([
    [{ list: 'docs:$orgId#guides', depth: 0 }],
    [{ list: 'docs:$orgId#guides', depth: 4 }],
    [{ list: 'docs:$orgId#' }],
    [{ list: 'nope:$orgId' }],
    [{ list: 'docs:$teamId' }],
  ])('refuses a bad pinned listing at startup: %j', entry => {
    expect(
      () =>
        new Knowledge({
          storage: new InMemoryStore(),
          scopes: {
            ...knowledgeMemoryScopes(),
            'org:$orgId': { pinnedContext: [entry] },
            'docs:$orgId': {},
          },
        }),
    ).toThrow(/pinnedContext/);
  });
});
