import { Data, SchemaLike, TableLike } from "./arrow";
import { EmbeddingFunctionConfig } from "./embedding/registry";
import { Connection as LanceDbConnection } from "./native";
import { Table } from "./table";
export interface CreateTableOptions {
    /**
     * The mode to use when creating the table.
     *
     * If this is set to "create" and the table already exists then either
     * an error will be thrown or, if existOk is true, then nothing will
     * happen.  Any provided data will be ignored.
     *
     * If this is set to "overwrite" then any existing table will be replaced.
     */
    mode: "create" | "overwrite";
    /**
     * If this is true and the table already exists and the mode is "create"
     * then no error will be raised.
     */
    existOk: boolean;
    /**
     * Configuration for object storage.
     *
     * Options already set on the connection will be inherited by the table,
     * but can be overridden here.
     *
     * The available options are described at https://lancedb.github.io/lancedb/guides/storage/
     */
    storageOptions?: Record<string, string>;
    /**
     * The version of the data storage format to use.
     *
     * The default is `stable`.
     * Set to "legacy" to use the old format.
     *
     * @deprecated Pass `new_table_data_storage_version` to storageOptions instead.
     */
    dataStorageVersion?: string;
    /**
     * Use the new V2 manifest paths. These paths provide more efficient
     * opening of datasets with many versions on object stores.  WARNING:
     * turning this on will make the dataset unreadable for older versions
     * of LanceDB (prior to 0.10.0). To migrate an existing dataset, instead
     * use the {@link LocalTable#migrateManifestPathsV2} method.
     *
     * @deprecated Pass `new_table_enable_v2_manifest_paths` to storageOptions instead.
     */
    enableV2ManifestPaths?: boolean;
    schema?: SchemaLike;
    embeddingFunction?: EmbeddingFunctionConfig;
}
export interface OpenTableOptions {
    /**
     * Configuration for object storage.
     *
     * Options already set on the connection will be inherited by the table,
     * but can be overridden here.
     *
     * The available options are described at https://lancedb.github.io/lancedb/guides/storage/
     */
    storageOptions?: Record<string, string>;
    /**
     * Set the size of the index cache, specified as a number of entries
     *
     * @deprecated Use session-level cache configuration instead.
     * Create a Session with custom cache sizes and pass it to the connect() function.
     *
     * The exact meaning of an "entry" will depend on the type of index:
     * - IVF: there is one entry for each IVF partition
     * - BTREE: there is one entry for the entire index
     *
     * This cache applies to the entire opened table, across all indices.
     * Setting this value higher will increase performance on larger datasets
     * at the expense of more RAM
     */
    indexCacheSize?: number;
}
export interface TableNamesOptions {
    /**
     * If present, only return names that come lexicographically after the
     * supplied value.
     *
     * This can be combined with limit to implement pagination by setting this to
     * the last table name from the previous page.
     */
    startAfter?: string;
    /** An optional limit to the number of results to return. */
    limit?: number;
}
/**
 * A LanceDB Connection that allows you to open tables and create new ones.
 *
 * Connection could be local against filesystem or remote against a server.
 *
 * A Connection is intended to be a long lived object and may hold open
 * resources such as HTTP connection pools.  This is generally fine and
 * a single connection should be shared if it is going to be used many
 * times. However, if you are finished with a connection, you may call
 * close to eagerly free these resources.  Any call to a Connection
 * method after it has been closed will result in an error.
 *
 * Closing a connection is optional.  Connections will automatically
 * be closed when they are garbage collected.
 *
 * Any created tables are independent and will continue to work even if
 * the underlying connection has been closed.
 * @hideconstructor
 */
