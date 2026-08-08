import { createMessagesListIncludeResourceScopeTest } from '@internal/storage-test-utils';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import { afterEach, beforeEach, describe } from 'vitest';

import { MemoryLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

describe('MemoryLibSQL', () => {
  let client: Client;
  let store: MemoryLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new MemoryLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
  });

  afterEach(() => {
    client.close();
  });

  createMessagesListIncludeResourceScopeTest({ getMemoryStorage: () => store });
});
