"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIndexBuilder = void 0;
const create_index_node_js_1 = require("../operation-node/create-index-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const query_node_js_1 = require("../operation-node/query-node.js");
const immediate_value_transformer_js_1 = require("../plugin/immediate-value/immediate-value-transformer.js");
class CreateIndexBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Adds the "if not exists" modifier.
     *
     * If the index already exists, no error is thrown if this method has been called.
     */
    ifNotExists() {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWith(this.#props.node, {
                ifNotExists: true,
            }),
        });
    }
    /**
     * Makes the index unique.
     */
    unique() {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWith(this.#props.node, {
                unique: true,
            }),
        });
    }
    /**
     * Adds `nulls not distinct` specifier to index.
     * This only works on some dialects like PostgreSQL.
     *
     * ### Examples
     *
     * ```ts
     * db.schema.createIndex('person_first_name_index')
     *  .on('person')
     *  .column('first_name')
     *  .nullsNotDistinct()
     *  .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_index"
     * on "test" ("first_name")
     * nulls not distinct;
     * ```
     */
    nullsNotDistinct() {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWith(this.#props.node, {
                nullsNotDistinct: true,
            }),
        });
    }
    /**
     * Specifies the table for the index.
     */
    on(table) {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWith(this.#props.node, {
                table: (0, table_parser_js_1.parseTable)(table),
            }),
        });
    }
    /**
     * Adds a column to the index.
     *
     * Also see {@link columns} for adding multiple columns at once or {@link expression}
     * for specifying an arbitrary expression.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *         .createIndex('person_first_name_and_age_index')
     *         .on('person')
     *         .column('first_name')
     *         .column('age desc')
     *         .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_and_age_index" on "person" ("first_name", "age" desc)
     * ```
     */
    column(column) {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWithColumns(this.#props.node, [
                (0, reference_parser_js_1.parseOrderedColumnName)(column),
            ]),
        });
    }
    /**
     * Specifies a list of columns for the index.
     *
     * Also see {@link column} for adding a single column or {@link expression} for
     * specifying an arbitrary expression.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *         .createIndex('person_first_name_and_age_index')
     *         .on('person')
     *         .columns(['first_name', 'age desc'])
     *         .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_and_age_index" on "person" ("first_name", "age" desc)
     * ```
     */
    columns(columns) {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWithColumns(this.#props.node, columns.map(reference_parser_js_1.parseOrderedColumnName)),
        });
    }
    /**
     * Specifies an arbitrary expression for the index.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createIndex('person_first_name_index')
     *   .on('person')
     *   .expression(sql`first_name COLLATE "fi_FI"`)
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_index" on "person" (first_name COLLATE "fi_FI")
     * ```
     */
    expression(expression) {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWithColumns(this.#props.node, [
                expression.toOperationNode(),
            ]),
        });
    }
    using(indexType) {
        return new CreateIndexBuilder({
            ...this.#props,
            node: create_index_node_js_1.CreateIndexNode.cloneWith(this.#props.node, {
                using: raw_node_js_1.RawNode.createWithSql(indexType),
            }),
        });
    }
    where(...args) {
        const transformer = new immediate_value_transformer_js_1.ImmediateValueTransformer();
        return new CreateIndexBuilder({
            ...this.#props,
            node: query_node_js_1.QueryNode.cloneWithWhere(this.#props.node, transformer.transformNode((0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args), this.#props.queryId)),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.node, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        await this.#props.executor.executeQuery(this.compile());
    }
}
exports.CreateIndexBuilder = CreateIndexBuilder;
