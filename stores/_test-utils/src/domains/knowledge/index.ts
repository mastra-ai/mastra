import type { KnowledgeStorage } from '@mastra/core/storage';
import { KnowledgeSchemaResetRequiredError } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';

export interface KnowledgeSchemaResetFixture {
  store: KnowledgeStorage;
  snapshot: () => Promise<unknown>;
  assertResetResult: () => Promise<void>;
  cleanup: () => Promise<void>;
}

export function createKnowledgeSchemaResetTests(createFixture: () => Promise<KnowledgeSchemaResetFixture>): void {
  describe('knowledge schema reset contract', () => {
    it('rejects an incompatible schema without mutation until explicitly reset', async () => {
      const fixture = await createFixture();
      try {
        const before = await fixture.snapshot();
        expect(await fixture.store.inspectSchema()).toMatchObject({ status: 'incompatible-reset-required' });

        await expect(fixture.store.init()).rejects.toBeInstanceOf(KnowledgeSchemaResetRequiredError);
        expect(await fixture.snapshot()).toEqual(before);

        await fixture.store.dangerouslyReset();
        expect(await fixture.store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 4 });
        await fixture.assertResetResult();
      } finally {
        await fixture.cleanup();
      }
    });
  });
}

/**
 * Raw access to one database for the legacy-table upgrade contract. "Tables" are collections on
 * document stores. Every method works on the same database the stores from `createStore` use.
 */
export interface KnowledgeLegacyUpgradeFixture {
  /** A new store instance on the database, not yet initialized. */
  createStore: () => KnowledgeStorage;
  /** Drops every Knowledge table and leaves one non-Knowledge table holding one row. */
  clear: () => Promise<void>;
  /**
   * Creates the layout a published Knowledge (1.79/1.80) left behind: `mastra_knowledge_nodes`,
   * `_records`, `_semantic_outbox`, and the old-shaped `_mentions`, `_activity` and `_access_state`
   * (whose `knowledge` row says schema 2). With `rows`, each holds a row.
   */
  createPublishedLayout: (options: { rows: boolean }) => Promise<void>;
  /** What an older process does at init against a schema-4 database: creates `_nodes`, `_records`, `_semantic_outbox`, and puts a row in `_nodes`. */
  recreateLegacyTables: () => Promise<void>;
  /** Names of the `mastra_knowledge_*` tables present. */
  knowledgeTables: () => Promise<string[]>;
  /** Rows in the non-Knowledge table `clear` made. */
  otherTableRows: () => Promise<number>;
}

const LEGACY_ONLY = ['mastra_knowledge_nodes', 'mastra_knowledge_records', 'mastra_knowledge_semantic_outbox'];
const host = { author: 'host' };

/**
 * Old Knowledge (before schema 4) was an experimental store with no migration: init drops its
 * tables, rows included, and never touches schema-4 or non-Knowledge tables.
 */
export function createKnowledgeLegacyUpgradeTests(fixture: KnowledgeLegacyUpgradeFixture): void {
  describe('knowledge legacy table upgrade contract', () => {
    const expectUsable = async (store: KnowledgeStorage) => {
      expect(await store.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 4 });
      const { scope } = await store.materializeScope({
        address: 'org:acme',
        declaration: 'org:$orgId',
        name: 'Acme',
        provenance: host,
      });
      const page = await store.createPage({ parentId: scope.id, name: 'Policy', provenance: host });
      expect((await store.getPage({ id: page.id, read: 'all' }))?.name).toBe('Policy');
    };

    it('reports the schema-4 page store in its capabilities', () => {
      expect(fixture.createStore().getCapabilities()).toMatchObject({
        schemaVersion: 4,
        supportsSchemaInspection: true,
        supportsExplicitReset: true,
      });
    });

    for (const rows of [false, true]) {
      it(`drops a published layout ${rows ? 'holding rows' : 'with empty tables'} on init`, async () => {
        await fixture.clear();
        await fixture.createPublishedLayout({ rows });
        const store = fixture.createStore();
        await store.init();
        const tables = await fixture.knowledgeTables();
        for (const name of LEGACY_ONLY) expect(tables).not.toContain(name);
        await expectUsable(store);
        expect(await fixture.otherTableRows()).toBe(1);
      });
    }

    it('drops old tables an older process recreated on a schema-4 database, keeping every page', async () => {
      await fixture.clear();
      const first = fixture.createStore();
      await first.init();
      const { scope } = await first.materializeScope({
        address: 'org:acme',
        declaration: 'org:$orgId',
        name: 'Acme',
        provenance: host,
      });
      const page = await first.createPage({ parentId: scope.id, name: 'Kept', body: 'still here', provenance: host });

      await fixture.recreateLegacyTables();
      const next = fixture.createStore();
      await next.init();
      await next.init();
      const tables = await fixture.knowledgeTables();
      for (const name of LEGACY_ONLY) expect(tables).not.toContain(name);
      expect(await next.getPage({ id: page.id, read: 'all' })).toMatchObject({ name: 'Kept', body: 'still here' });
      expect(await next.inspectSchema()).toEqual({ status: 'compatible', schemaVersion: 4 });

      // The same thing again, as when old and new processes keep restarting during a rolling deploy.
      await fixture.recreateLegacyTables();
      await fixture.createStore().init();
      expect(await next.getPage({ id: page.id, read: 'all' })).toMatchObject({ name: 'Kept' });
      expect(await fixture.otherTableRows()).toBe(1);
    });

    it('lets several processes init over a published layout at once', async () => {
      await fixture.clear();
      await fixture.createPublishedLayout({ rows: true });
      const stores = Array.from({ length: 4 }, () => fixture.createStore());
      await Promise.all(stores.map(store => store.init()));
      const tables = await fixture.knowledgeTables();
      for (const name of LEGACY_ONLY) expect(tables).not.toContain(name);
      await expectUsable(stores[0]!);
      expect(await fixture.otherTableRows()).toBe(1);
    });
  });
}

export { createKnowledgePageStoreTests } from './pages';
