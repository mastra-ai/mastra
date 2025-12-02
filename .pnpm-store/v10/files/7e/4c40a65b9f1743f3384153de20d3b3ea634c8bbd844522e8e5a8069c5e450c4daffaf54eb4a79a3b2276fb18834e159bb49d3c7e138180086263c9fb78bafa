import { QueryExecutor } from '../query-executor/query-executor.js';
import { AlterTableBuilder } from './alter-table-builder.js';
import { CreateIndexBuilder } from './create-index-builder.js';
import { CreateSchemaBuilder } from './create-schema-builder.js';
import { CreateTableBuilder } from './create-table-builder.js';
import { DropIndexBuilder } from './drop-index-builder.js';
import { DropSchemaBuilder } from './drop-schema-builder.js';
import { DropTableBuilder } from './drop-table-builder.js';
import { CreateViewBuilder } from './create-view-builder.js';
import { DropViewBuilder } from './drop-view-builder.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { CreateTypeBuilder } from './create-type-builder.js';
import { DropTypeBuilder } from './drop-type-builder.js';
import { RefreshMaterializedViewBuilder } from './refresh-materialized-view-builder.js';
/**
 * Provides methods for building database schema.
 */
export declare class SchemaModule {
    #private;
    constructor(executor: QueryExecutor);
    /**
     * Create a new table.
     *
     * ### Examples
     *
     * This example creates a new table with columns `id`, `first_name`,
     * `last_name` and `gender`:
     *
     * ```ts
     * await db.schema
     *   .createTable('person')
     *   .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
     *   .addColumn('first_name', 'varchar', col => col.notNull())
     *   .addColumn('last_name', 'varchar', col => col.notNull())
     *   .addColumn('gender', 'varchar')
     *   .execute()
     * ```
     *
     * This example creates a table with a foreign key. Not all database
     * engines support column-level foreign key constraint definitions.
     * For example if you are using MySQL 5.X see the next example after
     * this one.
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
     *   .addColumn('owner_id', 'integer', col => col
     *     .references('person.id')
     *     .onDelete('cascade')
     *   )
     *   .execute()
     * ```
     *
     * This example adds a foreign key constraint for a columns just
     * like the previous example, but using a table-level statement.
     * On MySQL 5.X you need to define foreign key constraints like
     * this:
     *
     * ```ts
     * await db.schema
     *   .createTable('pet')
     *   .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
     *   .addColumn('owner_id', 'integer')
     *   .addForeignKeyConstraint(
     *     'pet_owner_id_foreign', ['owner_id'], 'person', ['id'],
     *     (constraint) => constraint.onDelete('cascade')
     *   )
     *   .execute()
     * ```
     */
    createTable<TB extends string>(table: TB): CreateTableBuilder<TB, never>;
    /**
     * Drop a table.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .dropTable('person')
     *   .execute()
     * ```
     */
    dropTable(table: string): DropTableBuilder;
    /**
     * Create a new index.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createIndex('person_full_name_unique_index')
     *   .on('person')
     *   .columns(['first_name', 'last_name'])
     *   .execute()
     * ```
     */
    createIndex(indexName: string): CreateIndexBuilder;
    /**
     * Drop an index.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .dropIndex('person_full_name_unique_index')
     *   .execute()
     * ```
     */
    dropIndex(indexName: string): DropIndexBuilder;
    /**
     * Create a new schema.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createSchema('some_schema')
     *   .execute()
     * ```
     */
    createSchema(schema: string): CreateSchemaBuilder;
    /**
     * Drop a schema.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .dropSchema('some_schema')
     *   .execute()
     * ```
     */
    dropSchema(schema: string): DropSchemaBuilder;
    /**
     * Alter a table.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .alterTable('person')
     *   .alterColumn('first_name', (ac) => ac.setDataType('text'))
     *   .execute()
     * ```
     */
    alterTable(table: string): AlterTableBuilder;
    /**
     * Create a new view.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createView('dogs')
     *   .orReplace()
     *   .as(db.selectFrom('pet').selectAll().where('species', '=', 'dog'))
     *   .execute()
     * ```
     */
    createView(viewName: string): CreateViewBuilder;
    /**
     * Refresh a materialized view.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .refreshMaterializedView('my_view')
     *   .concurrently()
     *   .execute()
     * ```
     */
    refreshMaterializedView(viewName: string): RefreshMaterializedViewBuilder;
    /**
     * Drop a view.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .dropView('dogs')
     *   .ifExists()
     *   .execute()
     * ```
     */
    dropView(viewName: string): DropViewBuilder;
    /**
     * Create a new type.
     *
     * Only some dialects like PostgreSQL have user-defined types.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .createType('species')
     *   .asEnum(['dog', 'cat', 'frog'])
     *   .execute()
     * ```
     */
    createType(typeName: string): CreateTypeBuilder;
    /**
     * Drop a type.
     *
     * Only some dialects like PostgreSQL have user-defined types.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .dropType('species')
     *   .ifExists()
     *   .execute()
     * ```
     */
    dropType(typeName: string): DropTypeBuilder;
    /**
     * Returns a copy of this schema module with the given plugin installed.
     */
    withPlugin(plugin: KyselyPlugin): SchemaModule;
    /**
     * Returns a copy of this schema module  without any plugins.
     */
    withoutPlugins(): SchemaModule;
    /**
     * See {@link QueryCreator.withSchema}
     */
    withSchema(schema: string): SchemaModule;
}
