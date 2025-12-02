import { Kysely } from '../../kysely.js';
import { DatabaseIntrospector, DatabaseMetadata, DatabaseMetadataOptions, SchemaMetadata, TableMetadata } from '../database-introspector.js';
export declare class MssqlIntrospector implements DatabaseIntrospector {
    #private;
    constructor(db: Kysely<any>);
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
