import type { Surreal } from 'surrealdb';

/**
 * Options shared by every SurrealDB configuration.
 */
export interface SurrealDBBaseConfig {
  /**
   * Namespace the Mastra tables live in.
   * @default 'mastra'
   */
  namespace?: string;
  /**
   * Database the Mastra tables live in.
   * @default 'mastra'
   */
  database?: string;
}

/**
 * Connect with a system user. Root users are the default; set `authLevel` to
 * sign in as a namespace- or database-level user of the configured namespace/database.
 */
export interface SurrealDBUrlConfig extends SurrealDBBaseConfig {
  /** Connection URL, e.g. `ws://localhost:8000` or `https://<instance>.surreal.cloud`. */
  url: string;
  username: string;
  password: string;
  /**
   * Level of the system user.
   * @default 'root'
   */
  authLevel?: 'root' | 'namespace' | 'database';
}

/**
 * Connect with an access token (for example a SurrealDB Cloud token or a record-access JWT).
 */
export interface SurrealDBTokenConfig extends SurrealDBBaseConfig {
  url: string;
  token: string;
}

/**
 * Reuse an existing, already connected and authenticated `Surreal` instance.
 * The instance is not closed by Mastra.
 */
export interface SurrealDBInstanceConfig extends SurrealDBBaseConfig {
  db: Surreal;
}

export type SurrealDBConnectionConfig = SurrealDBUrlConfig | SurrealDBTokenConfig | SurrealDBInstanceConfig;

export function isInstanceConfig(config: SurrealDBConnectionConfig): config is SurrealDBInstanceConfig {
  return 'db' in config && config.db !== undefined;
}

export function isTokenConfig(config: SurrealDBConnectionConfig): config is SurrealDBTokenConfig {
  return 'token' in config && typeof config.token === 'string';
}

export function isUrlConfig(config: SurrealDBConnectionConfig): config is SurrealDBUrlConfig {
  return 'username' in config && 'password' in config;
}
