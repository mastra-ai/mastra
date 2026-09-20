import { describe, expect, it } from 'vitest';

import { PostgresStore } from './index';

const timeoutOptions = {
  connectionTimeoutMillis: 1_250,
  statement_timeout: 2_500,
  lock_timeout: 750,
  idle_in_transaction_session_timeout: 4_000,
} as const;

describe('PostgresStore native pool timeout options', () => {
  it('forwards timeout options for owned connection-string and host pools', async () => {
    const connectionStringStore = new PostgresStore({
      id: 'native-timeouts-connection-string',
      connectionString: 'postgresql://user:password@127.0.0.1:1/database?sslmode=require',
      ssl: { rejectUnauthorized: false },
      enabledDomains: ['memory'],
      disableInit: true,
      ...timeoutOptions,
    });
    const hostStore = new PostgresStore({
      id: 'native-timeouts-host',
      host: '127.0.0.1',
      port: 1,
      database: 'database',
      user: 'user',
      password: 'password',
      enabledDomains: ['memory'],
      disableInit: true,
      ...timeoutOptions,
    });

    try {
      for (const store of [connectionStringStore, hostStore]) {
        expect(store.pool.options).toMatchObject(timeoutOptions);
      }
      expect(connectionStringStore.pool.options.ssl).toEqual({ rejectUnauthorized: false });
    } finally {
      await Promise.all([connectionStringStore.close(), hostStore.close()]);
    }
  });
});
