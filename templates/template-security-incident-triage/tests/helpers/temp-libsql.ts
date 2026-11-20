import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createLibSqlOperationalStore } from '../../src/db/libsql-operational-store.js';
import type { OperationalStore } from '../../src/db/operational-store.js';

export type TempDatabase = Readonly<{
  directory: string;
  url: string;
  createStore(): OperationalStore;
  cleanup(): Promise<void>;
}>;

export async function createTempDatabase(): Promise<TempDatabase> {
  const temporaryRoot = await realpath(tmpdir());
  const prefix = join(temporaryRoot, 'security-incident-libsql-');
  const directory = await mkdtemp(prefix);
  const url = pathToFileURL(join(directory, 'operational.db')).href;
  return {
    directory,
    url,
    createStore: () => createLibSqlOperationalStore({ url }),
    cleanup: async () => {
      const root = temporaryRoot;
      const target = await realpath(directory);
      const childPath = relative(root, target);
      if (
        childPath.startsWith('..') ||
        childPath.includes(sep + '..' + sep) ||
        !target.startsWith(prefix) ||
        !childPath.startsWith('security-incident-libsql-')
      ) {
        throw new Error('Unsafe temporary database cleanup target');
      }
      await rm(target, { recursive: true, force: true });
    },
  };
}
