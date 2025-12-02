"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableAddIndexBuilder = void 0;
const add_index_node_js_1 = require("../operation-node/add-index-node.js");
const alter_table_node_js_1 = require("../operation-node/alter-table-node.js");
const raw_node_js_1 = require("../operation-node/raw-node.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const object_utils_js_1 = require("../util/object-utils.js");
class AlterTableAddIndexBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Makes the index unique.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *   .alterTable('person')
     *   .addIndex('person_first_name_index')
     *   .unique()
     *   .column('email')
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` add unique index `person_first_name_index` (`email`)
     * ```
     */
    unique() {
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.cloneWith(this.#props.node.addIndex, {
                    unique: true,
                }),
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
     *   .alterTable('person')
     *   .addIndex('person_first_name_and_age_index')
     *   .column('first_name')
     *   .column('age desc')
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` add index `person_first_name_and_age_index` (`first_name`, `age` desc)
     * ```
     */
    column(column) {
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.cloneWithColumns(this.#props.node.addIndex, [
                    (0, reference_parser_js_1.parseOrderedColumnName)(column),
                ]),
            }),
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
     *   .alterTable('person')
     *   .addIndex('person_first_name_and_age_index')
     *   .columns(['first_name', 'age desc'])
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` add index `person_first_name_and_age_index` (`first_name`, `age` desc)
     * ```
     */
    columns(columns) {
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.cloneWithColumns(this.#props.node.addIndex, columns.map(reference_parser_js_1.parseOrderedColumnName)),
            }),
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
     *   .alterTable('person')
     *   .addIndex('person_first_name_index')
     *   .expression(sql<boolean>`(first_name < 'Sami')`)
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` add index `person_first_name_index` ((first_name < 'Sami'))
     * ```
     */
    expression(expression) {
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.cloneWithColumns(this.#props.node.addIndex, [
                    expression.toOperationNode(),
                ]),
            }),
        });
    }
    using(indexType) {
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.cloneWith(this.#props.node.addIndex, {
                    using: raw_node_js_1.RawNode.createWithSql(indexType),
                }),
            }),
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
exports.AlterTableAddIndexBuilder = AlterTableAddIndexBuilder;
