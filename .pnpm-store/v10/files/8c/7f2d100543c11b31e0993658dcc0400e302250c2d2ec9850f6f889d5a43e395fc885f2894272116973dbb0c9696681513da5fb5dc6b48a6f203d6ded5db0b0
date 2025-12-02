/**
 * An interface for getting the database metadata (names of the tables and columns etc.)
 */
export interface DatabaseIntrospector {
    /**
     * Get schema metadata.
     */
    getSchemas(): Promise<SchemaMetadata[]>;
    /**
     * Get tables and views metadata.
     */
    getTables(options?: DatabaseMetadataOptions): Promise<TableMetadata[]>;
    /**
     * Get the database metadata such as table and column names.
     *
     * @deprecated Use getTables() instead.
     */
    getMetadata(options?: DatabaseMetadataOptions): Promise<DatabaseMetadata>;
}
export interface DatabaseMetadataOptions {
    /**
     * If this is true, the metadata contains the internal kysely tables
     * such as the migration tables.
     */
    withInternalKyselyTables: boolean;
}
export interface SchemaMetadata {
    readonly name: string;
}
export interface DatabaseMetadata {
    /**
     * The tables and views found in the database.
     * The propery isView can be used to tell them apart.
     */
    readonly tables: TableMetadata[];
}
export interface TableMetadata {
    readonly name: string;
    readonly isView: boolean;
    readonly columns: ColumnMetadata[];
    readonly schema?: string;
}
export interface ColumnMetadata {
    readonly name: string;
    /**
     * The data type of the column as reported by the database.
     *
     * NOTE: This value is whatever the database engine returns and it will be
     *       different on different dialects even if you run the same migrations.
     *       For example `integer` datatype in a migration will produce `int4`
     *       on PostgreSQL, `INTEGER` on SQLite and `int` on MySQL.
     */
    readonly dataType: string;
    /**
     * The schema this column's data type was created in.
     */
    readonly dataTypeSchema?: string;
    readonly isAutoIncrementing: boolean;
    readonly isNullable: boolean;
    readonly hasDefaultValue: boolean;
    readonly comment?: string;
}
