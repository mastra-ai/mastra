import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';

import { createMemoryTokenBoundaryConformanceTest } from '@internal/storage-test-utils';
import { createClient } from '@libsql/client';

import { MemoryLibSQL } from '.';

createMemoryTokenBoundaryConformanceTest({
  repetitions: 20,
  createStores: async () => {
    const path = `/tmp/mastra-libsql-boundary-${randomUUID()}.db`;
    const firstClient = createClient({ url: `file:${path}` });
    const secondClient = createClient({ url: `file:${path}` });
    const first = new MemoryLibSQL({ client: firstClient });
    const second = new MemoryLibSQL({ client: secondClient });
    await first.init();
    await second.init();

    return {
      first,
      second,
      cleanup: async () => {
        firstClient.close();
        secondClient.close();
        await rm(path, { force: true });
      },
    };
  },
});
