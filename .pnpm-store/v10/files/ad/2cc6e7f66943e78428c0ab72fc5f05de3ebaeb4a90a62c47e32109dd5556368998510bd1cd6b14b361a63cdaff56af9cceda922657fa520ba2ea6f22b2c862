"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlterTableColumnAlteringBuilder = exports.AlterTableBuilder = void 0;
const add_column_node_js_1 = require("../operation-node/add-column-node.js");
const alter_table_node_js_1 = require("../operation-node/alter-table-node.js");
const column_definition_node_js_1 = require("../operation-node/column-definition-node.js");
const drop_column_node_js_1 = require("../operation-node/drop-column-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const rename_column_node_js_1 = require("../operation-node/rename-column-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const column_definition_builder_js_1 = require("./column-definition-builder.js");
const modify_column_node_js_1 = require("../operation-node/modify-column-node.js");
const data_type_parser_js_1 = require("../parser/data-type-parser.js");
const foreign_key_constraint_builder_js_1 = require("./foreign-key-constraint-builder.js");
const add_constraint_node_js_1 = require("../operation-node/add-constraint-node.js");
const unique_constraint_node_js_1 = require("../operation-node/unique-constraint-node.js");
const check_constraint_node_js_1 = require("../operation-node/check-constraint-node.js");
const foreign_key_constraint_node_js_1 = require("../operation-node/foreign-key-constraint-node.js");
const column_node_js_1 = require("../operation-node/column-node.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const drop_constraint_node_js_1 = require("../operation-node/drop-constraint-node.js");
const alter_column_builder_js_1 = require("./alter-column-builder.js");
const alter_table_executor_js_1 = require("./alter-table-executor.js");
const alter_table_add_foreign_key_constraint_builder_js_1 = require("./alter-table-add-foreign-key-constraint-builder.js");
const alter_table_drop_constraint_builder_js_1 = require("./alter-table-drop-constraint-builder.js");
const primary_key_constraint_node_js_1 = require("../operation-node/primary-key-constraint-node.js");
const drop_index_node_js_1 = require("../operation-node/drop-index-node.js");
const add_index_node_js_1 = require("../operation-node/add-index-node.js");
const alter_table_add_index_builder_js_1 = require("./alter-table-add-index-builder.js");
const unique_constraint_builder_js_1 = require("./unique-constraint-builder.js");
const primary_key_constraint_builder_js_1 = require("./primary-key-constraint-builder.js");
const check_constraint_builder_js_1 = require("./check-constraint-builder.js");
const rename_constraint_node_js_1 = require("../operation-node/rename-constraint-node.js");
/**
 * This builder can be used to create a `alter table` query.
 */
class AlterTableBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    renameTo(newTableName) {
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                renameTo: (0, table_parser_js_1.parseTable)(newTableName),
            }),
        });
    }
    setSchema(newSchema) {
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                setSchema: identifier_node_js_1.IdentifierNode.create(newSchema),
            }),
        });
    }
    alterColumn(column, alteration) {
        const builder = alteration(new alter_column_builder_js_1.AlterColumnBuilder(column));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, builder.toOperationNode()),
        });
    }
    dropColumn(column) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, drop_column_node_js_1.DropColumnNode.create(column)),
        });
    }
    renameColumn(column, newColumn) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, rename_column_node_js_1.RenameColumnNode.create(column, newColumn)),
        });
    }
    addColumn(columnName, dataType, build = object_utils_js_1.noop) {
        const builder = build(new column_definition_builder_js_1.ColumnDefinitionBuilder(column_definition_node_js_1.ColumnDefinitionNode.create(columnName, (0, data_type_parser_js_1.parseDataTypeExpression)(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, add_column_node_js_1.AddColumnNode.create(builder.toOperationNode())),
        });
    }
    modifyColumn(columnName, dataType, build = object_utils_js_1.noop) {
        const builder = build(new column_definition_builder_js_1.ColumnDefinitionBuilder(column_definition_node_js_1.ColumnDefinitionNode.create(columnName, (0, data_type_parser_js_1.parseDataTypeExpression)(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, modify_column_node_js_1.ModifyColumnNode.create(builder.toOperationNode())),
        });
    }
    /**
     * See {@link CreateTableBuilder.addUniqueConstraint}
     */
    addUniqueConstraint(constraintName, columns, build = object_utils_js_1.noop) {
        const uniqueConstraintBuilder = build(new unique_constraint_builder_js_1.UniqueConstraintNodeBuilder(unique_constraint_node_js_1.UniqueConstraintNode.create(columns, constraintName)));
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: add_constraint_node_js_1.AddConstraintNode.create(uniqueConstraintBuilder.toOperationNode()),
            }),
        });
    }
    /**
     * See {@link CreateTableBuilder.addCheckConstraint}
     */
    addCheckConstraint(constraintName, checkExpression, build = object_utils_js_1.noop) {
        const constraintBuilder = build(new check_constraint_builder_js_1.CheckConstraintBuilder(check_constraint_node_js_1.CheckConstraintNode.create(checkExpression.toOperationNode(), constraintName)));
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: add_constraint_node_js_1.AddConstraintNode.create(constraintBuilder.toOperationNode()),
            }),
        });
    }
    /**
     * See {@link CreateTableBuilder.addForeignKeyConstraint}
     *
     * Unlike {@link CreateTableBuilder.addForeignKeyConstraint} this method returns
     * the constraint builder and doesn't take a callback as the last argument. This
     * is because you can only add one column per `ALTER TABLE` query.
     */
    addForeignKeyConstraint(constraintName, columns, targetTable, targetColumns, build = object_utils_js_1.noop) {
        const constraintBuilder = build(new foreign_key_constraint_builder_js_1.ForeignKeyConstraintBuilder(foreign_key_constraint_node_js_1.ForeignKeyConstraintNode.create(columns.map(column_node_js_1.ColumnNode.create), (0, table_parser_js_1.parseTable)(targetTable), targetColumns.map(column_node_js_1.ColumnNode.create), constraintName)));
        return new alter_table_add_foreign_key_constraint_builder_js_1.AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder,
        });
    }
    /**
     * See {@link CreateTableBuilder.addPrimaryKeyConstraint}
     */
    addPrimaryKeyConstraint(constraintName, columns, build = object_utils_js_1.noop) {
        const constraintBuilder = build(new primary_key_constraint_builder_js_1.PrimaryKeyConstraintBuilder(primary_key_constraint_node_js_1.PrimaryKeyConstraintNode.create(columns, constraintName)));
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: add_constraint_node_js_1.AddConstraintNode.create(constraintBuilder.toOperationNode()),
            }),
        });
    }
    dropConstraint(constraintName) {
        return new alter_table_drop_constraint_builder_js_1.AlterTableDropConstraintBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: drop_constraint_node_js_1.DropConstraintNode.create(constraintName),
            }),
        });
    }
    renameConstraint(oldName, newName) {
        return new alter_table_drop_constraint_builder_js_1.AlterTableDropConstraintBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                renameConstraint: rename_constraint_node_js_1.RenameConstraintNode.create(oldName, newName),
            }),
        });
    }
    /**
     * This can be used to add index to table.
     *
     *  ### Examples
     *
     * ```ts
     * db.schema.alterTable('person')
     *   .addIndex('person_email_index')
     *   .column('email')
     *   .unique()
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` add unique index `person_email_index` (`email`)
     * ```
     */
    addIndex(indexName) {
        return new alter_table_add_index_builder_js_1.AlterTableAddIndexBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: add_index_node_js_1.AddIndexNode.create(indexName),
            }),
        });
    }
    /**
     * This can be used to drop index from table.
     *
     * ### Examples
     *
     * ```ts
     * db.schema.alterTable('person')
     *   .dropIndex('person_email_index')
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * alter table `person` drop index `test_first_name_index`
     * ```
     */
    dropIndex(indexName) {
        return new alter_table_executor_js_1.AlterTableExecutor({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropIndex: drop_index_node_js_1.DropIndexNode.create(indexName),
            }),
        });
    }
    /**
     * Calls the given function passing `this` as the only argument.
     *
     * See {@link CreateTableBuilder.$call}
     */
    $call(func) {
        return func(this);
    }
}
exports.AlterTableBuilder = AlterTableBuilder;
class AlterTableColumnAlteringBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    alterColumn(column, alteration) {
        const builder = alteration(new alter_column_builder_js_1.AlterColumnBuilder(column));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, builder.toOperationNode()),
        });
    }
    dropColumn(column) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, drop_column_node_js_1.DropColumnNode.create(column)),
        });
    }
    renameColumn(column, newColumn) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, rename_column_node_js_1.RenameColumnNode.create(column, newColumn)),
        });
    }
    addColumn(columnName, dataType, build = object_utils_js_1.noop) {
        const builder = build(new column_definition_builder_js_1.ColumnDefinitionBuilder(column_definition_node_js_1.ColumnDefinitionNode.create(columnName, (0, data_type_parser_js_1.parseDataTypeExpression)(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, add_column_node_js_1.AddColumnNode.create(builder.toOperationNode())),
        });
    }
    modifyColumn(columnName, dataType, build = object_utils_js_1.noop) {
        const builder = build(new column_definition_builder_js_1.ColumnDefinitionBuilder(column_definition_node_js_1.ColumnDefinitionNode.create(columnName, (0, data_type_parser_js_1.parseDataTypeExpression)(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: alter_table_node_js_1.AlterTableNode.cloneWithColumnAlteration(this.#props.node, modify_column_node_js_1.ModifyColumnNode.create(builder.toOperationNode())),
        });
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
exports.AlterTableColumnAlteringBuilder = AlterTableColumnAlteringBuilder;
