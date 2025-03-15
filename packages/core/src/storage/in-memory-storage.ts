import type { MessageType, StorageThreadType } from '../memory';
import { MastraStorage } from './base';
import { TABLE_EVALS, TABLE_MESSAGES, TABLE_THREADS, TABLE_TRACES, TABLE_WORKFLOW_SNAPSHOT } from './constants';
import type { TABLE_NAMES } from './constants';
import type { EvalRow, StorageColumn, StorageGetMessagesArg } from './types';

type Doc = Record<string, any>;

export class InMemoryStorage extends MastraStorage {
  private tables: Record<TABLE_NAMES, Doc[]> = {
    [TABLE_WORKFLOW_SNAPSHOT]: [],
    [TABLE_EVALS]: [],
    [TABLE_MESSAGES]: [],
    [TABLE_THREADS]: [],
    [TABLE_TRACES]: [],
  };
  private primaryKeys: Record<TABLE_NAMES, string | null> = {
    [TABLE_WORKFLOW_SNAPSHOT]: null,
    [TABLE_EVALS]: null,
    [TABLE_MESSAGES]: null,
    [TABLE_THREADS]: null,
    [TABLE_TRACES]: null,
  };
  constructor() {
    super({ name: 'InMemoryStorage' });
  }

  async createTable({ tableName, schema }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }) {
    for (const [key, value] of Object.entries(schema)) {
      if (value.primaryKey) {
        this.primaryKeys[tableName] = key;
      }
      break;
    }
    return;
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }) {
    this.tables[tableName] = [];
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }) {
    if (this.primaryKeys[tableName]) {
      const primaryKey = record[this.primaryKeys[tableName]!];
      const index = this.tables[tableName].findIndex(record => record[this.primaryKeys[tableName]!] === primaryKey);
      if (index !== -1) {
        this.tables[tableName][index] = record;
      } else {
        this.tables[tableName].push(record);
      }
    } else {
      this.tables[tableName].push(record);
    }
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }) {
    records.forEach(record => this.insert({ tableName, record }));
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    return this.tables[tableName].find(record =>
      Object.entries(keys).every(([key, value]) => record[key] === value),
    ) as R | null;
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.tables[TABLE_THREADS].find(record => record.id === threadId) as StorageThreadType | null;
  }

  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    return this.tables[TABLE_THREADS].filter(record => record.resourceId === resourceId) as StorageThreadType[];
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    await this.insert({ tableName: TABLE_THREADS, record: thread });
    return thread;
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
    const index = this.tables[TABLE_THREADS].findIndex(record => record.id === id);
    if (index === -1) {
      throw new Error(`Thread with id ${id} not found`);
    }
    this.tables[TABLE_THREADS][index] = { ...this.tables[TABLE_THREADS][index], title, metadata };
    return this.tables[TABLE_THREADS][index] as StorageThreadType;
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    const index = this.tables[TABLE_THREADS].findIndex(record => record.id === threadId);
    if (index !== -1) {
      this.tables[TABLE_THREADS].splice(index, 1);
    }
  }

  async getMessages<T extends MessageType[]>({ threadId, selectBy }: StorageGetMessagesArg): Promise<T> {
    const allMessages = this.tables[TABLE_MESSAGES].filter(record => record.threadId === threadId) as MessageType[];
    const limit = typeof selectBy?.last === `number` ? selectBy.last : 40;
    const ranges = [{ start: allMessages.length - limit, end: allMessages.length }];
    if (selectBy?.include?.length) {
      ranges.push(
        ...selectBy.include
          .map(i => {
            const index = allMessages.findIndex(record => record.id === i.id);
            return index !== -1
              ? { start: index - (i.withPreviousMessages || 0), end: index + (i.withNextMessages || 0) }
              : null;
          })
          .flatMap(r => (r ? [r] : [])),
      );
    }
    const indexes = ranges
      .flatMap(r => Array.from({ length: r.end - r.start + 1 }, (_, i) => r.start + i))
      .sort()
      .reduce((acc, index) => (acc.at(-1) === index ? acc : [...acc, index]), [] as number[]);
    return indexes
      .map(index => allMessages[index]!)
      .map(m => ({
        ...m,
        content: tryJSONParse(m.content),
        createdAt: new Date(m.createdAt),
      })) as T;
  }

  async saveMessages({ messages }: { messages: MessageType[] }): Promise<MessageType[]> {
    messages.forEach(message =>
      this.insert({
        tableName: TABLE_MESSAGES,
        record: {
          id: message.id,
          threadId: message.threadId,
          content: typeof message.content === 'object' ? JSON.stringify(message.content) : message.content,
          role: message.role,
          type: message.type,
          createdAt:
            message.createdAt instanceof Date
              ? message.createdAt.toISOString()
              : message.createdAt || new Date().toISOString(),
        },
      }),
    );
    return messages;
  }

  async getTraces(args: {
    name?: string;
    scope?: string;
    page: number;
    perPage: number;
    attributes?: Record<string, string>;
  }): Promise<any[]> {
    const { name, scope, page, perPage, attributes } = args;
    const limit = perPage;
    const offset = page * perPage;
    const traces = this.tables[TABLE_TRACES].filter(record => {
      if (name && !record.name.startsWith(name)) {
        return false;
      }
      if (scope && record.scope !== scope) {
        return false;
      }
      if (attributes) {
        return Object.keys(attributes).every(key => record.attributes[key] === attributes[key]);
      }
      return true;
    });
    return traces.slice(offset, offset + limit);
  }

  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    return this.tables[TABLE_EVALS].filter(
      record =>
        record.agentName === agentName &&
        (type === 'test'
          ? record.testInfo && record.testInfo.testPath
          : type === 'live'
            ? !record.testInfo || !record.testInfo.testPath
            : true),
    ) as EvalRow[];
  }
}

function tryJSONParse(content: any) {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
