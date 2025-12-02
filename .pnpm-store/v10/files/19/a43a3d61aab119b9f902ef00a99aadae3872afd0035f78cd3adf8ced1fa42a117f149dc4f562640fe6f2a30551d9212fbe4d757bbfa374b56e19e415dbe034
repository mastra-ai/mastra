"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaModule = void 0;
const alter_table_node_js_1 = require("../operation-node/alter-table-node.js");
const create_index_node_js_1 = require("../operation-node/create-index-node.js");
const create_schema_node_js_1 = require("../operation-node/create-schema-node.js");
const create_table_node_js_1 = require("../operation-node/create-table-node.js");
const drop_index_node_js_1 = require("../operation-node/drop-index-node.js");
const drop_schema_node_js_1 = require("../operation-node/drop-schema-node.js");
const drop_table_node_js_1 = require("../operation-node/drop-table-node.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const alter_table_builder_js_1 = require("./alter-table-builder.js");
const create_index_builder_js_1 = require("./create-index-builder.js");
const create_schema_builder_js_1 = require("./create-schema-builder.js");
const create_table_builder_js_1 = require("./create-table-builder.js");
const drop_index_builder_js_1 = require("./drop-index-builder.js");
const drop_schema_builder_js_1 = require("./drop-schema-builder.js");
const drop_table_builder_js_1 = require("./drop-table-builder.js");
const query_id_js_1 = require("../util/query-id.js");
const with_schema_plugin_js_1 = require("../plugin/with-schema/with-schema-plugin.js");
const create_view_builder_js_1 = require("./create-view-builder.js");
const create_view_node_js_1 = require("../operation-node/create-view-node.js");
const drop_view_builder_js_1 = require("./drop-view-builder.js");
const drop_view_node_js_1 = require("../operation-node/drop-view-node.js");
const create_type_builder_js_1 = require("./create-type-builder.js");
const drop_type_builder_js_1 = require("./drop-type-builder.js");
const create_type_node_js_1 = require("../operation-node/create-type-node.js");
const drop_type_node_js_1 = require("../operation-node/drop-type-node.js");
const identifier_parser_js_1 = require("../parser/identifier-parser.js");
const refresh_materialized_view_builder_js_1 = require("./refresh-materialized-view-builder.js");
const refresh_materialized_view_node_js_1 = require("../operation-node/refresh-materialized-view-node.js");
/**
 * Provides methods for building database schema.
 */
class SchemaModule {
    #executor;
    constructor(executor) {
        this.#executor = executor;
    }
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
    createTable(table) {
        return new create_table_builder_js_1.CreateTableBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: create_table_node_js_1.CreateTableNode.create((0, table_parser_js_1.parseTable)(table)),
        });
    }
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
    dropTable(table) {
        return new drop_table_builder_js_1.DropTableBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: drop_table_node_js_1.DropTableNode.create((0, table_parser_js_1.parseTable)(table)),
        });
    }
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
    createIndex(indexName) {
        return new create_index_builder_js_1.CreateIndexBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: create_index_node_js_1.CreateIndexNode.create(indexName),
        });
    }
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
    dropIndex(indexName) {
        return new drop_index_builder_js_1.DropIndexBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: drop_index_node_js_1.DropIndexNode.create(indexName),
        });
    }
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
    createSchema(schema) {
        return new create_schema_builder_js_1.CreateSchemaBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: create_schema_node_js_1.CreateSchemaNode.create(schema),
        });
    }
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
    dropSchema(schema) {
        return new drop_schema_builder_js_1.DropSchemaBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: drop_schema_node_js_1.DropSchemaNode.create(schema),
        });
    }
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
    alterTable(table) {
        return new alter_table_builder_js_1.AlterTableBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: alter_table_node_js_1.AlterTableNode.create((0, table_parser_js_1.parseTable)(table)),
        });
    }
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
    createView(viewName) {
        return new create_view_builder_js_1.CreateViewBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: create_view_node_js_1.CreateViewNode.create(viewName),
        });
    }
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
    refreshMaterializedView(viewName) {
        return new refresh_materialized_view_builder_js_1.RefreshMaterializedViewBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: refresh_materialized_view_node_js_1.RefreshMaterializedViewNode.create(viewName),
        });
    }
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
    dropView(viewName) {
        return new drop_view_builder_js_1.DropViewBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: drop_view_node_js_1.DropViewNode.create(viewName),
        });
    }
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
    createType(typeName) {
        return new create_type_builder_js_1.CreateTypeBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: create_type_node_js_1.CreateTypeNode.create((0, identifier_parser_js_1.parseSchemableIdentifier)(typeName)),
        });
    }
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
    dropType(typeName) {
        return new drop_type_builder_js_1.DropTypeBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#executor,
            node: drop_type_node_js_1.DropTypeNode.create((0, identifier_parser_js_1.parseSchemableIdentifier)(typeName)),
        });
    }
    /**
     * Returns a copy of this schema module with the given plugin installed.
     */
    withPlugin(plugin) {
        return new SchemaModule(this.#executor.withPlugin(plugin));
    }
    /**
     * Returns a copy of this schema module  without any plugins.
     */
    withoutPlugins() {
        return new SchemaModule(this.#executor.withoutPlugins());
    }
    /**
     * See {@link QueryCreator.withSchema}
     */
    withSchema(schema) {
        return new SchemaModule(this.#executor.withPluginAtFront(new with_schema_plugin_js_1.WithSchemaPlugin(schema)));
    }
}
exports.SchemaModule = SchemaModule;
