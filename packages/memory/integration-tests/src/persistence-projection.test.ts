import { randomUUID } from 'node:crypto';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach } from 'vitest';

import { testPersistenceProjection } from '../../src/persistence-projection.test-utils';

const stores: LibSQLStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map(store => store.close()));
});

testPersistenceProjection(async () => {
  const store = new LibSQLStore({ id: `projection-${randomUUID()}`, url: ':memory:' });
  stores.push(store);
  await store.init();
  return store;
});
