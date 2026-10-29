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

export { createKnowledgePageStoreTests } from './pages';
