import { RecordId, Surreal } from 'surrealdb';
import type { SurrealDBConnectionConfig } from './config';
import { isInstanceConfig, isTokenConfig, isUrlConfig } from './config';

export { RecordId };

const DEFAULT_NAMESPACE = 'mastra';
const DEFAULT_DATABASE = 'mastra';

/** Configuration accepted by every domain: connection options, or a connector shared with other domains. */
export type SurrealDBDomainConfig = SurrealDBConnectionConfig | { connector: SurrealDBConnector };

/** Error thrown from SurrealQL `THROW` inside an optimistic-concurrency check. */
export const CONFLICT_MARKER = 'mastra_conflict';

/**
 * Owns (or wraps) a single `Surreal` connection shared by every storage domain and the
 * vector store. The connection is opened lazily and exactly once, no matter how many
 * domains call into it concurrently.
 */
export class SurrealDBConnector {
  readonly db: Surreal;
  readonly namespace: string;
  readonly database: string;
  readonly #config: SurrealDBConnectionConfig;
  readonly #owned: boolean;
  #connecting?: Promise<void>;
  #bootstrapped?: Promise<void>;

  constructor(config: SurrealDBConnectionConfig) {
    this.#config = config;
    this.namespace = config.namespace ?? DEFAULT_NAMESPACE;
    this.database = config.database ?? DEFAULT_DATABASE;

    if (isInstanceConfig(config)) {
      this.db = config.db;
      this.#owned = false;
      return;
    }

    if (!('url' in config) || typeof config.url !== 'string' || config.url.trim() === '') {
      throw new Error('SurrealDB: url must be provided and cannot be empty.');
    }
    if (!isUrlConfig(config) && !isTokenConfig(config)) {
      throw new Error(
        'SurrealDB: provide either username and password, a token, or an existing Surreal instance (db).',
      );
    }

    this.db = new Surreal({ codecOptions: { useNativeDates: true } });
    this.#owned = true;
  }

  static from(config: SurrealDBDomainConfig): SurrealDBConnector {
    return 'connector' in config ? config.connector : new SurrealDBConnector(config);
  }

  /** Opens (once) the connection and selects the configured namespace and database. */
  connect(): Promise<void> {
    this.#connecting ??= this.#connect().catch(async error => {
      // close() skips a connection with no pending connect, so close an owned one here
      // before a retry can start; a cleanup failure must not hide the connect error.
      if (this.#owned) await this.db.close().catch(() => {});
      this.#connecting = undefined;
      throw error;
    });
    return this.#connecting;
  }

  async #connect(): Promise<void> {
    const config = this.#config;

    if (isInstanceConfig(config)) {
      // A caller-managed instance keeps its own session unless a namespace/database was configured.
      if (config.namespace !== undefined || config.database !== undefined) {
        await this.db.use({ namespace: this.namespace, database: this.database });
      }
      return;
    }

    let authentication;
    if (isTokenConfig(config)) {
      authentication = config.token;
    } else if (isUrlConfig(config)) {
      const level = config.authLevel ?? 'root';
      authentication = {
        username: config.username,
        password: config.password,
        ...(level !== 'root' ? { namespace: this.namespace } : {}),
        ...(level === 'database' ? { database: this.database } : {}),
      };
    }

    await this.db.connect(config.url, { authentication });
    await this.db.use({ namespace: this.namespace, database: this.database });
  }

  /**
   * Creates the namespace and database when they do not exist yet. SurrealDB v3 rejects
   * queries against a namespace or database that was never defined. Users without the
   * privilege to define them (for example database-level users) are expected to work in an
   * existing database, so a permission failure is ignored here.
   */
  ensureDatabase(): Promise<void> {
    this.#bootstrapped ??= (async () => {
      await this.connect();
      const config = this.#config;
      let namespace = this.namespace;
      let database = this.database;
      if (isInstanceConfig(config) && config.namespace === undefined && config.database === undefined) {
        // A caller-managed client keeps the selection its owner made; switching it would
        // move the owner's own queries too. The SDK tracks the selection client-side, so
        // this needs no server query. Only what is missing falls back to the defaults.
        if (this.db.namespace && this.db.database) return;
        namespace = this.db.namespace ?? namespace;
        database = this.db.database ?? database;
      }
      try {
        await this.db
          .query(
            `DEFINE NAMESPACE IF NOT EXISTS ${escapeIdent(namespace)};
             USE NS ${escapeIdent(namespace)};
             DEFINE DATABASE IF NOT EXISTS ${escapeIdent(database)};`,
          )
          .collect();
      } catch {
        // Not permitted, or already present: queries below report anything that is actually wrong.
      } finally {
        await this.db.use({ namespace, database });
      }
    })().catch(error => {
      this.#bootstrapped = undefined;
      throw error;
    });
    return this.#bootstrapped;
  }

  /** Runs a (multi-statement) query and returns one result per statement. */
  async query<T extends unknown[] = unknown[]>(surql: string, bindings?: Record<string, unknown>): Promise<T> {
    await this.connect();
    // Every query this package sends is a single atomic statement, an explicit transaction, or
    // idempotent, so it is safe to re-send when it loses a transaction conflict.
    return (await this.db.query(surql, bindings).retry().collect()) as T;
  }

  /** Runs a single-statement query and returns its rows. */
  async queryAll<T>(surql: string, bindings?: Record<string, unknown>): Promise<T[]> {
    const [rows] = await this.query<[T[] | T | undefined]>(surql, bindings);
    if (rows === undefined || rows === null) return [];
    return Array.isArray(rows) ? rows : [rows];
  }

  /** Runs a single-statement query and returns its first row. */
  async queryOne<T>(surql: string, bindings?: Record<string, unknown>): Promise<T | null> {
    const rows = await this.queryAll<T>(surql, bindings);
    return rows[0] ?? null;
  }

  /**
   * Runs statements in one transaction, sent as a single request (SurrealDB transactions
   * cannot span requests). Transaction conflicts are retried. Returns one result per
   * statement, excluding `BEGIN`/`COMMIT`.
   */
  async transaction<T extends unknown[] = unknown[]>(
    statements: string[],
    bindings?: Record<string, unknown>,
  ): Promise<T> {
    await this.connect();
    const results = await this.db
      .query(['BEGIN TRANSACTION', ...statements, 'COMMIT TRANSACTION'].join(';\n'), bindings)
      .retry()
      .collect();
    return results.slice(1, statements.length + 1) as T;
  }

  async close(): Promise<void> {
    if (!this.#owned || !this.#connecting) return;
    this.#connecting = undefined;
    this.#bootstrapped = undefined;
    await this.db.close();
  }
}

/** Escapes a SurrealQL identifier (table, index, namespace or database name). */
export function escapeIdent(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `\`${name.replace(/[`\\]/g, '\\$&')}\``;
}

/** Whether an error came from a `THROW` of {@link CONFLICT_MARKER}. */
export function isConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes(CONFLICT_MARKER);
}

/** The plain key of a SurrealDB record id. */
export function recordKey(id: unknown): string {
  if (id instanceof RecordId) {
    const key = id.id;
    return typeof key === 'string' ? key : String(key);
  }
  return String(id);
}
