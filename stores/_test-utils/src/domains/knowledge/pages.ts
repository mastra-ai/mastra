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
        const overview = await store.getPageByKey({ scopeId: first.scope.id, key: 'overview', read: 'all' });
        expect(overview).toMatchObject({ name: 'Overview', isScope: false, scopeId: first.scope.id });
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
        expect(await store.getPageByKey({ scopeId: account.id, key: 'overview', read: 'all' })).not.toBeNull();
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
        expect(await store.getPageByKey({ scopeId: globex.id, key: 'refunds', read: r })).toBeNull();
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

      it('refuses a move that would duplicate a key in the destination scope, changing nothing', async () => {
        const a = await scope('org:a', ORG);
        const b = await scope('org:b', ORG);
        const aPolicy = await page(a.id, 'A policy', { key: 'policy' });
        await page(a.id, 'A handbook', { key: 'handbook' });
        const bPolicy = await page(b.id, 'B policy', { key: 'policy' });
        const bParent = await page(b.id, 'B parent');
        const bChild = await page(bParent.id, 'B child', { key: 'handbook' });

        await rejectsNamed(
          store.movePage({ id: bPolicy.id, expectedVersion: 1, parentId: aPolicy.id, provenance: host }),
          'KnowledgePageKeyConflictError',
        );
        await rejectsNamed(
          store.movePage({ id: bParent.id, expectedVersion: 1, parentId: a.id, provenance: host }),
          'KnowledgePageKeyConflictError',
        );
        expect(await store.getPage({ id: bPolicy.id, read: 'all' })).toMatchObject({ scopeId: b.id, version: 1 });
        expect(await store.getPage({ id: bParent.id, read: 'all' })).toMatchObject({ scopeId: b.id, parentId: b.id });
        expect(await store.getPage({ id: bChild.id, read: 'all' })).toMatchObject({ scopeId: b.id });
        expect(await store.getPageByKey({ scopeId: a.id, key: 'policy', read: 'all' })).toMatchObject({
          id: aPolicy.id,
        });

        // Within one scope a key can't clash with itself.
        await expect(
          store.movePage({ id: bChild.id, expectedVersion: 1, parentId: b.id, provenance: host }),
        ).resolves.toMatchObject({ parentId: b.id, key: 'handbook' });
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

      it("refuses a merge whose carried pages' keys clash in the target scope; the source's own key never does", async () => {
        const a = await scope('org:a', ORG);
        const b = await scope('org:b', ORG);
        const aPolicy = await page(a.id, 'A policy', { key: 'policy' });
        const target = await page(a.id, 'Target');
        const source = await page(b.id, 'Source');
        const sourceChild = await page(source.id, 'Source child', { key: 'policy' });

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
        expect(await store.getPageByKey({ scopeId: a.id, key: 'policy', read: 'all' })).toMatchObject({
          id: aPolicy.id,
        });

        const keyedSource = await page(b.id, 'Keyed source', { key: 'policy-b' });
        await page(a.id, 'A policy-b', { key: 'policy-b' });
        await expect(
          store.mergePages({ sourceId: keyedSource.id, sourceVersion: 1, targetId: target.id, provenance: host }),
        ).resolves.toMatchObject({ id: target.id });
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
    });
  });
}
