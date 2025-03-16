import type { MessageType, StorageThreadType } from '../memory/types';
import { MastraStorage } from './base';
import type { TABLE_NAMES } from './constants';
import { InMemoryStorage } from './in-memory-storage';
import type { EvalRow, StorageColumn, StorageGetMessagesArg } from './types';

/**
 * A proxy for the DefaultStorage (LibSQLStore) to allow for dynamically loading the storage in a constructor
 * If the storage is in-memory, it will use the InMemoryStorage.
 */
export class DefaultProxyStorage extends MastraStorage {
  private storage: Promise<MastraStorage>;

  constructor({ config }: { config: { url?: string; authToken?: string } }) {
    super({ name: 'DefaultStorage' });
    const url = config?.url;
    if (!url || url === ':memory:') {
      this.storage = Promise.resolve(new InMemoryStorage());
    } else {
      this.storage = new Promise((resolve, reject) => {
        try {
          import(['./', 'libsql'].join('')) // avoid automatic bundling
            .then(({ DefaultStorage }) => {
              this.storage = new DefaultStorage({ config: { url, authToken: config?.authToken } });
              resolve(this.storage);
            })
            .catch(reject);
        } catch (error) {
          console.error(
            'To use DefaultProxyStorage for a remote database, you need to install the @libsql/client package',
            error,
          );
          reject(error);
        }
      });
    }
  }

  async createTable(args: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    return (await this.storage).createTable(args);
  }

  async clearTable(args: { tableName: TABLE_NAMES }): Promise<void> {
    return (await this.storage).clearTable(args);
  }

  async insert(args: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    return (await this.storage).insert(args);
  }

  async batchInsert(args: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    return (await this.storage).batchInsert(args);
  }

  async load<R>(args: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return (await this.storage).load<R>(args);
  }

  async getThreadById(args: { threadId: string }): Promise<StorageThreadType | null> {
    return (await this.storage).getThreadById(args);
  }

  async getThreadsByResourceId(args: { resourceId: string }): Promise<StorageThreadType[]> {
    return (await this.storage).getThreadsByResourceId(args);
  }

  async saveThread(args: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return (await this.storage).saveThread(args);
  }

  async updateThread(args: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    return (await this.storage).updateThread(args);
  }

  async deleteThread(args: { threadId: string }): Promise<void> {
    return (await this.storage).deleteThread(args);
  }

  async getMessages<T extends MessageType>(args: StorageGetMessagesArg): Promise<T[]> {
    return (await this.storage).getMessages<T>(args);
  }

  async saveMessages(args: { messages: MessageType[] }): Promise<MessageType[]> {
    return (await this.storage).saveMessages(args);
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return (await this.storage).getEvalsByAgentName(agentName, type);
  }

  async getTraces(options?: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    return (await this.storage).getTraces(options ?? { page: 0, perPage: 100 });
  }
}
