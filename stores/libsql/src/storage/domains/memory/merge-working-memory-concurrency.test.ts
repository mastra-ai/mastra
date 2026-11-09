import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createChildProcessMemoryStorage,
  createMergeResourceWorkingMemoryConcurrencyTests,
} from '@internal/storage-test-utils';

import { MemoryLibSQL } from './index';

// The `libsql` driver is synchronous: a connection waiting on SQLite's lock blocks its whole
// event loop, so two connections in one process cannot contend. Store B runs in a child process.
createMergeResourceWorkingMemoryConcurrencyTests({
  label: 'LibSQL (file, two processes)',
  createStores: async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wm-merge-'));
    const url = `file:${join(dir, 'wm.db')}`;
    const a = new MemoryLibSQL({ url });
    await a.init();
    const b = await createChildProcessMemoryStorage({
      modulePath: fileURLToPath(new URL('./index.ts', import.meta.url)),
      exportName: 'MemoryLibSQL',
      options: { url },
    });
    return {
      stores: [a, b.storage],
      cleanup: async () => {
        await b.close();
        rmSync(dir, { recursive: true, force: true });
      },
    };
  },
});
