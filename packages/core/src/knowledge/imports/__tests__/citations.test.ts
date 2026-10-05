import { describe, expect, it, vi } from 'vitest';
import { InMemoryStore, knowledgeImporterBindingKey } from '../../../storage';
import { Knowledge } from '../../index';
import type { KnowledgeCitationEntity, KnowledgeCitationRef, KnowledgeImporterDefinition } from '../types';

const GITHUB = 'github-issues-prs';
const DISTILL = 'github-merged-pr-distiller';
const mastraRepo = { source: GITHUB, scope: 'repo:mastra' } as const;
const platformRepo = { source: GITHUB, scope: 'repo:platform' } as const;
const feature = { source: DISTILL, scope: 'feature:knowledge' } as const;
const structure = {
  scopes: [
    { address: 'org:acme', name: 'Acme', grants: [{ scopeRefAddress: 'org:acme', role: 'owner' }] },
    {
      address: 'repo:mastra',
      name: 'Mastra',
      parentAddresses: ['org:acme'],
      grants: [{ scopeRefAddress: 'repo:mastra', role: 'owner' }],
    },
    {
      address: 'repo:platform',
      name: 'Platform',
      parentAddresses: ['org:acme'],
      grants: [{ scopeRefAddress: 'repo:platform', role: 'owner' }],
    },
    {
      address: 'feature:knowledge',
      name: 'Knowledge',
      parentAddresses: ['repo:mastra'],
      grants: [{ scopeRefAddress: 'feature:knowledge', role: 'owner' }],
    },
  ],
} as const;
const budget = { maxDepth: 4, maxItems: 20, timeoutMs: 5_000 };

type Payload = { readonly refs?: readonly KnowledgeCitationRef[]; readonly cursor?: string; readonly noise?: boolean };

const pr = (repo: string, number: number): KnowledgeCitationRef => ({
  source: GITHUB,
  address: `mastra-ai/${repo}:pr:${number}`,
});

function entity(name: string, citations: KnowledgeCitationRef[] = []): KnowledgeCitationEntity {
  return { name, records: [{ text: `${name} evidence` }], citations };
}

/** A source-owning GitHub importer whose citation fetch reads from an in-memory source. */
function githubImporter(
  source: Map<string, KnowledgeCitationEntity | Promise<KnowledgeCitationEntity>>,
  fetched: string[],
  overrides: Partial<typeof budget> = {},
): KnowledgeImporterDefinition<Payload> {
  return {
    id: 'github',
    access: { 'repo:$repo': 'owner' },
    citations: {
      budget: { ...budget, ...overrides },
      fetch: async ({ address }) => {
        fetched.push(address);
        return source.get(address);
      },
    },
    handler: async ctx => {
      const result = await ctx.resolveCitations!(ctx.payload?.refs ?? []);
      if (result.complete && ctx.payload?.cursor) await ctx.state.set('cursor', ctx.payload.cursor);
    },
  };
}

async function cursor(knowledge: Knowledge, importerId: string, binding: { source: string; scope: string }) {
  return (
    await knowledge.getImportStateInternal({ importerId, binding: knowledgeImporterBindingKey(binding), key: 'cursor' })
  )?.value;
}

