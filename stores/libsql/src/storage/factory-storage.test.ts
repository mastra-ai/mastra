import { describeFactoryStorageContract } from '@internal/storage-test-utils';

import { LibSQLFactoryStorage } from './factory-storage';

describeFactoryStorageContract('libsql', async () => {
  const storage = new LibSQLFactoryStorage({ url: ':memory:' });
  return { storage, close: () => storage.close() };
});
