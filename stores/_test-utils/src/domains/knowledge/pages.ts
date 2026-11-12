import type { KnowledgeReadScope, KnowledgeStorage } from '@mastra/core/storage';
import { knowledgePositionBetween, MAX_KNOWLEDGE_MOVE_PAGES, MAX_KNOWLEDGE_PAGE_DEPTH } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

const host = { author: 'host' };
const alex = { author: 'agent:alex', sourceThreadId: 't1' };

const ORG = 'org:$orgId';
const TEAM = 'team:$orgId:$teamId';
const ACCOUNT = 'account:$orgId:$accountId';
const ACCOUNT_INTERNAL = 'account:$orgId:$accountId/internal';
const RESOURCE = 'resource:$resourceId';

const read = (
  addresses: string[],
  prefixes: Array<{ declaration: string; prefix: string }> = [],
  children: Array<{ declaration: string; parentId: string }> = [],
): KnowledgeReadScope => ({ addresses, prefixes, children });

const ids = (pages: Array<{ id: string }>) => pages.map(page => page.id);

async function rejectsNamed(promise: Promise<unknown>, name: string | RegExp): Promise<void> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  expect(error, `expected a rejection matching ${name}`).toBeInstanceOf(Error);
  const { name: actual, message } = error as Error;
  if (typeof name === 'string') expect(actual).toBe(name);
  else expect(message).toMatch(name);
}

/**
 * Shared schema-4 page-store contract (see `@mastra/core/storage` pages.ts). Every adapter runs it;
 * the in-memory store is the reference. `createStore` returns a fresh or cleared store each time.
 */
