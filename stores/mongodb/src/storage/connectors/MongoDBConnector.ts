import { MongoClient } from 'mongodb';
import type { ClientSession, Db } from 'mongodb';
import packageJson from '../../../package.json';
import type { DatabaseConfig } from '../types';
import type { ConnectorHandler } from './base';

type MongoDBConnectorOptions =
  | {
      client: MongoClient;
      dbName: string;
      handler: undefined;
    }
  | {
      client: undefined;
      dbName: undefined;
      handler: ConnectorHandler;
    };

export class MongoDBConnector {
  readonly #client?: MongoClient;
  readonly #dbName?: string;
  readonly #handler?: ConnectorHandler;
  #isConnected: boolean;
  #db?: Db;
  #supportsTransactions?: boolean;

  constructor(options: MongoDBConnectorOptions) {
    this.#client = options.client;
    this.#dbName = options.dbName;
    this.#handler = options.handler;
    this.#isConnected = false;
  }

  static fromDatabaseConfig(config: DatabaseConfig): MongoDBConnector {
    if (!config.url?.trim().length) {
      throw new Error(
        'MongoDBStore: url must be provided and cannot be empty. Passing an empty string may cause fallback to local MongoDB defaults.',
      );
    }

    if (!config.dbName?.trim().length) {
      throw new Error(
        'MongoDBStore: dbName must be provided and cannot be empty. Passing an empty string may cause fallback to local MongoDB defaults.',
      );
    }

    const client = new MongoClient(config.url, {
      ...config.options,
      driverInfo: {
        name: 'mastra-storage',
        version: packageJson.version || '0.0.0',
      },
    });
    return new MongoDBConnector({
      client,
      dbName: config.dbName,
      handler: undefined,
    });
  }

  static fromConnectionHandler(handler: ConnectorHandler): MongoDBConnector {
    return new MongoDBConnector({
      client: undefined,
      dbName: undefined,
      handler,
    });
  }

  private async getConnection(): Promise<Db> {
    if (this.#client) {
      if (this.#isConnected && this.#db) {
        return this.#db;
      }
      await this.#client.connect();
      this.#db = this.#client.db(this.#dbName);
      this.#isConnected = true;
      return this.#db;
    }

    throw new Error('MongoDBStore: client cannot be empty. Check your MongoDBConnector configuration.');
  }

  async getCollection(collectionName: string) {
    if (this.#handler) {
      return this.#handler.getCollection(collectionName);
    }
    const db = await this.getConnection();
    return db.collection(collectionName);
  }

  async collectionExists(collectionName: string): Promise<boolean> {
    if (this.#handler) {
      return true;
    }
    const db = await this.getConnection();
    return db.listCollections({ name: collectionName }).hasNext();
  }

  /**
   * Whether the deployment supports multi-document transactions (replica set
   * or sharded cluster). Standalone servers and custom connector handlers
   * don't. The answer is cached once a probe completes; a probe that fails
   * rejects and is retried on the next call, so the answer never changes.
   */
  async probeTransactions(): Promise<boolean> {
    if (this.#supportsTransactions !== undefined) {
      return this.#supportsTransactions;
    }
    if (!this.#client) {
      // Custom connector handler: no client to probe; assume no transactions.
      this.#supportsTransactions = false;
      return false;
    }
    const db = await this.getConnection();
    const hello = await db.admin().command({ hello: 1 });
    this.#supportsTransactions = Boolean(hello.setName) || hello.msg === 'isdbgrid';
    return this.#supportsTransactions;
  }

  /**
   * Like {@link probeTransactions}, but a failed probe reads as no
   * transaction support (and is retried on the next call), so a momentary
   * outage degrades writes to non-atomic instead of failing them.
   */
  async supportsTransactions(): Promise<boolean> {
    try {
      return await this.probeTransactions();
    } catch {
      return false;
    }
  }

  /**
   * Runs `fn` inside a transaction when the deployment supports it, passing the
   * session so callers can scope each operation with `{ session }`. On a
   * standalone server (or custom handler) it degrades to running `fn` directly
   * with an undefined session — best-effort sequential, no atomicity.
   */
  async withTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
    const supported = await this.supportsTransactions();
    if (!supported || !this.#client) {
      return fn(undefined);
    }
    const session = this.#client.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async close() {
    if (this.#client) {
      await this.#client.close();
      this.#isConnected = false;
      return;
    }

    if (this.#handler) {
      await this.#handler.close();
    }
  }
}