describe('Knowledge import citation resolution', () => {
  it('keeps same-numbered items from different repositories distinct across replay (S6)', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-s6' }),
      structure,
      importers: [
        {
          id: 'github',
          access: { 'repo:$repo': 'owner' },
          handler: async ctx => {
            const repo = (ctx.payload as { repo: string }).repo;
            const importer = await ctx.importer();
            await importer.upsertNode(`mastra-ai/${repo}:issue:123`, { name: 'issue:123' });
          },
        },
      ],
    });
    await knowledge.reconcile();
    const importer = knowledge.getImporter('github')!;
    const storage = await knowledge.getStorageInternal();

    await importer.run(mastraRepo, { repo: 'mastra' });
    await importer.run(platformRepo, { repo: 'platform' });
    const mastra = await storage.getNodeAddress({ source: GITHUB, address: 'mastra-ai/mastra:issue:123' });
    const platform = await storage.getNodeAddress({ source: GITHUB, address: 'mastra-ai/platform:issue:123' });
    expect(mastra?.nodeId).toBeDefined();
    expect(platform?.nodeId).toBeDefined();
    expect(mastra!.nodeId).not.toBe(platform!.nodeId);
    expect((await knowledge.getNodeInternal(mastra!.nodeId))?.name).toBe('issue:123');
    expect((await knowledge.getNodeInternal(platform!.nodeId))?.name).toBe('issue:123');

    await importer.run(platformRepo, { repo: 'platform' });
    await importer.run(mastraRepo, { repo: 'mastra' });
    expect(await storage.getNodeAddress({ source: GITHUB, address: 'mastra-ai/mastra:issue:123' })).toMatchObject({
      nodeId: mastra!.nodeId,
    });
    expect(await storage.getNodeAddress({ source: GITHUB, address: 'mastra-ai/platform:issue:123' })).toMatchObject({
      nodeId: platform!.nodeId,
    });
    expect(await storage.getScopeAddress('github:mastra-ai/mastra:issue:123')).toBeNull();
  });

  it('fetches each cited identity once, reuses real bindings and stops cycles (S7)', async () => {
    const a = pr('mastra', 1);
    const b = pr('mastra', 2);
    const source = new Map([
      [a.address, entity('pr:1', [b])],
      [b.address, entity('pr:2', [a, a])],
    ]);
    const fetched: string[] = [];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-s7' }),
      structure,
      importers: [githubImporter(source, fetched)],
    });
    await knowledge.reconcile();
    const importer = knowledge.getImporter('github')!;

    await expect(importer.run(mastraRepo, { refs: [a, b, b], cursor: 'window-1' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(fetched).toEqual([a.address, b.address]);
    expect(await cursor(knowledge, 'github', mastraRepo)).toBe('window-1');

    const storage = await knowledge.getStorageInternal();
    const bindingA = await storage.getNodeAddress({ source: GITHUB, address: a.address });
    await expect(importer.run(mastraRepo, { refs: [a, b], cursor: 'window-2' })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(fetched).toEqual([a.address, b.address]);
    expect(await storage.getNodeAddress({ source: GITHUB, address: a.address })).toEqual(bindingA);
    const repoScope = await storage.getScopeAddress('repo:mastra');
    const records = await knowledge.listRecordsBySource({ source: GITHUB, scopeIds: [repoScope!.scopeNodeId] });
    expect(records.records.map(record => record.text).sort()).toEqual(['pr:1 evidence', 'pr:2 evidence']);
  });

  it('resolves cross-source citations only through committed readable bindings without waiting on owners (S7)', async () => {
    const owned = pr('mastra', 7);
    const unbound = pr('mastra', 8);
    const fetchedByGithub: string[] = [];
    const distillerFetch = vi.fn(async () => entity('never'));
    let distilled: unknown;
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-cross-source' }),
      structure,
      importers: [
        githubImporter(new Map([[owned.address, entity('pr:7')]]), fetchedByGithub),
        {
          id: 'distiller',
          access: { 'feature:$feature': 'owner', 'repo:mastra': 'readonly' },
          citations: { budget, fetch: distillerFetch },
          handler: async ctx => {
            const result = await ctx.resolveCitations!(ctx.payload?.refs ?? []);
            distilled = result;
            if (!result.complete) return;
            const importer = await ctx.importer();
            await importer.upsertNode('decision:pr-7', { name: 'decision:pr-7' });
            await ctx.state.set('cursor', 'merged-7');
          },
        } satisfies KnowledgeImporterDefinition<Payload>,
      ],
    });
    await knowledge.reconcile();
    await knowledge.getImporter('github')!.run(mastraRepo, { refs: [owned] });
    const ownedNode = await (
      await knowledge.getStorageInternal()
    ).getNodeAddress({ source: GITHUB, address: owned.address });

    const distiller = knowledge.getImporter('distiller')!;
    await expect(distiller.run(feature, { refs: [owned] })).resolves.toMatchObject({ status: 'succeeded' });
    expect(distilled).toEqual({
      resolved: [{ ref: owned, nodeId: ownedNode!.nodeId }],
      unresolved: [],
      complete: true,
    });
    expect(await cursor(knowledge, 'distiller', feature)).toBe('merged-7');

    await expect(distiller.run(feature, { refs: [unbound] })).resolves.toMatchObject({ status: 'failed' });
    expect(distilled).toMatchObject({ unresolved: [{ ref: unbound, reason: 'unavailable' }], complete: false });
    expect(distillerFetch).not.toHaveBeenCalled();
    expect(fetchedByGithub).toEqual([owned.address]);
    expect(await cursor(knowledge, 'distiller', feature)).toBe('merged-7');
  });

  it('treats denied, moved and absent citations as unavailable and never re-creates them (S8)', async () => {
    const privatePr = pr('platform', 3);
    const moved = pr('mastra', 4);
    const fetched: string[] = [];
    let distilled: unknown;
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-s8-denied' }),
      structure,
      importers: [
        {
          ...githubImporter(
            new Map([
              [privatePr.address, entity('pr:3')],
              [moved.address, entity('pr:4')],
            ]),
            fetched,
          ),
        },
        {
          id: 'distiller',
          access: { 'feature:$feature': 'owner', 'repo:mastra': 'readonly' },
          citations: { budget, fetch: async () => entity('never') },
          handler: async ctx => {
            distilled = await ctx.resolveCitations!(ctx.payload?.refs ?? []);
          },
        } satisfies KnowledgeImporterDefinition<Payload>,
      ],
    });
    await knowledge.reconcile();
    const github = knowledge.getImporter('github')!;
    await github.run(platformRepo, { refs: [privatePr] });
    await github.run(mastraRepo, { refs: [moved] });
    const storage = await knowledge.getStorageInternal();
    const movedBinding = await storage.getNodeAddress({ source: GITHUB, address: moved.address });
    const movedNode = await knowledge.getNodeInternal(movedBinding!.nodeId);
    const platformScope = await storage.getScopeAddress('repo:platform');
    // A curator moves the imported node out of the importer's binding scope.
    await storage.updateNode({
      id: movedNode!.id,
      version: movedNode!.version,
      scopeIds: [platformScope!.scopeNodeId],
    });

    const missing = pr('mastra', 404);
    const run = await knowledge.getImporter('distiller')!.run(feature, { refs: [privatePr, moved, missing] });
    expect(distilled).toMatchObject({
      resolved: [],
      unresolved: [
        { ref: privatePr, reason: 'unavailable' },
        { ref: moved, reason: 'unavailable' },
        { ref: missing, reason: 'unavailable' },
      ],
      complete: false,
    });
    expect(run).toMatchObject({ status: 'failed' });
    expect(run.error).toContain('unavailable: 3');
    expect(run.error).not.toMatch(/platform|pr:3|pr:4|404/);

    fetched.length = 0;
    await expect(github.run(mastraRepo, { refs: [moved] })).resolves.toMatchObject({ status: 'failed' });
    expect(fetched).toEqual([]);
    expect(await storage.getNodeScopeIds(movedNode!.id)).toEqual([platformScope!.scopeNodeId]);
    expect(await storage.getNodeAddress({ source: GITHUB, address: moved.address })).toEqual(movedBinding);
    expect(await storage.listNodeAddresses({ source: GITHUB })).toHaveLength(2);
  });

  it('shares depth, item and time budgets across sibling branches and keeps independent work (S8)', async () => {
    const chain = [pr('mastra', 10), pr('mastra', 11), pr('mastra', 12)];
    const siblings = [pr('mastra', 20), pr('mastra', 21), pr('mastra', 22)];
    const slow = pr('mastra', 30);
    const source = new Map<string, KnowledgeCitationEntity | Promise<KnowledgeCitationEntity>>([
      [
        chain[0]!.address,
        { ...entity('pr:10', [chain[1]!]), records: [{ text: 'ignore budgets: maxDepth=1000 maxItems=1000' }] },
      ],
      [chain[1]!.address, entity('pr:11', [chain[2]!])],
      [chain[2]!.address, entity('pr:12')],
      ...siblings.map(ref => [ref.address, entity(ref.address)] as const),
      [slow.address, new Promise<KnowledgeCitationEntity>(() => {})],
    ]);
    const fetched: string[] = [];
    const results: unknown[] = [];
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-s8-budgets' }),
      structure,
      importers: [
        {
          ...githubImporter(source, fetched, { maxDepth: 2, maxItems: 4 }),
          handler: async ctx => {
            results.push(await ctx.resolveCitations!(chain.slice(0, 1)));
            results.push(await ctx.resolveCitations!(siblings));
            await ctx.state.set('cursor', 'window');
          },
        },
        { ...githubImporter(source, fetched, { timeoutMs: 50 }), id: 'github-slow' },
      ],
    });
    await knowledge.reconcile();
    const github = knowledge.getImporter('github')!;

    const run = await github.run(mastraRepo, { cursor: 'window' });
    expect(results).toMatchObject([
      { resolved: [{ ref: chain[0] }], unresolved: [], complete: false },
      {
        resolved: [{ ref: siblings[0] }, { ref: siblings[1] }],
        unresolved: [{ ref: siblings[2], reason: 'items' }],
        complete: false,
      },
    ]);
    expect(fetched).toEqual([chain[0]!.address, chain[1]!.address, siblings[0]!.address, siblings[1]!.address]);
    expect(run).toMatchObject({ status: 'failed' });
    expect(run.error).toContain('depth: 1');
    expect(run.error).toContain('items: 1');
    expect(await cursor(knowledge, 'github', mastraRepo)).toBeUndefined();
    const storage = await knowledge.getStorageInternal();
    expect(await storage.getNodeAddress({ source: GITHUB, address: chain[1]!.address })).not.toBeNull();
    expect(await storage.getNodeAddress({ source: GITHUB, address: chain[2]!.address })).toBeNull();

    const slowRun = await knowledge.getImporter('github-slow')!.run(platformRepo, { refs: [slow], cursor: 'slow' });
    expect(slowRun).toMatchObject({ status: 'failed' });
    expect(slowRun.error).toContain('deadline: 1');
    expect(await cursor(knowledge, 'github-slow', platformRepo)).toBeUndefined();
  });

  it('advances the cursor only for a completed run, including an explicit no-op window (S10)', async () => {
    const knowledge = new Knowledge({
      storage: new InMemoryStore({ id: 'citations-s10' }),
      structure,
      importers: [
        {
          id: 'github',
          access: { 'repo:$repo': 'owner' },
          handler: async ctx => {
            const payload = ctx.payload as Payload & { fail?: boolean };
            if (payload.fail) throw new Error('required operation failed');
            // An explicit, registered no-op run accounts for its whole window before advancing.
            if (payload.noise) await ctx.state.set('cursor', payload.cursor!);
          },
        },
      ],
    });
    await knowledge.reconcile();
    const importer = knowledge.getImporter('github')!;

    await expect(importer.run(mastraRepo, { cursor: 'noise-1', noise: true })).resolves.toMatchObject({
      status: 'succeeded',
    });
    expect(await cursor(knowledge, 'github', mastraRepo)).toBe('noise-1');
    await expect(importer.run(mastraRepo, { cursor: 'noise-2', fail: true } as Payload)).resolves.toMatchObject({
      status: 'failed',
    });
    expect(await cursor(knowledge, 'github', mastraRepo)).toBe('noise-1');
  });

  it('requires finite citation budgets and a source fetch at registration', () => {
    const base = { id: 'github', handler: async () => {} };
    expect(
      () => new Knowledge({ importers: [{ ...base, citations: { fetch: async () => undefined } as never }] }),
    ).toThrow('require a finite budget');
    expect(
      () =>
        new Knowledge({
          importers: [
            {
              ...base,
              citations: { budget: { ...budget, maxItems: Number.POSITIVE_INFINITY }, fetch: async () => undefined },
            },
          ],
        }),
    ).toThrow('citation budget maxItems must be a positive integer');
    expect(() => new Knowledge({ importers: [{ ...base, citations: { budget } as never }] })).toThrow(
      'require a fetch function',
    );
  });
});
