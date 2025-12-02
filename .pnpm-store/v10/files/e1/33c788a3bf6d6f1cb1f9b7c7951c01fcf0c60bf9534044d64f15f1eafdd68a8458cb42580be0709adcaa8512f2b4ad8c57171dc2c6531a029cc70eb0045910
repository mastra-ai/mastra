import { MastraBase } from '../../../base.js';
import type { TABLE_NAMES } from '../../constants.js';
import type { StorageColumn, CreateIndexOptions, IndexInfo, StorageIndexStats } from '../../types.js';
export declare abstract class StoreOperations extends MastraBase {
    constructor();
    abstract hasColumn(table: string, column: string): Promise<boolean>;
    protected getSqlType(type: StorageColumn['type']): string;
    protected getDefaultValue(type: StorageColumn['type']): string;
    abstract createTable({ tableName }: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
    }): Promise<void>;
    abstract clearTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    abstract dropTable({ tableName }: {
        tableName: TABLE_NAMES;
    }): Promise<void>;
    abstract alterTable(args: {
        tableName: TABLE_NAMES;
        schema: Record<string, StorageColumn>;
        ifNotExists: string[];
    }): Promise<void>;
    abstract insert({ tableName, record }: {
        tableName: TABLE_NAMES;
        record: Record<string, any>;
    }): Promise<void>;
    abstract batchInsert({ tableName, records, }: {
        tableName: TABLE_NAMES;
        records: Record<string, any>[];
    }): Promise<void>;
    abstract load<R>({ tableName, keys }: {
        tableName: TABLE_NAMES;
        keys: Record<string, any>;
    }): Promise<R | null>;
    /**
     * DATABASE INDEX MANAGEMENT
     * Optional methods for database index management.
     * Storage adapters can override these to provide index management capabilities.
     */
    /**
     * Creates a database index on specified columns
     * @throws {MastraError} if not supported by the storage adapter
     */
    createIndex(_options: CreateIndexOptions): Promise<void>;
    /**
     * Drops a database index by name
     * @throws {MastraError} if not supported by the storage adapter
     */
    dropIndex(_indexName: string): Promise<void>;
    /**
     * Lists database indexes for a table or all tables
     * @throws {MastraError} if not supported by the storage adapter
     */
    listIndexes(_tableName?: string): Promise<IndexInfo[]>;
    /**
     * Gets detailed statistics for a specific index
     * @throws {MastraError} if not supported by the storage adapter
     */
    describeIndex(_indexName: string): Promise<StorageIndexStats>;
    /**
     * Returns definitions for automatic performance indexes
     * Storage adapters can override this to define indexes that should be created during initialization
     * @returns Array of index definitions to create automatically
     */
    protected getAutomaticIndexDefinitions(): CreateIndexOptions[];
}
//# sourceMappingURL=base.d.ts.map