import type { MessageType, StorageThreadType } from '../memory/types';
import { MastraStorage } from './base';
import type { TABLE_NAMES } from './constants';
import type { DefaultStorage, type LibSQLConfig } from './libsql';
import type { EvalRow, StorageColumn, StorageGetMessagesArg } from './types';

/**
 * A proxy for the DefaultStorage (LibSQLStore) to allow for dynamically loading the storage in a constructor
 */
export class DefaultProxyStorage extends MastraStorage {
  private storage: DefaultStorage | null = null;
  private storageConfig: LibSQLConfig;
  private isInitializingPromise: Promise<void> | null = null;

  constructor({ config }: { config: LibSQLConfig }) {
    super({ name: 'DefaultStorage' });
    this.storageConfig = config;
  }

  private setupStorage() {
    if (!this.isInitializingPromise) {
      this.isInitializingPromise = new Promise((resolve, reject) => {
        import('./libsql')
          .then(({ DefaultStorage }) => {
            this.storage = new DefaultStorage({ config: this.storageConfig });
            resolve();
          })
          .catch(reject);
      });
    }

    return this.isInitializingPromise;
  }

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    await this.setupStorage();
    return this.storage!.createTable({ tableName, schema });
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.setupStorage();
    return this.storage!.clearTable({ tableName });
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    await this.setupStorage();
    return this.storage!.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.setupStorage();
    return this.storage!.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    await this.setupStorage();
    return this.storage!.load<R>({ tableName, keys });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    await this.setupStorage();
    return this.storage!.getThreadById({ threadId });
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    await this.setupStorage();
    return this.storage!.getThreadsByResourceId({ resourceId });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.setupStorage();
    return this.storage!.saveThread({ thread });
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    await this.setupStorage();
    return this.storage!.updateThread({ id, title, metadata });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.setupStorage();
    return this.storage!.deleteThread({ threadId });
  }

  async getMessages<T extends MessageType[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    await this.setupStorage();
    return this.storage!.getMessages<T>({ threadId, selectBy });
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    await this.setupStorage();
    return this.storage!.saveMessages({ messages });
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    await this.setupStorage();
    return this.storage!.getEvalsByAgentName(agentName, type);
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    await this.setupStorage();
    return this.storage!.getTraces(options);
  }
}
