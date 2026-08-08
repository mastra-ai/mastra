import { createMessagesListIncludeResourceScopeTest } from '@internal/storage-test-utils';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, vi } from 'vitest';

import { connectionString } from '../../test-utils';
import { MemoryPG } from './index';

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

const SCHEMA_NAME = 'list_messages_include';

describe('MemoryPG', () => {
  let pool: Pool;
  let store: MemoryPG;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    store = new MemoryPG({ pool, schemaName: SCHEMA_NAME });
    await store.init();
  });

  afterAll(async () => {
    await pool.end();
  });

  createMessagesListIncludeResourceScopeTest({ getMemoryStorage: () => store });
});
