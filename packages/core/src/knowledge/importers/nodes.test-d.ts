import { expectTypeOf, test } from 'vitest';

import type { KnowledgeImportersStorage } from '../../storage/domains/knowledge/importers';

test('an importer store written before getNodes still satisfies the storage class', () => {
  // A required getNodes would make this fail with TS2741, breaking adapters that `implements` it.
  expectTypeOf<Omit<KnowledgeImportersStorage, 'getNodes'>>().toExtend<KnowledgeImportersStorage>();
});
