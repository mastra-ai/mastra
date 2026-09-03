import { createRequire } from 'node:module';
import type * as DuckDBNodeApi from '@duckdb/node-api';

/**
 * `@duckdb/node-api` resolves to platform-specific `.node` binaries via static
 * `require()` calls. Bundlers that pre-bundle dependencies (e.g. Vite's dep
 * optimizer, which TanStack Start also runs over server-only route imports)
 * follow a static `import` into those binaries and fail. `createRequire` is
 * opaque to bundlers, so the native module is only resolved at runtime in Node.
 */
const nodeApi: typeof DuckDBNodeApi = createRequire(import.meta.url)('@duckdb/node-api');

export const DuckDBInstance = nodeApi.DuckDBInstance;
export type DuckDBInstance = DuckDBNodeApi.DuckDBInstance;

export const DuckDBTimestampValue = nodeApi.DuckDBTimestampValue;
export type DuckDBTimestampValue = DuckDBNodeApi.DuckDBTimestampValue;

export const DuckDBTimestampTZValue = nodeApi.DuckDBTimestampTZValue;
export type DuckDBTimestampTZValue = DuckDBNodeApi.DuckDBTimestampTZValue;

export type { DuckDBPreparedStatement } from '@duckdb/node-api';
