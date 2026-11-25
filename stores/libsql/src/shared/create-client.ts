import { createRequire } from 'node:module';
import type { Config, Client } from '@libsql/client';

const require = createRequire(import.meta.url);

// Keep constructors synchronous while loading the native binding only for URL
// configurations. Injected SqliteClient implementations do not need libsql.
export function createClient(config: Config): Client {
  const libsql: typeof import('@libsql/client') | undefined = require('@libsql/client');
  if (!libsql) {
    // Never runs. Bundlers such as the Mastra deployer trace import() but not
    // createRequire, so this keeps @libsql/client in bundled apps' dependencies.
    void import('@libsql/client');
    throw new Error('Failed to load @libsql/client');
  }
  return libsql.createClient(config);
}
