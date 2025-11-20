import { MongoClient } from 'mongodb';
import type { Db } from 'mongodb';
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
