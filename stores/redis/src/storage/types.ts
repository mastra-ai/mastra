import type { RedisClientType } from 'redis';

export type RedisClient = RedisClientType<Record<string, never>, Record<string, never>, Record<string, never>>;

/**
 * Redis configuration type.
 *
 * Accepts either:
 * - A pre-configured redis client: `{ id, client }`
 * - Connection string: `{ id, connectionString }`
 * - Host/port config: `{ id, host, port?, password?, db? }`
 */
export type RedisConfig = {
  id: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new RedisStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new RedisStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
} & (
  | {
      /**
       * Pre-configured redis client (from the official `redis` package).
       * Use this when you need to configure the client before initialization,
       * e.g., to set custom socket options or interceptors.
       *
       * @example
       * ```typescript
       * import { createClient } from 'redis';
       *
       * const client = createClient({
       *   url: 'redis://localhost:6379',
       *   socket: {
       *     reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
       *   },
       * });
       * await client.connect();
       *
       * const store = new RedisStore({ id: 'my-store', client });
       * ```
       */
      client: RedisClient;
    }
  | {
      /**
       * Redis connection string URL.
       *
       * @example
       * ```typescript
       * const store = new RedisStore({
       *   id: 'my-store',
       *   connectionString: 'redis://user:password@localhost:6379/0',
       * });
       * ```
       */
      connectionString: string;
    }
  | {
      /**
       * Redis host address.
       * @default 'localhost'
       */
      host: string;
      /**
       * Redis port number.
       * @default 6379
       */
      port?: number;
      /**
       * Redis password for authentication.
       */
      password?: string;
      /**
       * Redis database number.
       * @default 0
       */
      db?: number;
    }
);
