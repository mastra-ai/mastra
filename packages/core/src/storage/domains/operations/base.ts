import { MastraBase } from '../../../base';
import type { TABLE_NAMES } from '../../constants';
import type { StorageColumn } from '../../types';

export abstract class StoreOperations extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OPERATIONS',
    });
  }

  abstract hasColumn(table: string, column: string): Promise<boolean>;

  protected getSqlType(type: StorageColumn['type']): string {
    switch (type) {
      case 'text':
        return 'TEXT';
      case 'timestamp':
        return 'TIMESTAMP';
      case 'float':
        return 'FLOAT';
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
      case 'float':
        return 'DEFAULT 0';
      case 'jsonb':
        return "DEFAULT '{}'";
      default:
        return "DEFAULT ''";
    }
  }

  abstract createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void>;

  abstract clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void>;

  abstract alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void>;

  abstract insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void>;

  abstract batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void>;

  abstract load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null>;
}
