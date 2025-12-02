import type { TABLE_NAMES } from '../../constants.js';
import type { StorageColumn } from '../../types.js';
import { StoreOperations } from './base.js';
export declare class StoreOperationsInMemory extends StoreOperations {
    data: Record<TABLE_NAMES, Map<string, Record<string, any>>>;
    constructor();
    getDatabase(): Record<TABLE_NAMES, Map<string, Record<string, any>>>;
    insert({ tableName, record }: {
        tableName: TABLE_NAMES;
        record: Record<string, any>;
    }): Promise<void>;
    batchInsert({ tableName, records }: {
        tableName: TABLE_NAMES;
        records: Record<string, any>[];
    }): Promise<void>;
    load<R>({ tableName, keys }: {
        tableName: TABLE_NAMES;
        keys: Record<string, string>;
    }): Promise<R | null>;
    createTable({ tableName, schema, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
    }): Promise<void>;
    clearTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    dropTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    alterTable({ tableName, schema, }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
        ifNotExists: string[];
    }): Promise<void>;
    hasColumn(table: string, column: string): Promise<boolean>;
}
//# sourceMappingURL=inmemory.d.ts.map