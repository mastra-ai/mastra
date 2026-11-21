import { createRequire } from 'node:module';
import type { Config, Client } from '@libsql/client';

const require = createRequire(import.meta.url);

// Keep constructors synchronous while loading the native binding only for URL
// configurations. Injected SqliteClient implementations do not need libsql.
export function createClient(config: Config): Client {
  const libsql: typeof import('@libsql/client') = require('@libsql/client');
  return libsql.createClient(config);
}