export function createKnowledgePageStoreTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('knowledge page store contract (schema 4)', () => {
    let store: KnowledgeStorage;

    beforeEach(async () => {
      store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
    });

    const scope = async (address: string, declaration: string, parentId?: string | null) =>
      (await store.materializeScope({ address, declaration, name: address, parentId, provenance: host })).scope;
    const page = (
      parentId: string,
      name: string,
      extra: Partial<{ key: string; description: string; body: string; position: string }> = {},
    ) => store.createPage({ parentId, name, provenance: alex, ...extra });

    describe('scopes', () => {
      it('materializes a scope once, with its template children and keyed pages', async () => {
        const first = await store.materializeScope({
          address: 'account:acme:1',
          declaration: ACCOUNT,
          name: 'Account 1',
          children: [{ address: 'account:acme:1/internal', declaration: ACCOUNT_INTERNAL, name: 'internal' }],
          pages: [{ key: 'overview', name: 'Overview' }],
          provenance: host,
        });
        expect(first.created).toBe(true);
        expect(first.scope).toMatchObject({
          isScope: true,
          address: 'account:acme:1',
          declaration: ACCOUNT,
          parentId: null,
          version: 1,
        });
        expect(first.scope.scopeId).toBe(first.scope.id);

        const again = await store.materializeScope({
          address: 'account:acme:1',
          declaration: ACCOUNT,
          name: 'Account 1',
          children: [{ address: 'account:acme:1/internal', declaration: ACCOUNT_INTERNAL, name: 'internal' }],
          pages: [{ key: 'overview', name: 'Overview' }],
          provenance: host,
        });
        expect(again).toEqual({ scope: first.scope, created: false });

        const [internal] = await store.getScopesByAddress(['account:acme:1/internal']);
        expect(internal).toMatchObject({ parentId: first.scope.id, declaration: ACCOUNT_INTERNAL, isScope: true });
        const children = await store.listChildScopes({ parentId: first.scope.id });
        expect(ids(children.pages)).toEqual([internal!.id]);
        const overview = await store.getPageByPath({ scopeId: first.scope.id, path: ['overview'], read: 'all' });
        expect(overview).toMatchObject({ name: 'Overview', isScope: false, scopeId: first.scope.id });
      });

      it('links an unplaced scope once and never replaces its first non-null parent', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const resource = await scope('resource:u1', RESOURCE);
        expect(resource.parentId).toBeNull();
        const linked = await store.materializeScope({
          address: 'resource:u1',
          declaration: RESOURCE,
          name: 'u1',
          parentId: acme.id,
          provenance: host,
        });
        expect(linked).toMatchObject({ created: false, scope: { id: resource.id, parentId: acme.id } });
        expect(linked.parentConflict).toBeUndefined();
        const conflicting = await store.materializeScope({
          address: 'resource:u1',
          declaration: RESOURCE,
          name: 'u1',
          parentId: globex.id,
          provenance: host,
        });
        expect(conflicting.scope.parentId).toBe(acme.id);
        expect(conflicting.parentConflict).toEqual({ existingParentId: acme.id, requestedParentId: globex.id });
        expect((await store.getScopesByAddress(['resource:u1']))[0]!.parentId).toBe(acme.id);
      });

      it('adds template children and keyed pages declared after the scope was created', async () => {
        const account = await scope('account:acme:1', ACCOUNT);
        await store.materializeScope({
          address: 'account:acme:1',
          declaration: ACCOUNT,
          name: 'Account 1',
          children: [{ address: 'account:acme:1/internal', declaration: ACCOUNT_INTERNAL, name: 'internal' }],
          pages: [{ key: 'overview', name: 'Overview' }],
          provenance: host,
        });
        expect(await store.getScopesByAddress(['account:acme:1/internal'])).toHaveLength(1);
        expect(await store.getPageByPath({ scopeId: account.id, path: ['overview'], read: 'all' })).not.toBeNull();
      });

      it('keeps the first belongsTo parent and reports a later conflict', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const user = await scope('resource:u1', RESOURCE, acme.id);
        expect(user.parentId).toBe(acme.id);
        const later = await store.materializeScope({
          address: 'resource:u1',
          declaration: RESOURCE,
          name: 'u1',
          parentId: globex.id,
          provenance: host,
        });
        expect(later.created).toBe(false);
        expect(later.scope.parentId).toBe(acme.id);
        expect(later.parentConflict).toEqual({ existingParentId: acme.id, requestedParentId: globex.id });
      });

      it('lists root scopes and child scopes by position, paged', async () => {
        const roots = [];
        for (const name of ['a', 'b', 'c']) roots.push(await scope(`org:${name}`, ORG));
        const first = await store.listChildScopes({ parentId: null, limit: 2 });
        expect(ids(first.pages)).toEqual(ids(roots.slice(0, 2)));
        expect(first.nextCursor).toBeTruthy();
        const second = await store.listChildScopes({ parentId: null, limit: 2, cursor: first.nextCursor });
        expect(ids(second.pages)).toEqual([roots[2]!.id]);
        expect(second.nextCursor).toBeUndefined();
      });

      it('lists and counts only the child scopes a reader can see, filtered before the limit', async () => {
        const acme = await scope('org:acme', ORG);
        const hidden = await scope('team:acme:hidden', TEAM, acme.id);
        const eng = await scope('team:acme:eng', TEAM, acme.id);
        const ops = await scope('team:acme:ops', TEAM, acme.id);
        const reader = read(['org:acme', 'team:acme:eng', 'team:acme:ops']);

        // The unreadable scope comes first by position, so filtering after the limit would drop eng.
        const first = await store.listChildScopes({ parentId: acme.id, read: reader, limit: 1 });
        expect(ids(first.pages)).toEqual([eng.id]);
        const second = await store.listChildScopes({ parentId: acme.id, read: reader, cursor: first.nextCursor });
        expect(ids(second.pages)).toEqual([ops.id]);
        expect(second.nextCursor).toBeUndefined();
        // Prefix and child-of-parent grants read scopes the same way pages do.
        expect(
          ids(
            (
              await store.listChildScopes({
                parentId: acme.id,
                read: read([], [{ declaration: TEAM, prefix: 'team:acme:h' }]),
              })
            ).pages,
          ),
        ).toEqual([hidden.id]);
        expect(
          ids(
            (
              await store.listChildScopes({
                parentId: acme.id,
                read: read([], [], [{ declaration: TEAM, parentId: acme.id }]),
              })
            ).pages,
          ),
        ).toEqual([hidden.id, eng.id, ops.id]);
        // Without `read` the host still sees every child scope.
        expect(ids((await store.listChildScopes({ parentId: acme.id })).pages)).toEqual([hidden.id, eng.id, ops.id]);

        expect(
          await store.countChildScopes({ parentIds: [acme.id, acme.id, eng.id, 'missing'], read: reader }),
        ).toEqual({ [acme.id]: 2, [eng.id]: 0, missing: 0 });
        expect(await store.countChildScopes({ parentIds: [acme.id], read: 'all' })).toEqual({ [acme.id]: 3 });
        expect(await store.countChildScopes({ parentIds: [acme.id], read: read([]) })).toEqual({ [acme.id]: 0 });
        expect(await store.countChildScopes({ parentIds: [], read: reader })).toEqual({});
      });
    });

    describe('scope declaration keys', () => {
      const seed = async () => {
        await scope('org:acme', ORG);
        await scope('team:acme:eng', TEAM);
        await scope('team:acme:ops', TEAM);
        // A key that only shares a prefix with ACCOUNT, so a rename of ACCOUNT must leave it alone.
        await scope('accountx:acme:9', `${ACCOUNT}x`);
        const account = await store.materializeScope({
          address: 'account:acme:1',
          declaration: ACCOUNT,
          name: 'Account 1',
          children: [{ address: 'account:acme:1/internal', declaration: ACCOUNT_INTERNAL, name: 'internal' }],
          provenance: host,
        });
        return account.scope;
      };

      it('lists every stored declaration key with its scope count, in key order', async () => {
        await seed();
        expect(await store.listScopeDeclarations()).toEqual([
          { declaration: ACCOUNT, scopes: 1 },
          { declaration: ACCOUNT_INTERNAL, scopes: 1 },
          { declaration: `${ACCOUNT}x`, scopes: 1 },
          { declaration: ORG, scopes: 1 },
          { declaration: TEAM, scopes: 2 },
        ]);
      });

      it('renames a key and its template children, after the check sees every affected scope', async () => {
        const account = await seed();
        const seen: unknown[] = [];
        const renamed = await store.renameScopeDeclaration({
          from: ACCOUNT,
          to: 'acct:$orgId:$accountId',
          check: scopes => {
            seen.push(...scopes);
          },
        });
        expect(renamed).toBe(2);
        expect(seen).toHaveLength(2);
        expect(seen).toEqual(
          expect.arrayContaining([
            { address: 'account:acme:1', from: ACCOUNT, to: 'acct:$orgId:$accountId' },
            { address: 'account:acme:1/internal', from: ACCOUNT_INTERNAL, to: 'acct:$orgId:$accountId/internal' },
          ]),
        );
        expect(await store.listScopeDeclarations()).toEqual([
          { declaration: `${ACCOUNT}x`, scopes: 1 },
          { declaration: 'acct:$orgId:$accountId', scopes: 1 },
          { declaration: 'acct:$orgId:$accountId/internal', scopes: 1 },
          { declaration: ORG, scopes: 1 },
          { declaration: TEAM, scopes: 2 },
        ]);
        const [stored] = await store.getScopesByAddress(['account:acme:1']);
        expect(stored).toMatchObject({ id: account.id, declaration: 'acct:$orgId:$accountId' });
      });

      it('changes nothing when the check throws, and renames nothing for an unused key', async () => {
        await seed();
        const before = await store.listScopeDeclarations();
        await expect(
          store.renameScopeDeclaration({
            from: TEAM,
            to: 'squad:$orgId:$teamId',
            check: () => {
              throw new Error('pattern mismatch');
            },
          }),
        ).rejects.toThrow('pattern mismatch');
        expect(await store.listScopeDeclarations()).toEqual(before);
        expect(await store.renameScopeDeclaration({ from: 'gone:$x', to: ORG, check: () => {} })).toBe(0);
        expect(await store.listScopeDeclarations()).toEqual(before);
      });

      it('matches the key literally, so _ and % in it are not wildcards', async () => {
        await scope('a_c:1', 'a_c:$id');
        await scope('abc:1/internal', 'abc:$id/internal');
        await scope('a%c:1', 'a%c');
        await scope('axyc:1', 'axyc');
        expect(await store.renameScopeDeclaration({ from: 'a_c:$id', to: 'ac:$id', check: () => {} })).toBe(1);
        expect(await store.renameScopeDeclaration({ from: 'a%c', to: 'ac2', check: () => {} })).toBe(1);
        expect(await store.listScopeDeclarations()).toEqual([
          { declaration: 'abc:$id/internal', scopes: 1 },
          { declaration: 'ac2', scopes: 1 },
          { declaration: 'ac:$id', scopes: 1 },
          { declaration: 'axyc', scopes: 1 },
        ]);
      });

      it('renames keys with characters outside the BMP exactly as the check saw them', async () => {
        await scope('astral:1', 'a\u{1F600}:$id');
        await scope('astral:1/internal', 'a\u{1F600}:$id/internal');
        const seen: unknown[] = [];
        expect(
          await store.renameScopeDeclaration({
            from: 'a\u{1F600}:$id',
            to: 'b:$id',
            check: scopes => {
              seen.push(...scopes);
            },
          }),
        ).toBe(2);
        expect(seen).toEqual(
          expect.arrayContaining([
            { address: 'astral:1', from: 'a\u{1F600}:$id', to: 'b:$id' },
            { address: 'astral:1/internal', from: 'a\u{1F600}:$id/internal', to: 'b:$id/internal' },
          ]),
        );
        expect(await store.listScopeDeclarations()).toEqual([
          { declaration: 'b:$id', scopes: 1 },
          { declaration: 'b:$id/internal', scopes: 1 },
        ]);
      });
    });

    describe('key paths', () => {
      it('keeps keys unique among live siblings only', async () => {
        const acme = await scope('org:acme', ORG);
        const policies = await page(acme.id, 'Policies', { key: 'policies' });
        const handbook = await page(acme.id, 'Handbook', { key: 'handbook' });
        const refund = await page(policies.id, 'Refund policy', { key: 'refund' });
        const handbookRefund = await page(handbook.id, 'Refund section', { key: 'refund' });
        expect(handbookRefund.key).toBe('refund');

        await rejectsNamed(page(policies.id, 'Another refund', { key: 'refund' }), 'KnowledgePageKeyConflictError');
        await expect(page(policies.id, 'Another refund', { key: 'refund' })).rejects.toMatchObject({
          key: 'refund',
          parentId: policies.id,
        });

        await store.deletePage({ id: refund.id, expectedVersion: 1, deletedBy: 'alex' });
        await expect(page(policies.id, 'Refund policy v2', { key: 'refund' })).resolves.toMatchObject({
          key: 'refund',
        });
      });

      it('lets one of several concurrent creates of a key win and refuses the rest as a key conflict', async () => {
        const acme = await scope('org:acme', ORG);
        const results = await Promise.allSettled(
          Array.from({ length: 4 }, (_, i) => page(acme.id, `Install ${i}`, { key: 'install' })),
        );
        expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
        for (const result of results) {
          if (result.status === 'rejected') expect(result.reason?.name).toBe('KnowledgePageKeyConflictError');
        }
      });

      it('refuses keys that are empty or contain "/", "#" or "%"', async () => {
        const acme = await scope('org:acme', ORG);
        for (const key of ['', 'a/b', 'a#b', 'a%2Fb']) {
          await expect(page(acme.id, `Bad ${key}`, { key })).rejects.toThrow(/Knowledge page key/);
        }
        expect((await store.listPages({ read: 'all' })).pages).toEqual([]);
      });

      it('resolves a key path by walking the tree, and an old path stops resolving after a move', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const policies = await page(acme.id, 'Policies', { key: 'policies' });
        const refund = await page(policies.id, 'Refund policy', { key: 'refund' });
        const archive = await page(acme.id, 'Archive', { key: 'archive' });
        const at = (scopeId: string, path: string[], r: KnowledgeReadScope = 'all') =>
          store.getPageByPath({ scopeId, path, read: r }).then(found => found?.id ?? null);

        expect(await at(acme.id, ['policies', 'refund'])).toBe(refund.id);
        expect(await at(acme.id, ['policies'])).toBe(policies.id);
        expect(await at(acme.id, ['refund'])).toBeNull();
        expect(await at(acme.id, ['policies', 'missing'])).toBeNull();
        expect(await at(acme.id, [])).toBeNull();
        expect(await at(globex.id, ['policies', 'refund'])).toBeNull();
        expect(await at(acme.id, ['policies', 'refund'], read(['org:globex']))).toBeNull();
        expect(await at(acme.id, ['policies', 'refund'], read(['org:acme']))).toBe(refund.id);

        await store.movePage({ id: refund.id, expectedVersion: 1, parentId: archive.id, provenance: host });
        expect(await at(acme.id, ['policies', 'refund'])).toBeNull();
        expect(await at(acme.id, ['archive', 'refund'])).toBe(refund.id);

        await store.movePage({ id: refund.id, expectedVersion: 2, parentId: policies.id, provenance: host });
        await store.movePage({ id: policies.id, expectedVersion: 1, parentId: archive.id, provenance: host });
        expect(await at(acme.id, ['policies', 'refund'])).toBeNull();
        expect(await at(acme.id, ['archive', 'policies', 'refund'])).toBe(refund.id);
      });

      it('stops a path at a deleted page', async () => {
        const acme = await scope('org:acme', ORG);
        const policies = await page(acme.id, 'Policies', { key: 'policies' });
        await store.deletePage({ id: policies.id, expectedVersion: 1, deletedBy: 'alex' });
        expect(await store.getPageByPath({ scopeId: acme.id, path: ['policies'], read: 'all' })).toBeNull();
      });

      it("merges a child into its parent when the child's own child has the child's key", async () => {
        const acme = await scope('org:acme', ORG);
        const target = await page(acme.id, 'Target', { key: 't' });
        const source = await page(target.id, 'X', { key: 'x' });
        const grandchild = await page(source.id, 'Inner x', { key: 'x' });

        // The source is deleted by the merge, so its key no longer clashes with its arriving child.
        await store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance: host });

        const at = (path: string[]) =>
          store.getPageByPath({ scopeId: acme.id, path, read: 'all' }).then(found => found?.id ?? null);
        expect(await at(['t', 'x'])).toBe(grandchild.id);
        expect(await at(['t', 'x', 'x'])).toBeNull();
        expect((await store.getPage({ id: source.id, read: 'all' }))?.deletedAt).toBeTruthy();
      });

      it('materializes concurrently without throwing or duplicating a template page', async () => {
        const nested = [{ key: 'policies', name: 'Policies', pages: [{ key: 'refund', name: 'Refund policy' }] }];
        const materialize = (pages: typeof nested) =>
          store.materializeScope({ address: 'org:acme', declaration: ORG, name: 'Acme', pages, provenance: host });
        const [a, b] = await Promise.all([materialize(nested), materialize(nested)]);
        expect(a.scope.id).toBe(b.scope.id);
        expect([a.created, b.created].filter(Boolean)).toHaveLength(1);

        // An existing scope missing a template child: both runs add it, one page results.
        const grown = [{ ...nested[0]!, pages: [...nested[0]!.pages, { key: 'returns', name: 'Returns' }] }];
        await Promise.all([materialize(grown), materialize(grown)]);

        const { pages } = await store.listPages({ read: 'all' });
        const live = pages.filter(entry => !entry.isScope);
        expect(live.map(entry => entry.key).sort()).toEqual(['policies', 'refund', 'returns']);
        expect((await store.getScopesByAddress(['org:acme'])).length).toBe(1);
      });

      it('materializes nested page templates once, adding nested templates declared later', async () => {
        const template = { key: 'policies', name: 'Policies', pages: [{ key: 'refund', name: 'Refund policy' }] };
        const { scope: acme } = await store.materializeScope({
          address: 'org:acme',
          declaration: ORG,
          name: 'Acme',
          pages: [template, { key: 'handbook', name: 'Handbook', pages: [{ key: 'refund', name: 'Refund section' }] }],
          provenance: host,
        });
        const policies = await store.getPageByPath({ scopeId: acme.id, path: ['policies'], read: 'all' });
        const refund = await store.getPageByPath({ scopeId: acme.id, path: ['policies', 'refund'], read: 'all' });
        expect(refund).toMatchObject({ parentId: policies!.id, scopeId: acme.id, name: 'Refund policy' });
        expect(
          await store.getPageByPath({ scopeId: acme.id, path: ['handbook', 'refund'], read: 'all' }),
        ).toMatchObject({
          name: 'Refund section',
        });

        await store.materializeScope({
          address: 'org:acme',
          declaration: ORG,
          name: 'Acme',
          pages: [{ ...template, pages: [...template.pages, { key: 'returns', name: 'Returns' }] }],
          provenance: host,
        });
        expect(ids((await store.listChildPages({ parentId: policies!.id, read: 'all' })).pages)).toEqual([
          refund!.id,
          (await store.getPageByPath({ scopeId: acme.id, path: ['policies', 'returns'], read: 'all' }))!.id,
        ]);
        expect((await store.listPages({ read: 'all' })).pages).toHaveLength(5);
      });
    });

    describe('read scope filtering', () => {
      it('treats a page in an unreadable scope exactly like a missing one', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const visible = await page(acme.id, 'Refund policy', { key: 'refunds' });
        const hidden = await page(globex.id, 'Refund policy', { key: 'refunds' });
        const r = read(['org:acme']);

        expect(await store.getPage({ id: hidden.id, read: r })).toBeNull();
        expect(await store.getPage({ id: 'missing', read: r })).toBeNull();
        expect(await store.getPage({ id: visible.id, read: r })).toMatchObject({ id: visible.id });
        expect(await store.getPageByPath({ scopeId: globex.id, path: ['refunds'], read: r })).toBeNull();
        expect(ids(await store.findPagesByName({ name: '  refund   POLICY ', read: r }))).toEqual([visible.id]);
        expect(ids((await store.listPages({ read: r })).pages)).toEqual([visible.id]);
        expect(ids((await store.listChildPages({ parentId: globex.id, read: r })).pages)).toEqual([]);
        expect((await store.searchPages({ query: 'refund', read: r })).map(hit => hit.page.id)).toEqual([visible.id]);
        expect(ids((await store.listPages({ read: 'all' })).pages).sort()).toEqual([visible.id, hidden.id].sort());
      });

      it('matches prefixes exactly, case-sensitively and at segment boundaries', async () => {
        const acme = await scope('team:acme:eng', TEAM);
        const acmecorp = await scope('team:acmecorp:eng', TEAM);
        const upper = await scope('team:ACME:eng', TEAM);
        const literal = await scope('team:a_c%:eng', TEAM);
        const pages = await Promise.all([acme, acmecorp, upper, literal].map(s => page(s.id, `p-${s.address}`)));
        const visibleUnder = async (prefix: string) =>
          ids((await store.listPages({ read: read([], [{ declaration: TEAM, prefix }]) })).pages).sort();

        expect(await visibleUnder('team:acme:')).toEqual([pages[0]!.id]);
        expect(await visibleUnder('team:a_c%:')).toEqual([pages[3]!.id]);
        expect(await visibleUnder('team:a__%:')).toEqual([]);
        expect(await visibleUnder('')).toEqual(ids(pages).sort());
        // A prefix entry only matches scopes of its own declaration.
        expect(ids((await store.listPages({ read: read([], [{ declaration: ORG, prefix: '' }]) })).pages)).toEqual([]);
      });

      it("doesn't let a parent prefix reach template children; a children entry reaches by tree parent", async () => {
        const acme = await scope('org:acme', ORG);
        const account = await store.materializeScope({
          address: 'account:acme:1',
          declaration: ACCOUNT,
          name: 'Account 1',
          parentId: acme.id,
          children: [{ address: 'account:acme:1/internal', declaration: ACCOUNT_INTERNAL, name: 'internal' }],
          provenance: host,
        });
        const [internal] = await store.getScopesByAddress(['account:acme:1/internal']);
        const outer = await page(account.scope.id, 'Outer');
        const inner = await page(internal!.id, 'Inner');

        const prefix = read([], [{ declaration: ACCOUNT, prefix: 'account:acme:' }]);
        expect(ids((await store.listPages({ read: prefix })).pages)).toEqual([outer.id]);
        const byParent = read([], [], [{ declaration: ACCOUNT, parentId: acme.id }]);
        expect(ids((await store.listPages({ read: byParent })).pages)).toEqual([outer.id]);
        const child = read([], [], [{ declaration: ACCOUNT_INTERNAL, parentId: account.scope.id }]);
        expect(ids((await store.listPages({ read: child })).pages)).toEqual([inner.id]);
      });

      it('filters before paging, and handles a read scope of 1,000 addresses', async () => {
        const readable = [];
        for (let i = 0; i < 6; i++) {
          const hiddenScope = await scope(`org:hidden${i}`, ORG);
          await page(hiddenScope.id, `a${i}`);
          const shownScope = await scope(`org:shown${i}`, ORG);
          readable.push(await page(shownScope.id, `b${i}`));
        }
        const addresses = Array.from({ length: 994 }, (_, i) => `org:other${i}`);
        for (let i = 0; i < 6; i++) addresses.push(`org:shown${i}`);
        const r = read(addresses);
        const first = await store.listPages({ read: r, limit: 4 });
        expect(ids(first.pages)).toEqual(ids(readable.slice(0, 4)));
        const second = await store.listPages({ read: r, limit: 4, cursor: first.nextCursor });
        expect(ids(second.pages)).toEqual(ids(readable.slice(4)));
        expect(second.nextCursor).toBeUndefined();
      });
    });

    describe('read filters agree across methods', () => {
      it('lists and finds a page exactly when getPage returns it, for every read scope shape', async () => {
        const PROJECT = 'project:$projectId';
        const INTERNAL = 'account:$orgId:$accountId/internal';
        const made = new Map<string, string>();
        const make = async (address: string, declaration: string, parent?: string) => {
          const created = await scope(address, declaration, parent ? made.get(parent) : undefined);
          made.set(address, created.id);
        };
        await make('org:acme', ORG);
        await make('org:globex', ORG);
        await make('team:acme:eng', TEAM, 'org:acme');
        await make('team:acme:sales', TEAM, 'org:acme');
        await make('team:globex:eng', TEAM, 'org:globex');
        await make('team:acme:unlinked', TEAM);
        await make('policy:acme', 'policy:$orgId');
        await make('policy:globex', 'policy:$orgId');
        await make('account:acme:1', ACCOUNT);
        await make('account:acme:1/internal', INTERNAL, 'account:acme:1');
        await make('project:p1', PROJECT, 'team:acme:eng');
        await make('project:p2', PROJECT, 'team:acme:sales');
        await make('project:p3', PROJECT, 'team:globex:eng');
        await make('project:orphan', PROJECT);
        await make('feature:acme:a', 'feature:$orgId:$featureId');
        await make('resource:u-1', RESOURCE);
        await make('thread:t-1', 'thread:$threadId');
        // One page per scope, each with a word no other page has.
        const word = new Map<string, string>();
        for (const [address, scopeId] of made) {
          const unique = `zq${word.size}x${word.size}zq`;
          const created = await page(scopeId, `Page in ${address}`, { body: `About ${unique}.` });
          word.set(created.id, unique);
        }
        const team = (prefix: string) => ({ declaration: TEAM, prefix });
        const internal = (prefix: string) => ({ declaration: INTERNAL, prefix });
        const projects = (parent: string) => ({ declaration: PROJECT, parentId: made.get(parent)! });
        // The read scopes knowledgeReadScopeFor builds for the one-hop access suite's 13 principal sets.
        const reads: Record<string, KnowledgeReadScope> = {
          none: read([]),
          'org:acme': read(['org:acme', 'policy:acme'], [team('team:acme:')]),
          'org:globex': read(['org:globex', 'policy:globex'], [team('team:globex:')]),
          'team:acme:eng': read(['team:acme:eng', 'feature:acme:a'], [], [projects('team:acme:eng')]),
          'team:acme:sales': read(['team:acme:sales'], [], [projects('team:acme:sales')]),
          'team:globex:eng': read(['team:globex:eng'], [], [projects('team:globex:eng')]),
          'role:acme:admin': read(['policy:acme', 'feature:acme:a'], [internal('account:acme:')]),
          'role:globex:admin': read(['policy:globex'], [internal('account:globex:')]),
          'account:acme:1': read(['account:acme:1']),
          'org+admin+eng': read(
            ['org:acme', 'policy:acme', 'feature:acme:a', 'team:acme:eng'],
            [team('team:acme:'), internal('account:acme:')],
            [projects('team:acme:eng')],
          ),
          'org+globex team+memory': read(
            ['org:acme', 'policy:acme', 'team:globex:eng', 'resource:u-1', 'thread:t-1'],
            [team('team:acme:')],
            [projects('team:globex:eng')],
          ),
          'resource:u-1': read(['resource:u-1']),
          'thread:t-1': read(['thread:t-1']),
        };
        const seen: number[] = [];
        for (const [name, r] of Object.entries(reads)) {
          const gettable = new Set<string>();
          for (const id of word.keys()) if (await store.getPage({ id, read: r })) gettable.add(id);
          const listed = new Set<string>();
          let cursor: string | undefined;
          do {
            const out = await store.listPages({ read: r, cursor, limit: 7 });
            for (const p of out.pages) if (word.has(p.id)) listed.add(p.id);
            cursor = out.nextCursor;
          } while (cursor);
          seen.push(gettable.size);
          expect({ name, listed: [...listed].sort() }).toEqual({ name, listed: [...gettable].sort() });
          for (const [id, unique] of word) {
            const found = (await store.searchPages({ query: unique, read: r })).some(hit => hit.page.id === id);
            expect({ name, id, found }).toEqual({ name, id, found: gettable.has(id) });
          }
        }
        // Not vacuous: nothing for no principals, and every read scope sees some pages but not all.
        expect(seen[0]).toBe(0);
        expect(seen.slice(1).every(n => n > 0 && n < word.size)).toBe(true);
      });

      it('reaches addresses whose next character sorts below a space by prefix', async () => {
        const bare = await scope('team:acme:', TEAM);
        const tab = await scope('team:acme:\teng', TEAM);
        const control = await scope('team:acme:\u0001ops', TEAM);
        const space = await scope('team:acme: sales', TEAM);
        const other = await scope('team:acmf:eng', TEAM);
        const r = read([], [{ declaration: TEAM, prefix: 'team:acme:' }]);
        const reached = [];
        for (const s of [bare, tab, control, space, other])
          if (await store.getPage({ id: s.id, read: r })) reached.push(s.id);
        expect(reached.sort()).toEqual([bare.id, tab.id, control.id, space.id].sort());
        const listed = (await store.listPages({ read: r, limit: 100 })).pages.map(p => p.id);
        expect(listed).not.toContain(other.id);
      });
    });

    describe('pages', () => {
      it('creates pages in their home scope, ordered by position, with name order for listPages', async () => {
        const acme = await scope('org:acme', ORG);
        const b = await page(acme.id, 'beta');
        const a = await page(acme.id, 'Alpha');
        const child = await page(b.id, 'child');
        expect(child).toMatchObject({ scopeId: acme.id, parentId: b.id, isScope: false, version: 1 });
        expect(child.createdBy).toEqual(alex);
        expect(ids((await store.listChildPages({ parentId: acme.id, read: 'all' })).pages)).toEqual([b.id, a.id]);
        // Binary code-unit order on the stored name: 'Alpha' < 'beta' < 'child'.
        expect(ids((await store.listPages({ read: 'all' })).pages)).toEqual([a.id, b.id, child.id]);
        expect(ids((await store.listPages({ read: 'all', namePrefix: 'AL' })).pages)).toEqual([a.id]);
        const first = await page(acme.id, 'first', { position: knowledgePositionBetween(undefined, b.position) });
        expect(ids((await store.listChildPages({ parentId: acme.id, read: 'all' })).pages)[0]).toBe(first.id);
      });

      it('refuses a duplicate key in one scope, depth past the cap, and an over-long description', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        await page(acme.id, 'one', { key: 'k' });
        await rejectsNamed(page(acme.id, 'two', { key: 'k' }), /already exists/);
        await expect(page(globex.id, 'two', { key: 'k' })).resolves.toMatchObject({ key: 'k' });

        let parent = acme.id;
        for (let depth = 1; depth <= MAX_KNOWLEDGE_PAGE_DEPTH; depth++) parent = (await page(parent, `d${depth}`)).id;
        await rejectsNamed(page(parent, 'too deep'), 'KnowledgePageDepthError');
        await rejectsNamed(page(acme.id, 'long', { description: 'word '.repeat(200) }), /token limit/);
      });

      it('updates with optimistic versions; an empty description clears it', async () => {
        const acme = await scope('org:acme', ORG);
        const created = await page(acme.id, 'p', { description: 'short' });
        const updated = await store.updatePage({
          id: created.id,
          expectedVersion: 1,
          name: 'renamed',
          description: '',
          body: 'long form',
          provenance: host,
        });
        expect(updated).toMatchObject({ name: 'renamed', body: 'long form', version: 2, updatedBy: host });
        expect(updated.description).toBeUndefined();
        await rejectsNamed(
          store.updatePage({ id: created.id, expectedVersion: 1, name: 'stale', provenance: host }),
          'KnowledgeConflictError',
        );
      });

      it('moves a subtree to another scope in one step', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const parent = await page(acme.id, 'parent');
        const child = await page(parent.id, 'child');
        const moved = await store.movePage({
          id: parent.id,
          expectedVersion: 1,
          parentId: globex.id,
          provenance: host,
        });
        expect(moved).toMatchObject({ parentId: globex.id, scopeId: globex.id, version: 2 });
        expect(await store.getPage({ id: child.id, read: read(['org:acme']) })).toBeNull();
        expect(await store.getPage({ id: child.id, read: read(['org:globex']) })).toMatchObject({ scopeId: globex.id });
      });

      it('refuses moving a scope page, into its own subtree, or past the depth cap', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const parent = await page(acme.id, 'parent');
        const child = await page(parent.id, 'child');
        await rejectsNamed(
          store.movePage({ id: acme.id, expectedVersion: 1, parentId: globex.id, provenance: host }),
          /scope/,
        );
        await rejectsNamed(
          store.movePage({ id: parent.id, expectedVersion: 1, parentId: child.id, provenance: host }),
          /subtree/,
        );

        let deep = globex.id;
        for (let depth = 1; depth < MAX_KNOWLEDGE_PAGE_DEPTH; depth++) deep = (await page(deep, `d${depth}`)).id;
        // parent+child is two levels; under a page at depth 9 it would reach 11.
        await rejectsNamed(
          store.movePage({ id: parent.id, expectedVersion: 1, parentId: deep, provenance: host }),
          'KnowledgePageDepthError',
        );
      });

      it(`refuses moving more than ${MAX_KNOWLEDGE_MOVE_PAGES} pages at once`, async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const root = await page(acme.id, 'root');
        for (let i = 0; i < MAX_KNOWLEDGE_MOVE_PAGES; i++) await page(root.id, `c${i}`);
        await rejectsNamed(
          store.movePage({ id: root.id, expectedVersion: 1, parentId: globex.id, provenance: host }),
          'KnowledgeMoveTooLargeError',
        );
        expect((await store.getPage({ id: root.id, read: 'all' }))!.scopeId).toBe(acme.id);
      });

      it("refuses a move that would duplicate a key among the new parent's children, changing nothing", async () => {
        const a = await scope('org:a', ORG);
        const b = await scope('org:b', ORG);
        const aPolicy = await page(a.id, 'A policy', { key: 'policy' });
        const bPolicy = await page(b.id, 'B policy', { key: 'policy' });
        const bParent = await page(b.id, 'B parent');
        const bChild = await page(bParent.id, 'B child', { key: 'policy' });

        await rejectsNamed(
          store.movePage({ id: bPolicy.id, expectedVersion: 1, parentId: a.id, provenance: host }),
          'KnowledgePageKeyConflictError',
        );
        await rejectsNamed(
          store.movePage({ id: bChild.id, expectedVersion: 1, parentId: b.id, provenance: host }),
          'KnowledgePageKeyConflictError',
        );
        expect(await store.getPage({ id: bPolicy.id, read: 'all' })).toMatchObject({ scopeId: b.id, version: 1 });
        expect(await store.getPage({ id: bChild.id, read: 'all' })).toMatchObject({ parentId: bParent.id, version: 1 });
        expect(await store.getPageByPath({ scopeId: a.id, path: ['policy'], read: 'all' })).toMatchObject({
          id: aPolicy.id,
        });

        // Descendants keep their parent, so a carried child's key never clashes; a page under another
        // parent may reuse a key; and a page never clashes with itself when reordered.
        await expect(
          store.movePage({ id: bParent.id, expectedVersion: 1, parentId: a.id, provenance: host }),
        ).resolves.toMatchObject({ parentId: a.id, scopeId: a.id });
        expect(await store.getPage({ id: bChild.id, read: 'all' })).toMatchObject({
          parentId: bParent.id,
          scopeId: a.id,
        });
        await expect(
          store.movePage({ id: bPolicy.id, expectedVersion: 1, parentId: aPolicy.id, provenance: host }),
        ).resolves.toMatchObject({ parentId: aPolicy.id, key: 'policy' });
        await expect(
          store.movePage({ id: aPolicy.id, expectedVersion: 1, parentId: a.id, provenance: host }),
        ).resolves.toMatchObject({ parentId: a.id, key: 'policy' });
      });

      it('counts only live pages toward move depth and carries deleted descendants along', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const parent = await page(acme.id, 'parent');
        const child = await page(parent.id, 'child');
        const grandchild = await page(child.id, 'grandchild');
        await store.deletePage({ id: grandchild.id, expectedVersion: 1, deletedBy: 'agent:alex' });

        let deep = globex.id;
        for (let depth = 1; depth <= MAX_KNOWLEDGE_PAGE_DEPTH - 2; depth++) deep = (await page(deep, `d${depth}`)).id;
        // Live parent+child land at depths 9 and 10; the deleted grandchild would be 11 and doesn't count.
        await store.movePage({ id: parent.id, expectedVersion: 1, parentId: deep, provenance: host });
        expect(await store.getPage({ id: child.id, read: 'all' })).toMatchObject({ scopeId: globex.id });
        expect(await store.getPage({ id: grandchild.id, read: 'all' })).toMatchObject({ scopeId: globex.id });
      });

      it('merges notes, child pages, pins and mentions into the target', async () => {
        const acme = await scope('org:acme', ORG);
        const source = await page(acme.id, 'Source');
        const target = await page(acme.id, 'Target');
        const other = await page(acme.id, 'Other');
        const sourceChild = await page(source.id, 'Source child');
        const sourceNote = await store.addNote({
          pageId: source.id,
          text: 'fact',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        const mentioning = await store.addNote({
          pageId: other.id,
          text: 'see [[Source]]',
          stampScopeIds: [acme.id],
          mentions: [source.id],
          provenance: alex,
        });
        await store.addPinAudience({ pageId: source.id, audience: ['org:acme'], createdBy: 'agent:alex' });
        await store.addPinAudience({ pageId: target.id, audience: ['team:acme:eng'], createdBy: 'agent:alex' });

        const merged = await store.mergePages({
          sourceId: source.id,
          sourceVersion: 1,
          targetId: target.id,
          provenance: host,
        });
        expect(merged.id).toBe(target.id);
        const gone = await store.getPage({ id: source.id, read: 'all' });
        expect(gone).toMatchObject({ mergedInto: target.id, version: 2 });
        expect(gone!.deletedAt).toBeInstanceOf(Date);
        expect((await store.getNote({ id: sourceNote.id, read: 'all' }))!.pageId).toBe(target.id);
        expect((await store.getNote({ id: mentioning.id, read: 'all' }))!.mentions).toEqual([target.id]);
        expect((await store.getPage({ id: sourceChild.id, read: 'all' }))!.parentId).toBe(target.id);
        const { pins } = await store.listPins({ audience: 'all', read: 'all' });
        expect(pins).toHaveLength(1);
        expect(pins[0]!.pageId).toBe(target.id);
        expect([...pins[0]!.audience].sort()).toEqual(['org:acme', 'team:acme:eng']);
        expect(ids((await store.listPages({ read: 'all' })).pages)).not.toContain(source.id);
      });

      it('refuses merging scope pages or into the source subtree', async () => {
        const acme = await scope('org:acme', ORG);
        const source = await page(acme.id, 'Source');
        const inside = await page(source.id, 'Inside');
        await rejectsNamed(
          store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: inside.id, provenance: host }),
          /subtree/,
        );
        await rejectsNamed(
          store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: acme.id, provenance: host }),
          /scope/,
        );
        await rejectsNamed(
          store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: source.id, provenance: host }),
          /subtree/,
        );
      });

      it("refuses a merge whose source children's keys clash with the target's children; the source's own key never does", async () => {
        const a = await scope('org:a', ORG);
        const b = await scope('org:b', ORG);
        const target = await page(a.id, 'Target');
        const targetChild = await page(target.id, 'Target policy', { key: 'policy' });
        const source = await page(b.id, 'Source');
        const sourceChild = await page(source.id, 'Source policy', { key: 'policy' });

        await rejectsNamed(
          store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance: host }),
          'KnowledgePageKeyConflictError',
        );
        expect(await store.getPage({ id: source.id, read: 'all' })).toMatchObject({ version: 1, scopeId: b.id });
        expect((await store.getPage({ id: source.id, read: 'all' }))!.deletedAt).toBeUndefined();
        expect(await store.getPage({ id: sourceChild.id, read: 'all' })).toMatchObject({
          parentId: source.id,
          scopeId: b.id,
        });

        // A key used elsewhere in the target's scope (not among its children) doesn't clash, nor does
        // the source's own key.
        await page(a.id, 'A policy-b', { key: 'policy-b' });
        const keyedSource = await page(b.id, 'Keyed source', { key: 'policy-b' });
        await page(keyedSource.id, 'Grandchild', { key: 'other' });
        await expect(
          store.mergePages({ sourceId: keyedSource.id, sourceVersion: 1, targetId: target.id, provenance: host }),
        ).resolves.toMatchObject({ id: target.id });
        expect(await store.getPage({ id: targetChild.id, read: 'all' })).toMatchObject({ parentId: target.id });
      });

      it('refuses a merge past the depth cap or carrying too many pages, changing nothing', async () => {
        const acme = await scope('org:acme', ORG);
        const globex = await scope('org:globex', ORG);
        const source = await page(acme.id, 'Source');
        const c1 = await page(source.id, 'c1');
        await page(c1.id, 'c2');
        let deep = globex.id;
        for (let depth = 1; depth < MAX_KNOWLEDGE_PAGE_DEPTH; depth++) deep = (await page(deep, `d${depth}`)).id;
        // The target sits at depth 9: c1 would land at 10, c2 at 11.
        await rejectsNamed(
          store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: deep, provenance: host }),
          'KnowledgePageDepthError',
        );
        expect(await store.getPage({ id: c1.id, read: 'all' })).toMatchObject({
          parentId: source.id,
          scopeId: acme.id,
        });

        const big = await page(acme.id, 'Big');
        const shallow = await page(globex.id, 'Shallow');
        for (let i = 0; i < MAX_KNOWLEDGE_MOVE_PAGES + 1; i++) await page(big.id, `b${i}`);
        await rejectsNamed(
          store.mergePages({ sourceId: big.id, sourceVersion: 1, targetId: shallow.id, provenance: host }),
          'KnowledgeMoveTooLargeError',
        );
        expect((await store.getPage({ id: big.id, read: 'all' }))!.deletedAt).toBeUndefined();
      });

      it('deletes only a page without live children, dropping its pin; scope pages never', async () => {
        const acme = await scope('org:acme', ORG);
        const parent = await page(acme.id, 'parent');
        const child = await page(parent.id, 'child');
        await store.addPinAudience({ pageId: child.id, audience: ['org:acme'], createdBy: 'agent:alex' });
        await rejectsNamed(
          store.deletePage({ id: parent.id, expectedVersion: 1, deletedBy: 'agent:alex' }),
          'KnowledgePageHasChildrenError',
        );
        await rejectsNamed(store.deletePage({ id: acme.id, expectedVersion: 1, deletedBy: 'agent:alex' }), /scope/);
        const deleted = await store.deletePage({ id: child.id, expectedVersion: 1, deletedBy: 'agent:alex' });
        expect(deleted).toMatchObject({ deletedBy: 'agent:alex', version: 2 });
        expect((await store.listPins({ audience: 'all', read: 'all' })).pins).toEqual([]);
        await expect(
          store.deletePage({ id: parent.id, expectedVersion: 1, deletedBy: 'agent:alex' }),
        ).resolves.toBeTruthy();
      });
    });

    describe('notes', () => {
      it('shows a note when its page is readable and any stamp scope is readable', async () => {
        const acme = await scope('org:acme', ORG);
        const team = await scope('team:acme:eng', TEAM, acme.id);
        const user = await scope('resource:u1', RESOURCE, acme.id);
        const p = await page(acme.id, 'Customer');
        const shared = await store.addNote({
          pageId: p.id,
          text: 'shared',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        const either = await store.addNote({
          pageId: p.id,
          text: 'either',
          stampScopeIds: [team.id, user.id],
          mentions: [],
          provenance: alex,
        });
        const userOnly = await store.addNote({
          pageId: p.id,
          text: 'private',
          stampScopeIds: [user.id],
          mentions: [],
          provenance: alex,
        });

        const listed = async (addresses: string[]) =>
          ids((await store.listNotes({ pageId: p.id, read: read(addresses) })).notes);
        expect(await listed(['org:acme'])).toEqual([shared.id]);
        expect(await listed(['org:acme', 'team:acme:eng'])).toEqual([shared.id, either.id]);
        expect(await listed(['org:acme', 'resource:u1'])).toEqual([shared.id, either.id, userOnly.id]);
        // The page's scope must be readable even when a stamp is.
        expect(await listed(['resource:u1'])).toEqual([]);
        expect(await store.getNote({ id: userOnly.id, read: read(['org:acme']) })).toBeNull();
      });

      it('hides a note whose resolved mention points into an unreadable scope, deleted or not', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const p = await page(acme.id, 'Public');
        const target = await page(secret.id, 'Hidden');
        const note = await store.addNote({
          pageId: p.id,
          text: 'see [[Hidden]]',
          stampScopeIds: [acme.id],
          mentions: [target.id],
          provenance: alex,
        });
        expect(await store.getNote({ id: note.id, read: read(['org:acme']) })).toBeNull();
        expect(await store.getNote({ id: note.id, read: read(['org:acme', 'org:secret']) })).not.toBeNull();
        await store.deletePage({ id: target.id, expectedVersion: 1, deletedBy: 'host' });
        expect(await store.getNote({ id: note.id, read: read(['org:acme']) })).toBeNull();
        const mentioning = await store.listNotesMentioning({
          pageId: target.id,
          read: read(['org:acme', 'org:secret']),
        });
        expect(ids(mentioning.notes)).toEqual([note.id]);
      });

      it('removes, restores and restamps notes with versions', async () => {
        const acme = await scope('org:acme', ORG);
        const user = await scope('resource:u1', RESOURCE);
        const p = await page(acme.id, 'p');
        const note = await store.addNote({
          pageId: p.id,
          text: 'fact',
          when: new Date('2026-01-02'),
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        expect(note).toMatchObject({ version: 1, provenance: alex, stampScopeIds: [acme.id] });
        expect(note.when).toEqual(new Date('2026-01-02'));

        const removed = await store.removeNote({ id: note.id, deletedBy: 'agent:alex', provenance: alex });
        expect(removed).toMatchObject({ version: 2, deletedBy: 'agent:alex' });
        expect(await store.getNote({ id: note.id, read: 'all' })).toBeNull();
        expect(await store.getNote({ id: note.id, read: 'all', includeDeleted: true })).toMatchObject({ id: note.id });
        expect((await store.listNotes({ pageId: p.id, read: 'all' })).notes).toEqual([]);
        expect(ids((await store.listNotes({ pageId: p.id, read: 'all', includeDeleted: true })).notes)).toEqual([
          note.id,
        ]);
        // Removing it again is refused, as if it weren't there, and changes nothing.
        await expect(
          store.removeNote({ id: note.id, deletedBy: 'agent:alex', provenance: alex }),
        ).rejects.toMatchObject({ name: 'KnowledgeNotFoundError' });
        expect((await store.getNote({ id: note.id, read: 'all', includeDeleted: true }))?.version).toBe(2);

        const restored = await store.restoreNote({ id: note.id, provenance: host });
        expect(restored.version).toBe(3);
        expect(restored.deletedAt).toBeUndefined();
        const restamped = await store.restampNote({
          id: note.id,
          expectedVersion: 3,
          stampScopeIds: [user.id],
          provenance: host,
        });
        expect(restamped).toMatchObject({ version: 4, stampScopeIds: [user.id] });
        await rejectsNamed(
          store.restampNote({ id: note.id, expectedVersion: 3, stampScopeIds: [acme.id], provenance: host }),
          'KnowledgeConflictError',
        );
      });

      it('refuses empty stamps, non-scope stamps and over-long text', async () => {
        const acme = await scope('org:acme', ORG);
        const p = await page(acme.id, 'p');
        await rejectsNamed(
          store.addNote({ pageId: p.id, text: 'x', stampScopeIds: [], mentions: [], provenance: alex }),
          /stamp/,
        );
        await rejectsNamed(
          store.addNote({ pageId: p.id, text: 'x', stampScopeIds: [p.id], mentions: [], provenance: alex }),
          /stamp/,
        );
        await rejectsNamed(
          store.addNote({
            pageId: p.id,
            text: 'word '.repeat(400),
            stampScopeIds: [acme.id],
            mentions: [],
            provenance: alex,
          }),
          /token limit/,
        );
      });
    });

    describe('search and activity', () => {
      it('searches readable pages and visible notes only', async () => {
        const acme = await scope('org:acme', ORG);
        const user = await scope('resource:u1', RESOURCE);
        const p = await page(acme.id, 'Billing', { body: 'invoices go out monthly' });
        const q = await page(acme.id, 'Support');
        const note = await store.addNote({
          pageId: q.id,
          text: 'Invoices are emailed',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        await store.addNote({
          pageId: q.id,
          text: 'invoice dispute for u1',
          stampScopeIds: [user.id],
          mentions: [],
          provenance: alex,
        });
        const hits = await store.searchPages({ query: 'INVOICE', read: read(['org:acme']) });
        expect(hits.map(hit => (hit.type === 'page' ? `page:${hit.page.id}` : `note:${hit.note.id}`))).toEqual([
          `page:${p.id}`,
          `note:${note.id}`,
        ]);
        expect(await store.searchPages({ query: 'invoice', read: read(['org:acme']), scopeIds: [user.id] })).toEqual(
          [],
        );
      });

      it('matches any query word, ranking phrase-in-name, then words matched, then weight name > description > body, then notes', async () => {
        const acme = await scope('org:acme', ORG);
        await scope('org:refund', ORG);
        const pause = () => new Promise(resolve => setTimeout(resolve, 15));
        const phrase = await page(acme.id, 'Refund approval rules');
        await pause();
        const scattered = await page(acme.id, 'Approval of a refund');
        await pause();
        const acrossFields = await page(acme.id, 'Refunds', { description: 'Who gives APPROVAL' });
        await pause();
        const inBody = await page(acme.id, 'Billing', { body: 'Each refund requires approval from finance.' });
        await pause();
        const nameOnly = await page(acme.id, 'Refund window');
        await pause();
        await page(acme.id, 'Unrelated', { body: 'Window cleaning schedule.' });
        const noteBoth = await store.addNote({
          pageId: nameOnly.id,
          text: 'Every refund needs approval.',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        await store.addNote({
          pageId: nameOnly.id,
          text: 'Approval is logged.',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        const r = read(['org:acme', 'org:refund']);
        const label = (hit: Awaited<ReturnType<typeof store.searchPages>>[number]) =>
          hit.type === 'page' ? `page:${hit.page.name}` : `note:${hit.note.text}`;

        // Any word matches. Pages first: the phrase in the name, then most words matched, then points (a
        // matched word earns 3 in the name, else 2 in the description, else 1 in the body), newest first on
        // ties; so both words in the body beat one word in the name. Then notes by words matched. 'Refund window' matches on "refund" alone; scope pages (org:refund) never hit.
        expect((await store.searchPages({ query: '  refund   APPROVAL ', read: r })).map(label)).toEqual([
          `page:${phrase.name}`,
          `page:${scattered.name}`,
          `page:${acrossFields.name}`,
          `page:${inBody.name}`,
          `page:${nameOnly.name}`,
          `note:${noteBoth.text}`,
          'note:Approval is logged.',
        ]);
        expect((await store.searchPages({ query: 'refund approval', read: r, limit: 2 })).map(label)).toEqual([
          `page:${phrase.name}`,
          `page:${scattered.name}`,
        ]);
        // One word: substring, case-insensitive ("refund" matches "Refunds"), newest first per tier.
        expect((await store.searchPages({ query: 'REFUND', read: r })).map(label)).toEqual([
          `page:${nameOnly.name}`,
          `page:${acrossFields.name}`,
          `page:${scattered.name}`,
          `page:${phrase.name}`,
          `page:${inBody.name}`,
          `note:${noteBoth.text}`,
        ]);
        expect(await store.searchPages({ query: '   ', read: r })).toEqual([]);
        // Repeated words count once for matching.
        expect((await store.searchPages({ query: 'refund approval refund', read: r })).map(label)).toHaveLength(7);
        expect((await store.searchPages({ query: 'approval  RULES', read: r })).map(label).slice(0, 1)).toEqual([
          `page:${phrase.name}`,
        ]);
      });

      it('ranks by words matched, then field weight, then recency, and never returns pages that match no word', async () => {
        const acme = await scope('org:acme', ORG);
        const pause = () => new Promise(resolve => setTimeout(resolve, 15));
        const inName = await page(acme.id, 'Zebra care');
        await pause();
        const inDescription = await page(acme.id, 'Stripes', { description: 'About a zebra' });
        await pause();
        const bothInBody = await page(acme.id, 'Safari', { body: 'A zebra and a giraffe walk by.' });
        await pause();
        const oneInBody = await page(acme.id, 'Savanna', { body: 'A giraffe grazes.' });
        await pause();
        await page(acme.id, 'Penguins', { body: 'Cold weather birds.' });
        const label = (hit: Awaited<ReturnType<typeof store.searchPages>>[number]) =>
          hit.type === 'page' ? hit.page.name : hit.note.text;
        const r = read(['org:acme']);
        // Words matched first, then points, then newest. Safari matches 2 words (zebra, giraffe), the others 1:
        // Zebra care 3 points, Stripes 2, Savanna 1. Two body words beat one name word.
        expect((await store.searchPages({ query: 'zebra giraffe lion', read: r })).map(label)).toEqual([
          bothInBody.name,
          inName.name,
          inDescription.name,
          oneInBody.name,
        ]);
        // Same word count: name beats description beats body, though the body page is newer.
        expect((await store.searchPages({ query: 'zebra', read: r })).map(label)).toEqual([
          inName.name,
          inDescription.name,
          bothInBody.name,
        ]);
        // Equal points: newest first, and the limit applies after ranking.
        expect((await store.searchPages({ query: 'giraffe', read: r, limit: 1 })).map(label)).toEqual([oneInBody.name]);
      });

      it('ranks the page that has every query word above newer pages that match one word in their name', async () => {
        const acme = await scope('org:acme', ORG);
        const pause = () => new Promise(resolve => setTimeout(resolve, 15));
        // The podcast page names none of the words but contains all three in its body.
        const podcast = await page(acme.id, 'Opus 5.5 launches: is Anthropic back?', {
          body: 'Peter Steinberger, creator of OpenClaw, joins the show.',
        });
        await pause();
        const peter = await page(acme.id, 'Peter profile', { body: 'Bio.' });
        await pause();
        const steinberger = await page(acme.id, 'Steinberger interview', { body: 'Notes.' });
        await pause();
        const openclaw = await page(acme.id, 'OpenClaw roadmap', { body: 'Plans.' });
        const names = async (query: string) =>
          (await store.searchPages({ query, read: read(['org:acme']) })).map(hit =>
            hit.type === 'page' ? hit.page.name : hit.note.text,
          );
        expect(await names('Peter Steinberger OpenClaw')).toEqual([
          podcast.name,
          openclaw.name,
          steinberger.name,
          peter.name,
        ]);
      });

      it('uses only the first 16 distinct words of a long query', async () => {
        const acme = await scope('org:acme', ORG);
        const early = await page(acme.id, 'Alpha guide', { body: 'Body.' });
        await page(acme.id, 'Zulu guide', { body: 'Body.' });
        const filler = Array.from({ length: 15 }, (_, i) => `filler${i}`).join(' ');
        const hits = await store.searchPages({ query: `alpha ${filler} zulu`, read: read(['org:acme']) });
        expect(hits.map(hit => (hit.type === 'page' ? hit.page.name : hit.note.text))).toEqual([early.name]);
      });

      it('never counts a hidden note toward search results or the limit', async () => {
        const acme = await scope('org:acme', ORG);
        const user = await scope('resource:u1', RESOURCE);
        const p = await page(acme.id, 'Launch');
        const pause = () => new Promise(resolve => setTimeout(resolve, 15));
        const visible = await store.addNote({
          pageId: p.id,
          text: 'launch checklist approved',
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
        await pause();
        await store.addNote({
          pageId: p.id,
          text: 'launch checklist private draft',
          stampScopeIds: [user.id],
          mentions: [],
          provenance: alex,
        });
        const hits = await store.searchPages({ query: 'checklist private', read: read(['org:acme']), limit: 1 });
        expect(hits.map(hit => (hit.type === 'note' ? hit.note.id : hit.page.id))).toEqual([visible.id]);
      });

      it('treats % and _ in the query as literal characters', async () => {
        const acme = await scope('org:acme', ORG);
        const percent = await page(acme.id, 'Discount 50% off');
        const underscore = await page(acme.id, 'Flag a_b');
        await page(acme.id, 'Discount 500 off');
        await page(acme.id, 'Flag axb');
        const r = read(['org:acme']);
        const ids = async (query: string) =>
          (await store.searchPages({ query, read: r })).map(hit => (hit.type === 'page' ? hit.page.id : hit.note.id));
        expect(await ids('50%')).toEqual([percent.id]);
        expect(await ids('a_b')).toEqual([underscore.id]);
        // "off" also matches 'Discount 500 off', but 50% (literal) and off both match only the first.
        expect((await ids('off 50%'))[0]).toBe(percent.id);
        expect(await ids('off 50%')).toHaveLength(2);
      });

      it('moves merged source history to the target scope, without retaining source-scope visibility', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const source = await page(acme.id, 'Source');
        const target = await page(secret.id, 'Target');
        const sourceRead = read(['org:acme']);
        const targetRead = read(['org:secret']);
        expect(
          (await store.listPageActivity({ read: sourceRead, pageId: source.id })).events.map(e => e.action),
        ).toEqual(['page-created']);
        expect((await store.listPageActivity({ read: targetRead, pageId: source.id })).events).toEqual([]);

        await store.mergePages({ sourceId: source.id, sourceVersion: 1, targetId: target.id, provenance: host });

        expect(await store.getPage({ id: source.id, read: 'all' })).toMatchObject({
          scopeId: secret.id,
          mergedInto: target.id,
        });
        expect(await store.getPage({ id: source.id, read: sourceRead })).toBeNull();
        expect((await store.listPageActivity({ read: sourceRead, pageId: source.id })).events).toEqual([]);
        expect(
          (await store.listPageActivity({ read: targetRead, pageId: source.id })).events.map(e => e.action),
        ).toEqual(['page-merged', 'page-created']);
      });

      it('filters activity by the page and note as they are now', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const p = await page(acme.id, 'p');
        const user = await scope('resource:u1', RESOURCE);
        await store.addNote({
          pageId: p.id,
          text: 'private',
          stampScopeIds: [user.id],
          mentions: [],
          provenance: alex,
        });
        const acmeRead = read(['org:acme']);
        const actions = async () =>
          (await store.listPageActivity({ read: acmeRead, pageId: p.id })).events.map(e => e.action);
        expect(await actions()).toEqual(['page-created']);
        expect(
          (await store.listPageActivity({ read: read(['org:acme', 'resource:u1']), pageId: p.id })).events.map(
            e => e.action,
          ),
        ).toEqual(['note-added', 'page-created']);
        await store.movePage({ id: p.id, expectedVersion: 1, parentId: secret.id, provenance: host });
        expect(await actions()).toEqual([]);
        const all = await store.listPageActivity({ read: 'all', pageId: p.id });
        expect(all.events[0]).toMatchObject({ action: 'page-moved', scopeId: secret.id, provenance: host });
      });
    });

    describe('pins', () => {
      it('keeps one pin per page and lists by audience on readable live pages', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const p = await page(acme.id, 'p');
        const hidden = await page(secret.id, 'hidden');
        const first = await store.addPinAudience({ pageId: p.id, audience: ['org:acme'], createdBy: 'agent:alex' });
        const second = await store.addPinAudience({
          pageId: p.id,
          audience: ['team:acme:eng', 'org:acme'],
          createdBy: 'agent:bo',
        });
        expect(second.id).toBe(first.id);
        expect([...second.audience].sort()).toEqual(['org:acme', 'team:acme:eng']);
        await store.addPinAudience({ pageId: hidden.id, audience: ['org:acme'], createdBy: 'agent:alex' });

        const acmeRead = read(['org:acme']);
        const listed = async (audience: string[] | 'all', pageIds?: string[]) =>
          (await store.listPins({ audience, read: acmeRead, pageIds })).pins.map(pin => pin.pageId);
        expect(await listed(['team:acme:eng'])).toEqual([p.id]);
        expect(await listed(['resource:u1'])).toEqual([]);
        expect(await listed('all')).toEqual([p.id]);
        expect(await listed('all', [hidden.id])).toEqual([]);

        expect(
          await store.removePinAudience({ pageId: p.id, audience: ['org:acme'], removedBy: 'agent:alex' }),
        ).toMatchObject({
          audience: ['team:acme:eng'],
        });
        expect(
          await store.removePinAudience({ pageId: p.id, audience: ['team:acme:eng'], removedBy: 'agent:alex' }),
        ).toBeNull();
        expect(await listed('all')).toEqual([]);
      });

      it('keeps a page pin and a list pin per page apart, with the list depth, through listing, merge and delete', async () => {
        const acme = await scope('org:acme', ORG);
        const p = await page(acme.id, 'P', { body: '' });
        const target = await page(acme.id, 'Target', { body: 'Target.' });
        const pagePin = await store.addPinAudience({ pageId: p.id, audience: ['org:acme'], createdBy: 'agent:alex' });
        expect(pagePin).toMatchObject({ kind: 'page', pageId: p.id });
        expect(pagePin.depth).toBeUndefined();
        const listPin = await store.addPinAudience({
          pageId: p.id,
          kind: 'list',
          audience: ['team:acme:eng'],
          createdBy: 'agent:alex',
        });
        expect(listPin).toMatchObject({ kind: 'list', depth: 1, audience: ['team:acme:eng'] });
        expect(listPin.id).not.toBe(pagePin.id);
        // Pinning again adds audience and sets the new depth; the page pin is untouched.
        const deeper = await store.addPinAudience({
          pageId: p.id,
          kind: 'list',
          depth: 3,
          audience: ['org:acme'],
          createdBy: 'agent:bo',
        });
        expect(deeper.id).toBe(listPin.id);
        expect(deeper.depth).toBe(3);
        expect([...deeper.audience].sort()).toEqual(['org:acme', 'team:acme:eng']);

        const acmeRead = read(['org:acme']);
        const kinds = async (input: Partial<Parameters<typeof store.listPins>[0]> = {}) =>
          (await store.listPins({ audience: ['org:acme'], read: acmeRead, ...input })).pins
            .map(pin => `${pin.kind}:${pin.pageId}:${pin.depth ?? '-'}`)
            .sort();
        expect(await kinds()).toEqual([`list:${p.id}:3`, `page:${p.id}:-`]);
        expect(await kinds({ kind: 'list' })).toEqual([`list:${p.id}:3`]);
        expect(await kinds({ kind: 'page' })).toEqual([`page:${p.id}:-`]);
        // withBody and excludePageIds leave list pins alone.
        expect(await kinds({ withBody: true })).toEqual([`list:${p.id}:3`]);
        expect(await kinds({ excludePageIds: [p.id] })).toEqual([`list:${p.id}:3`]);
        expect((await store.listPins({ audience: ['org:acme'], read: acmeRead, count: true })).total).toBe(2);

        // Removing from one kind leaves the other.
        expect(
          await store.removePinAudience({ pageId: p.id, audience: ['org:acme'], removedBy: 'agent:alex' }),
        ).toBeNull();
        expect(await kinds()).toEqual([`list:${p.id}:3`]);

        // A merge moves each kind onto the target's pin of that kind.
        await store.addPinAudience({ pageId: target.id, kind: 'list', audience: ['resource:u1'], createdBy: 'a' });
        await store.addPinAudience({ pageId: p.id, audience: ['org:acme'], createdBy: 'a' });
        await store.mergePages({ sourceId: p.id, sourceVersion: p.version, targetId: target.id, provenance: host });
        const merged = (await store.listPins({ audience: 'all', read: 'all' })).pins
          .map(pin => [pin.kind, pin.pageId, [...pin.audience].sort()])
          .sort();
        expect(merged).toEqual([
          ['list', target.id, ['org:acme', 'resource:u1', 'team:acme:eng']],
          ['page', target.id, ['org:acme']],
        ]);

        // Deleting the page drops both.
        const live = (await store.getPage({ id: target.id, read: 'all' }))!;
        await store.deletePage({ id: target.id, expectedVersion: live.version, deletedBy: 'host' });
        expect((await store.listPins({ audience: 'all', read: 'all' })).pins).toEqual([]);
      });

      it('lists pins with page names, newest first, filtered by body and excluded pages, with a total', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const pinned: Array<{ id: string }> = [];
        for (const [name, body] of [
          ['Empty', ''],
          ['Blank', '  \n '],
          ['Refunds', 'Refund within 30 days.'],
          ['Shipping', 'Ships in 2 days.'],
          ['Returns', 'Return with a label.'],
        ] as const) {
          const p = await page(acme.id, name, { body });
          await store.addPinAudience({ pageId: p.id, audience: ['org:acme'], createdBy: 'agent:alex' });
          pinned.push(p);
          await new Promise(resolve => setTimeout(resolve, 15));
        }
        const hidden = await page(secret.id, 'Hidden', { body: 'Secret.' });
        await store.addPinAudience({ pageId: hidden.id, audience: ['org:acme'], createdBy: 'agent:alex' });
        const [, , refunds, shipping, returns] = pinned;
        const acmeRead = read(['org:acme']);

        const all = await store.listPins({ audience: ['org:acme'], read: acmeRead, withBody: true, count: true });
        expect(all.pins.map(pin => [pin.pageId, pin.pageName])).toEqual([
          [returns!.id, 'Returns'],
          [shipping!.id, 'Shipping'],
          [refunds!.id, 'Refunds'],
        ]);
        expect(all.total).toBe(3);

        const first = await store.listPins({
          audience: ['org:acme'],
          read: acmeRead,
          withBody: true,
          excludePageIds: [returns!.id],
          limit: 1,
          count: true,
        });
        expect(first.pins.map(pin => pin.pageId)).toEqual([shipping!.id]);
        expect(first.total).toBe(2);
        expect(first.nextCursor).toBeDefined();
        const rest = await store.listPins({
          audience: ['org:acme'],
          read: acmeRead,
          withBody: true,
          excludePageIds: [returns!.id],
          cursor: first.nextCursor,
        });
        expect(rest.pins.map(pin => pin.pageId)).toEqual([refunds!.id]);

        const both = await page(acme.id, 'Both', { body: 'Pinned for two audiences.' });
        await store.addPinAudience({
          pageId: both.id,
          audience: ['org:acme', 'team:acme:eng'],
          createdBy: 'agent:alex',
        });
        const twice = await store.listPins({
          audience: ['org:acme', 'team:acme:eng'],
          read: acmeRead,
          pageIds: [both.id],
          count: true,
        });
        expect(twice.pins.map(pin => pin.pageId)).toEqual([both.id]);
        expect(twice.total).toBe(1);
        await store.removePinAudience({
          pageId: both.id,
          audience: ['org:acme', 'team:acme:eng'],
          removedBy: 'agent:alex',
        });

        const plain = await store.listPins({ audience: ['org:acme'], read: acmeRead });
        expect(plain.pins).toHaveLength(5);
        expect(plain.total).toBeUndefined();
      });

      it('gets readable live pages by id in one call', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const a = await page(acme.id, 'a', { body: 'A' });
        const b = await page(acme.id, 'b');
        const gone = await page(acme.id, 'gone');
        await store.deletePage({ id: gone.id, expectedVersion: gone.version, deletedBy: 'agent:alex' });
        const hidden = await page(secret.id, 'hidden');
        const got = await store.getPages({
          ids: [a.id, b.id, a.id, gone.id, hidden.id, 'missing'],
          read: read(['org:acme']),
        });
        expect(got.map(p => p.id).sort()).toEqual([a.id, b.id].sort());
        expect(got.find(p => p.id === a.id)?.body).toBe('A');
        expect(await store.getPages({ ids: [], read: read(['org:acme']) })).toEqual([]);
      });

      it('counts the notes a reader can see on each page in one call', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const a = await page(acme.id, 'a');
        const b = await page(acme.id, 'b');
        const empty = await page(acme.id, 'empty');
        const note = (pageId: string, stampScopeIds: string[], mentions: string[] = []) =>
          store.addNote({ pageId, text: 'fact', stampScopeIds, mentions, provenance: alex });
        await note(a.id, [acme.id]);
        await note(a.id, [acme.id, secret.id]);
        await note(a.id, [secret.id]);
        const removed = await note(a.id, [acme.id]);
        await store.removeNote({ id: removed.id, deletedBy: 'agent:alex', provenance: alex });
        await note(b.id, [acme.id]);
        // Visible stamp, but it mentions a page the reader can't see.
        await note(b.id, [acme.id], [(await page(secret.id, 'hidden')).id]);

        expect(
          await store.countNotes({ pageIds: [a.id, b.id, a.id, empty.id, 'missing'], read: read(['org:acme']) }),
        ).toEqual({ [a.id]: 2, [b.id]: 1, [empty.id]: 0, missing: 0 });
        expect(await store.countNotes({ pageIds: [a.id], read: read(['org:acme', 'org:secret']) })).toEqual({
          [a.id]: 3,
        });
        expect(await store.countNotes({ pageIds: [], read: read(['org:acme']) })).toEqual({});
      });

      it('counts the child pages a reader can see under each parent in one call', async () => {
        const acme = await scope('org:acme', ORG);
        const team = await scope('team:acme:support', ORG, acme.id);
        const guides = await page(acme.id, 'guides');
        await page(guides.id, 'install');
        await page(guides.id, 'login');
        const gone = await page(guides.id, 'gone');
        await store.deletePage({ id: gone.id, expectedVersion: gone.version, deletedBy: 'agent:alex' });
        const leaf = await page(acme.id, 'leaf');
        await page(team.id, 'roster');

        // Child scopes are not child pages; deleted pages don't count.
        expect(
          await store.countChildPages({
            parentIds: [acme.id, guides.id, guides.id, leaf.id, 'missing'],
            read: read(['org:acme', 'team:acme:support']),
          }),
        ).toEqual({ [acme.id]: 2, [guides.id]: 2, [leaf.id]: 0, missing: 0 });
        // A reader who can't read the child scope sees none of its pages.
        expect(await store.countChildPages({ parentIds: [team.id], read: read(['org:acme']) })).toEqual({
          [team.id]: 0,
        });
        expect(await store.countChildPages({ parentIds: [], read: read(['org:acme']) })).toEqual({});
      });
    });

    describe('links', () => {
      const ACME = read(['org:acme']);
      const BOTH = read(['org:acme', 'org:secret']);
      const body = (toPageId: string | null, ref: string, count = 1) => ({ ref, toPageId, count });
      const sorted = (values: string[]) => [...values].sort();

      it('replaces a page body links and lists them out and in, one edge per page pair', async () => {
        const acme = await scope('org:acme', ORG);
        const a = await page(acme.id, 'a');
        const b = await page(acme.id, 'b');
        const c = await page(acme.id, 'c');
        await store.replacePageBodyLinks({
          pageId: a.id,
          links: [body(b.id, 'b', 2), body(c.id, 'org:acme#c'), body(null, 'nowhere')],
        });
        await store.replacePageBodyLinks({ pageId: b.id, links: [body(c.id, 'c')] });

        expect(await store.listPageLinks({ pageIds: [a.id], read: ACME, direction: 'out' })).toEqual(
          [
            { fromPageId: a.id, toPageId: b.id, kind: 'body', count: 2 },
            { fromPageId: a.id, toPageId: c.id, kind: 'body', count: 1 },
          ].sort((x, y) => (x.toPageId < y.toPageId ? -1 : 1)),
        );
        expect(await store.listPageLinks({ pageIds: [c.id], read: ACME, direction: 'in' })).toEqual(
          [
            { fromPageId: a.id, toPageId: c.id, kind: 'body', count: 1 },
            { fromPageId: b.id, toPageId: c.id, kind: 'body', count: 1 },
          ].sort((x, y) => (x.fromPageId < y.fromPageId ? -1 : 1)),
        );
        expect(await store.countPageLinks({ pageIds: [a.id, b.id, c.id, a.id, 'missing'], read: ACME })).toEqual({
          [a.id]: { in: 0, out: 2 },
          [b.id]: { in: 1, out: 1 },
          [c.id]: { in: 2, out: 0 },
          missing: { in: 0, out: 0 },
        });

        // Replacing drops what the new list leaves out; an empty list clears the page.
        await store.replacePageBodyLinks({ pageId: a.id, links: [body(c.id, 'c')] });
        expect(await store.countPageLinks({ pageIds: [a.id, b.id], read: ACME })).toEqual({
          [a.id]: { in: 0, out: 1 },
          [b.id]: { in: 0, out: 1 },
        });
        await store.replacePageBodyLinks({ pageId: a.id, links: [] });
        expect(await store.listPageLinks({ pageIds: [a.id], read: ACME })).toEqual([]);
        expect(await store.countPageLinks({ pageIds: [], read: ACME })).toEqual({});
        expect(await store.listPageLinks({ pageIds: [], read: ACME })).toEqual([]);
      });

      it('never counts or lists a link whose other end the reader cannot see', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const open = await page(acme.id, 'open');
        const hidden = await page(secret.id, 'hidden');
        await store.replacePageBodyLinks({ pageId: open.id, links: [body(hidden.id, 'hidden')] });
        await store.replacePageBodyLinks({ pageId: hidden.id, links: [body(open.id, 'open')] });

        expect(await store.countPageLinks({ pageIds: [open.id, hidden.id], read: ACME })).toEqual({
          [open.id]: { in: 0, out: 0 },
          // Unreadable ids look exactly like missing ones.
          [hidden.id]: { in: 0, out: 0 },
        });
        expect(await store.listPageLinks({ pageIds: [open.id, hidden.id], read: ACME })).toEqual([]);
        expect(await store.countPageLinks({ pageIds: [open.id], read: BOTH })).toEqual({
          [open.id]: { in: 1, out: 1 },
        });
        expect(await store.listPageLinks({ pageIds: [open.id], read: BOTH })).toHaveLength(2);
        // Prefix entries gate the same way as addresses.
        expect(
          await store.countPageLinks({ pageIds: [open.id], read: read([], [{ declaration: ORG, prefix: '' }]) }),
        ).toEqual({ [open.id]: { in: 1, out: 1 } });
      });

      it('hides links to and from deleted pages, and self-links', async () => {
        const acme = await scope('org:acme', ORG);
        const a = await page(acme.id, 'a');
        const b = await page(acme.id, 'b');
        const gone = await page(acme.id, 'gone');
        await store.replacePageBodyLinks({ pageId: a.id, links: [body(gone.id, 'gone'), body(a.id, 'a')] });
        await store.replacePageBodyLinks({ pageId: gone.id, links: [body(b.id, 'b')] });
        await store.deletePage({ id: gone.id, expectedVersion: gone.version, deletedBy: 'agent:alex' });

        expect(await store.countPageLinks({ pageIds: [a.id, b.id], read: ACME })).toEqual({
          [a.id]: { in: 0, out: 0 },
          [b.id]: { in: 0, out: 0 },
        });
        expect(await store.listPageLinks({ pageIds: [a.id, b.id, gone.id], read: ACME })).toEqual([]);
        // The rows stay until core clears them: the sources are still findable.
        expect(await store.listPageBodyLinkSources({ toPageIds: [gone.id] })).toEqual([a.id]);
      });

      it('counts note mentions as note links, only through notes the reader can see', async () => {
        const acme = await scope('org:acme', ORG);
        const secret = await scope('org:secret', ORG);
        const a = await page(acme.id, 'a');
        const b = await page(acme.id, 'b');
        const note = (pageId: string, stampScopeIds: string[], mentions: string[]) =>
          store.addNote({ pageId, text: 'fact', stampScopeIds, mentions, provenance: alex });
        await note(a.id, [acme.id], [b.id]);
        await note(a.id, [acme.id], [b.id]);
        // Stamped where the reader can't see it.
        await note(a.id, [secret.id], [b.id]);
        // Mentions a page the reader can't see, which hides the whole note.
        await note(a.id, [acme.id], [b.id, (await page(secret.id, 'hidden')).id]);
        const removed = await note(b.id, [acme.id], [a.id]);
        await store.removeNote({ id: removed.id, deletedBy: 'agent:alex', provenance: alex });
        await store.replacePageBodyLinks({ pageId: a.id, links: [body(b.id, 'b')] });

        expect(await store.listPageLinks({ pageIds: [a.id], read: ACME, direction: 'out' })).toEqual([
          { fromPageId: a.id, toPageId: b.id, kind: 'body', count: 1 },
          { fromPageId: a.id, toPageId: b.id, kind: 'note', count: 2 },
        ]);
        // Distinct pages: a body link and a note link to b count once.
        expect(await store.countPageLinks({ pageIds: [a.id, b.id], read: ACME })).toEqual({
          [a.id]: { in: 0, out: 1 },
          [b.id]: { in: 1, out: 0 },
        });
        expect(await store.countPageLinks({ pageIds: [a.id], read: ACME, kinds: ['note'] })).toEqual({
          [a.id]: { in: 0, out: 1 },
        });
        expect(await store.listPageLinks({ pageIds: [a.id], read: ACME, kinds: ['body'] })).toEqual([
          { fromPageId: a.id, toPageId: b.id, kind: 'body', count: 1 },
        ]);
        expect(
          (await store.listPageLinks({ pageIds: [b.id], read: BOTH, kinds: ['note'], direction: 'in' }))[0],
        ).toEqual({ fromPageId: a.id, toPageId: b.id, kind: 'note', count: 4 });
      });

      it('finds the source pages of unresolved refs and of links to given pages', async () => {
        const acme = await scope('org:acme', ORG);
        const a = await page(acme.id, 'a');
        const b = await page(acme.id, 'b');
        const c = await page(acme.id, 'c');
        await store.replacePageBodyLinks({ pageId: a.id, links: [body(null, 'later'), body(c.id, 'c')] });
        await store.replacePageBodyLinks({ pageId: b.id, links: [body(null, 'later'), body(null, 'org:acme#x')] });
        // A resolved row never matches by ref.
        await store.replacePageBodyLinks({ pageId: c.id, links: [body(a.id, 'later')] });

        expect(sorted(await store.listPageBodyLinkSources({ refs: ['later'] }))).toEqual(sorted([a.id, b.id]));
        expect(await store.listPageBodyLinkSources({ refs: ['org:acme#x', 'nothing'] })).toEqual([b.id]);
        expect(await store.listPageBodyLinkSources({ toPageIds: [c.id] })).toEqual([a.id]);
        expect(sorted(await store.listPageBodyLinkSources({ refs: ['org:acme#x'], toPageIds: [a.id] }))).toEqual(
          sorted([b.id, c.id]),
        );
        expect(await store.listPageBodyLinkSources({})).toEqual([]);
        expect(await store.listPageBodyLinkSources({ refs: [], toPageIds: [] })).toEqual([]);
      });

      it('caps listed edges at limit, in from, to, kind order', async () => {
        const acme = await scope('org:acme', ORG);
        const hub = await page(acme.id, 'hub');
        const spokes = [];
        for (let i = 0; i < 5; i++) spokes.push(await page(acme.id, `spoke ${i}`));
        await store.replacePageBodyLinks({ pageId: hub.id, links: spokes.map(s => body(s.id, s.name)) });

        const all = await store.listPageLinks({ pageIds: [hub.id], read: ACME });
        expect(all.map(edge => edge.toPageId)).toEqual(sorted(spokes.map(s => s.id)));
        expect(await store.listPageLinks({ pageIds: [hub.id], read: ACME, limit: 2 })).toEqual(all.slice(0, 2));
      });

      it('dangerouslyClearAll clears links', async () => {
        const acme = await scope('org:acme', ORG);
        const a = await page(acme.id, 'a');
        await store.replacePageBodyLinks({ pageId: a.id, links: [body(null, 'later')] });
        await store.dangerouslyClearAll();
        expect(await store.listPageBodyLinkSources({ refs: ['later'] })).toEqual([]);
      });
    });
  });
}
