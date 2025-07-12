import { MastraBase } from '../../base';
import type { TABLE_NAMES } from '../constants';
import type { StorageColumn } from '../types';

export abstract class MastraStore extends MastraBase {
  constructor({ name }: { name: string }) {
    super({
      component: 'STORAGE',
      name,
    });
  }

  abstract initialize({ name, schema }: { name: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract teardown({ name }: { name: TABLE_NAMES }): Promise<void>;

  abstract migrate(args: {
    name: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void>;

  abstract load<R>({ name, keys }: { name: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null>;

  abstract insert({ name, record }: { name: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({ name, records }: { name: TABLE_NAMES; records: Record<string, any>[] }): Promise<void>;

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'integer':
        return 'INTEGER';
      case 'bigint':
        return 'BIGINT';
      case 'jsonb':
        return 'JSONB';
      default:
        return 'TEXT';
    }
  }

  protected getDefaultValue(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
      case 'uuid':
        return "DEFAULT ''";
      case 'timestamp':
        return "DEFAULT '1970-01-01 00:00:00'";
      case 'integer':
      case 'bigint':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      default:
        return "DEFAULT ''";
    }
  }

  abstract hasAttribute(name: string, key: string): Promise<boolean>;
}
