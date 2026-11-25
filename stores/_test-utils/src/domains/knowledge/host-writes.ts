import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { MastraCompositeStore } from '@mastra/core/storage';
import type { KnowledgeStorage } from '@mastra/core/storage';
import { beforeEach, describe, expect, it } from 'vitest';

const faq = { scope: 'org:acme', path: 'guides/faq', name: 'FAQ' };
const conflict = { name: 'KnowledgeConflictError' };

/**
 * `Knowledge.upsertPage` with `expected` against a real adapter: it updates only the page the host
 * read, at the version it read, and refuses (writing nothing) once that page was edited, removed or
 * replaced by a new page at the same path. A parent page moved after the read is followed. `createStore` returns a fresh or cleared store each time.
 */
export function createKnowledgeHostWriteTests(createStore: () => Promise<KnowledgeStorage> | KnowledgeStorage): void {
  describe('Knowledge host writes with an expected page (schema 4)', () => {
    let store: KnowledgeStorage;
    let knowledge: Knowledge;

    beforeEach(async () => {
      store = await createStore();
      await store.init();
      await store.dangerouslyClearAll();
      const storage = new MastraCompositeStore({ id: 'host-writes', domains: { knowledge: store } });
      knowledge = new Knowledge({ storage, scopes: knowledgeMemoryScopes() });
    });

    it('fills the page it read, and refuses once someone else has written it', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'placeholder' });

      const filled = await knowledge.upsertPage({
        ...faq,
        body: 'See [[org:acme#guides]]',
        expected: { id: page.id, version: 1 },
      });
      expect(filled).toMatchObject({ status: 'updated', page: { id: page.id, version: 2 } });
      expect(await store.listPageLinks({ pageIds: [page.id], read: 'all', direction: 'out' })).toHaveLength(1);

      await knowledge.upsertPage({ ...faq, body: 'Agent notes', author: 'agent:a' });
      await expect(
        knowledge.upsertPage({ ...faq, body: 'imported', expected: { id: page.id, version: 2 } }),
      ).rejects.toMatchObject(conflict);
      expect((await store.getPage({ id: page.id, read: 'all' }))?.body).toBe('Agent notes');
    });

    it('refuses a different page that replaced it at the same path, also at version 1', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'placeholder' });
      await knowledge.removePage(faq);
      const replacement = await knowledge.upsertPage({ ...faq, body: 'Replacement' });
      expect(replacement.page.version).toBe(1);
      expect(replacement.page.id).not.toBe(page.id);

      await expect(
        knowledge.upsertPage({ ...faq, body: 'imported', expected: { id: page.id, version: 1 } }),
      ).rejects.toMatchObject(conflict);
      expect((await store.getPage({ id: replacement.page.id, read: 'all' }))?.body).toBe('Replacement');
    });

    it('follows the page it read when a parent page is moved between the read and the write', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'placeholder' });
      const archive = await knowledge.upsertPage({ scope: 'org:acme', path: 'archive', name: 'Archive' });
      const update = store.updatePage.bind(store);
      store.updatePage = async input => {
        store.updatePage = update;
        const guides = (await store.getPage({ id: page.parentId!, read: 'all' }))!;
        await store.movePage({
          id: guides.id,
          expectedVersion: guides.version,
          parentId: archive.page.id,
          provenance: { author: 'agent:a' },
        });
        return update(input);
      };

      const filled = await knowledge.upsertPage({ ...faq, body: 'imported', expected: { id: page.id, version: 1 } });
      expect(filled).toMatchObject({ status: 'updated', page: { id: page.id, version: 2, body: 'imported' } });
      const moved = await store.getPageByPath({
        scopeId: page.scopeId,
        path: ['archive', 'guides', 'faq'],
        read: 'all',
      });
      expect(moved?.id).toBe(page.id);
      expect(await knowledge.removePage(faq)).toBeNull();
      expect(await knowledge.removePage({ scope: 'org:acme', path: 'guides' })).toBeNull();
    });

    it('refuses a page edited or removed after its read, and creates nothing in its place', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'placeholder' });
      const update = store.updatePage.bind(store);
      store.updatePage = async input => {
        store.updatePage = update;
        await update({ id: page.id, expectedVersion: 1, body: 'Agent notes', provenance: { author: 'agent:a' } });
        return update(input);
      };
      await expect(
        knowledge.upsertPage({ ...faq, body: 'imported', expected: { id: page.id, version: 1 } }),
      ).rejects.toMatchObject(conflict);
      expect((await store.getPage({ id: page.id, read: 'all' }))?.body).toBe('Agent notes');

      store.updatePage = async input => {
        store.updatePage = update;
        // The page and its parent are removed between the host's read and its write.
        await store.deletePage({ id: page.id, expectedVersion: 2, deletedBy: 'agent:a' });
        const parent = (await store.getPage({ id: page.parentId!, read: 'all' }))!;
        await store.deletePage({ id: parent.id, expectedVersion: parent.version, deletedBy: 'agent:a' });
        return update(input);
      };
      await expect(
        knowledge.upsertPage({ ...faq, body: 'imported', expected: { id: page.id, version: 2 } }),
      ).rejects.toMatchObject(conflict);
      expect(await knowledge.removePage({ scope: 'org:acme', path: 'guides' })).toBeNull();
      expect(await knowledge.removePage(faq)).toBeNull();
    });

    it('removes the page it read, and refuses once someone else has written it or it was replaced', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'imported' });
      await knowledge.upsertPage({ ...faq, body: 'Agent notes', author: 'agent:a' });
      await expect(knowledge.removePage({ ...faq, expected: { id: page.id, version: 1 } })).rejects.toMatchObject(
        conflict,
      );
      expect((await store.getPage({ id: page.id, read: 'all' }))?.body).toBe('Agent notes');

      await knowledge.removePage(faq);
      const replacement = await knowledge.upsertPage({ ...faq, body: 'Replacement' });
      await expect(knowledge.removePage({ ...faq, expected: { id: page.id, version: 1 } })).rejects.toMatchObject(
        conflict,
      );
      expect((await store.getPage({ id: replacement.page.id, read: 'all' }))?.body).toBe('Replacement');

      const removed = await knowledge.removePage({ ...faq, expected: { id: replacement.page.id, version: 1 } });
      expect(removed?.id).toBe(replacement.page.id);
      expect((await store.getPage({ id: replacement.page.id, read: 'all' }))?.deletedAt).toBeTruthy();
      // Gone before the lookup, or never there: still a conflict, not `null`.
      const gone = { id: replacement.page.id, version: 1 };
      await expect(knowledge.removePage({ ...faq, expected: gone })).rejects.toMatchObject(conflict);
      await expect(knowledge.removePage({ scope: 'org:nobody', path: 'faq', expected: gone })).rejects.toMatchObject(
        conflict,
      );
    });

    it('refuses to remove a page written or removed between its read and the delete', async () => {
      const { page } = await knowledge.upsertPage({ ...faq, body: 'imported' });
      const remove = store.deletePage.bind(store);
      store.deletePage = async input => {
        store.deletePage = remove;
        // Another writer lands after the host read the page at version 1.
        await store.updatePage({
          id: page.id,
          expectedVersion: 1,
          body: 'Agent notes',
          provenance: { author: 'agent:a' },
        });
        return remove(input);
      };
      await expect(knowledge.removePage({ ...faq, expected: { id: page.id, version: 1 } })).rejects.toMatchObject(
        conflict,
      );
      expect((await store.getPage({ id: page.id, read: 'all' }))?.body).toBe('Agent notes');

      store.deletePage = async input => {
        store.deletePage = remove;
        await remove({ id: page.id, expectedVersion: 2, deletedBy: 'agent:a' });
        return remove(input);
      };
      await expect(knowledge.removePage({ ...faq, expected: { id: page.id, version: 2 } })).rejects.toMatchObject(
        conflict,
      );
    });
  });
}
