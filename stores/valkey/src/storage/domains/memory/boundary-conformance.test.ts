import { createMemoryTokenBoundaryConformanceTest } from '@internal/storage-test-utils';

import { GlideValkeyClient } from '../../../client';
import { StoreMemoryValkey } from './index';

const createClient = () =>
  new GlideValkeyClient({
    addresses: [{ host: '127.0.0.1', port: 6382 }],
    credentials: { username: 'default', password: 'valkey_password' },
  });

createMemoryTokenBoundaryConformanceTest({
  repetitions: 20,
  createStores: () => {
    const firstClient = createClient();
    const secondClient = createClient();
    return {
      first: new StoreMemoryValkey({ client: firstClient }),
      second: new StoreMemoryValkey({ client: secondClient }),
      cleanup: async () => {
        await Promise.all([firstClient.quit(), secondClient.quit()]);
      },
    };
  },
});
