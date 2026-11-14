import { createMergeResourceWorkingMemoryConcurrencyTests } from '@internal/storage-test-utils';
import { MongoClient } from 'mongodb';
import { MongoDBStore } from '../../index';

/**
 * Runs on whatever topology MONGODB_URL points at: standalone (default, localhost:27017) or the
 * replica set (`pnpm pretest:fidelity`, localhost:27019). The merge uses only single-document
 * conditional writes, so both must pass. Each store has its own client and connection pool.
 */
const URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';

createMergeResourceWorkingMemoryConcurrencyTests({
  label: 'MongoDB (three clients)',
  createStores: async () => {
    const dbName = `wm_merge_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const stores = Array.from({ length: 3 }, (_, i) => new MongoDBStore({ id: `wm-merge-${i}`, uri: URI, dbName }));
    await stores[0]!.init();
    await Promise.all(stores.slice(1).map(store => store.init()));
    return {
      stores: await Promise.all(stores.map(async store => (await store.getStore('memory'))!)),
      cleanup: async () => {
        const client = await MongoClient.connect(URI);
        await client.db(dbName).dropDatabase();
        await client.close();
        await Promise.all(stores.map(store => store.close().catch(() => {})));
      },
    };
  },
});