export declare abstract class Connection {
    /**
     * Return true if the connection has not been closed
     */
    abstract isOpen(): boolean;
    /**
     * Close the connection, releasing any underlying resources.
     *
     * It is safe to call this method multiple times.
     *
     * Any attempt to use the connection after it is closed will result in an error.
     */
    abstract close(): void;
    /**
     * Return a brief description of the connection
     */
    abstract display(): string;
    /**
     * List all the table names in this database.
     *
     * Tables will be returned in lexicographical order.
     * @param {Partial<TableNamesOptions>} options - options to control the
     * paging / start point (backwards compatibility)
     *
     */
    abstract tableNames(options?: Partial<TableNamesOptions>): Promise<string[]>;
    /**
     * List all the table names in this database.
     *
     * Tables will be returned in lexicographical order.
     * @param {string[]} namespace - The namespace to list tables from (defaults to root namespace)
     * @param {Partial<TableNamesOptions>} options - options to control the
     * paging / start point
     *
     */
    abstract tableNames(namespace?: string[], options?: Partial<TableNamesOptions>): Promise<string[]>;
    /**
     * Open a table in the database.
     * @param {string} name - The name of the table
     * @param {string[]} namespace - The namespace of the table (defaults to root namespace)
     * @param {Partial<OpenTableOptions>} options - Additional options
     */
    abstract openTable(name: string, namespace?: string[], options?: Partial<OpenTableOptions>): Promise<Table>;
    /**
     * Creates a new Table and initialize it with new data.
     * @param {object} options - The options object.
     * @param {string} options.name - The name of the table.
     * @param {Data} options.data - Non-empty Array of Records to be inserted into the table
     * @param {string[]} namespace - The namespace to create the table in (defaults to root namespace)
     *
     */
    abstract createTable(options: {
        name: string;
        data: Data;
    } & Partial<CreateTableOptions>, namespace?: string[]): Promise<Table>;
    /**
     * Creates a new Table and initialize it with new data.
     * @param {string} name - The name of the table.
     * @param {Record<string, unknown>[] | TableLike} data - Non-empty Array of Records
     * to be inserted into the table
     * @param {Partial<CreateTableOptions>} options - Additional options (backwards compatibility)
     */
    abstract createTable(name: string, data: Record<string, unknown>[] | TableLike, options?: Partial<CreateTableOptions>): Promise<Table>;
    /**
     * Creates a new Table and initialize it with new data.
     * @param {string} name - The name of the table.
     * @param {Record<string, unknown>[] | TableLike} data - Non-empty Array of Records
     * to be inserted into the table
     * @param {string[]} namespace - The namespace to create the table in (defaults to root namespace)
     * @param {Partial<CreateTableOptions>} options - Additional options
     */
    abstract createTable(name: string, data: Record<string, unknown>[] | TableLike, namespace?: string[], options?: Partial<CreateTableOptions>): Promise<Table>;
    /**
     * Creates a new empty Table
     * @param {string} name - The name of the table.
     * @param {Schema} schema - The schema of the table
     * @param {Partial<CreateTableOptions>} options - Additional options (backwards compatibility)
     */
    abstract createEmptyTable(name: string, schema: import("./arrow").SchemaLike, options?: Partial<CreateTableOptions>): Promise<Table>;
    /**
     * Creates a new empty Table
     * @param {string} name - The name of the table.
     * @param {Schema} schema - The schema of the table
     * @param {string[]} namespace - The namespace to create the table in (defaults to root namespace)
     * @param {Partial<CreateTableOptions>} options - Additional options
     */
    abstract createEmptyTable(name: string, schema: import("./arrow").SchemaLike, namespace?: string[], options?: Partial<CreateTableOptions>): Promise<Table>;
    /**
     * Drop an existing table.
     * @param {string} name The name of the table to drop.
     * @param {string[]} namespace The namespace of the table (defaults to root namespace).
     */
    abstract dropTable(name: string, namespace?: string[]): Promise<void>;
    /**
     * Drop all tables in the database.
     * @param {string[]} namespace The namespace to drop tables from (defaults to root namespace).
     */
    abstract dropAllTables(namespace?: string[]): Promise<void>;
    /**
     * Clone a table from a source table.
     *
     * A shallow clone creates a new table that shares the underlying data files
     * with the source table but has its own independent manifest. This allows
     * both the source and cloned tables to evolve independently while initially
     * sharing the same data, deletion, and index files.
     *
     * @param {string} targetTableName - The name of the target table to create.
     * @param {string} sourceUri - The URI of the source table to clone from.
     * @param {object} options - Clone options.
     * @param {string[]} options.targetNamespace - The namespace for the target table (defaults to root namespace).
     * @param {number} options.sourceVersion - The version of the source table to clone.
     * @param {string} options.sourceTag - The tag of the source table to clone.
     * @param {boolean} options.isShallow - Whether to perform a shallow clone (defaults to true).
     */
    abstract cloneTable(targetTableName: string, sourceUri: string, options?: {
        targetNamespace?: string[];
        sourceVersion?: number;
        sourceTag?: string;
        isShallow?: boolean;
    }): Promise<Table>;
}
/** @hideconstructor */
export declare class LocalConnection extends Connection {
    readonly inner: LanceDbConnection;
    /** @hidden */
    constructor(inner: LanceDbConnection);
    isOpen(): boolean;
    close(): void;
    display(): string;
    tableNames(namespaceOrOptions?: string[] | Partial<TableNamesOptions>, options?: Partial<TableNamesOptions>): Promise<string[]>;
    openTable(name: string, namespace?: string[], options?: Partial<OpenTableOptions>): Promise<Table>;
    cloneTable(targetTableName: string, sourceUri: string, options?: {
        targetNamespace?: string[];
        sourceVersion?: number;
        sourceTag?: string;
        isShallow?: boolean;
    }): Promise<Table>;
    private getStorageOptions;
    createTable(nameOrOptions: string | ({
        name: string;
        data: Data;
    } & Partial<CreateTableOptions>), dataOrNamespace?: Record<string, unknown>[] | TableLike | string[], namespaceOrOptions?: string[] | Partial<CreateTableOptions>, options?: Partial<CreateTableOptions>): Promise<Table>;
    private _createTableImpl;
    createEmptyTable(name: string, schema: import("./arrow").SchemaLike, namespaceOrOptions?: string[] | Partial<CreateTableOptions>, options?: Partial<CreateTableOptions>): Promise<Table>;
    dropTable(name: string, namespace?: string[]): Promise<void>;
    dropAllTables(namespace?: string[]): Promise<void>;
}
/**
 * Takes storage options and makes all the keys snake case.
 */
export declare function cleanseStorageOptions(options?: Record<string, string>): Record<string, string> | undefined;
