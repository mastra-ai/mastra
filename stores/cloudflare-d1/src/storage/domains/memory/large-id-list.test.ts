import { createLargeIdListTests } from '@internal/storage-test-utils';
import { Miniflare } from 'miniflare';
import { beforeAll, vi } from 'vitest';

import { D1Store } from '../../index';

vi.setConfig({ testTimeout: 30000, hookTimeout: 30000 });

// In-memory D1 through Miniflare, the same harness binding-api.test.ts uses.
const mf = new Miniflare({
  modules: true,
  script: 'export default {};',
  d1Databases: { TEST_DB: ':memory:' },
});

const d1Database = await mf.getD1Database('TEST_DB');

const storage = new D1Store({
  id: 'd1-large-id-list',
  binding: d1Database,
  tablePrefix: 'large_list_',
});

beforeAll(async () => {
  await storage.init();
});

createLargeIdListTests({ storage });
