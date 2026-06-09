import type { ConnectionOptions } from 'node:tls';
import type { PoolConfig } from 'pg';
import { parse } from 'pg-connection-string';

/**
 * Builds the `pg.Pool` options for a connection-string based config.
 *
 * node-postgres re-parses `connectionString` via `pg-connection-string` and
 * `Object.assign`s the parsed result over any explicit options. As a result an
 * `sslmode=` / `ssl=` query param in the URL silently overrides an explicit
 * `ssl` object (e.g. `{ rejectUnauthorized: false }`), producing
 * `UNABLE_TO_GET_ISSUER_CERT_LOCALLY` against self-signed CAs even though the
 * caller asked to skip verification.
 *
 * To avoid that we parse the connection string ourselves and forward the
 * discrete fields, applying the explicit `ssl` last so it always wins. When no
 * explicit `ssl` is provided we keep whatever the URL implied (`sslmode=...`),
 * preserving backwards-compatible behaviour for connection-string-only SSL.
 *
 * @see https://github.com/mastra-ai/mastra/issues/17307
 */
export function buildConnectionStringPoolConfig(
  config: {
    connectionString: string;
    ssl?: ConnectionOptions | boolean;
    max?: number;
    idleTimeoutMillis?: number;
  },
  defaults: { max: number; idleTimeoutMillis: number },
): PoolConfig {
  // `parse` returns ports as strings and may include an `ssl` key derived from
  // the URL; `pg` accepts these discrete fields the same way it would the raw
  // string, minus the precedence quirk above.
  const parsed = parse(config.connectionString) as unknown as PoolConfig;

  return {
    ...parsed,
    ...(config.ssl !== undefined ? { ssl: config.ssl } : {}),
    max: config.max ?? defaults.max,
    idleTimeoutMillis: config.idleTimeoutMillis ?? defaults.idleTimeoutMillis,
  };
}
