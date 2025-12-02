/// <reference types="./alter-table-builder.d.ts" />
import { AddColumnNode } from '../operation-node/add-column-node.js';
import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { ColumnDefinitionNode } from '../operation-node/column-definition-node.js';
import { DropColumnNode } from '../operation-node/drop-column-node.js';
import { IdentifierNode } from '../operation-node/identifier-node.js';
import { RenameColumnNode } from '../operation-node/rename-column-node.js';
import { freeze, noop } from '../util/object-utils.js';
import { ColumnDefinitionBuilder, } from './column-definition-builder.js';
import { ModifyColumnNode } from '../operation-node/modify-column-node.js';
import { parseDataTypeExpression, } from '../parser/data-type-parser.js';
import { ForeignKeyConstraintBuilder, } from './foreign-key-constraint-builder.js';
import { AddConstraintNode } from '../operation-node/add-constraint-node.js';
import { UniqueConstraintNode } from '../operation-node/unique-constraint-node.js';
import { CheckConstraintNode } from '../operation-node/check-constraint-node.js';
import { ForeignKeyConstraintNode } from '../operation-node/foreign-key-constraint-node.js';
import { ColumnNode } from '../operation-node/column-node.js';
import { parseTable } from '../parser/table-parser.js';
import { DropConstraintNode } from '../operation-node/drop-constraint-node.js';
import { AlterColumnBuilder, } from './alter-column-builder.js';
import { AlterTableExecutor } from './alter-table-executor.js';
import { AlterTableAddForeignKeyConstraintBuilder } from './alter-table-add-foreign-key-constraint-builder.js';
import { AlterTableDropConstraintBuilder } from './alter-table-drop-constraint-builder.js';
import { PrimaryKeyConstraintNode } from '../operation-node/primary-key-constraint-node.js';
import { DropIndexNode } from '../operation-node/drop-index-node.js';
import { AddIndexNode } from '../operation-node/add-index-node.js';
import { AlterTableAddIndexBuilder } from './alter-table-add-index-builder.js';
import { UniqueConstraintNodeBuilder, } from './unique-constraint-builder.js';
import { PrimaryKeyConstraintBuilder, } from './primary-key-constraint-builder.js';
import { CheckConstraintBuilder, } from './check-constraint-builder.js';
import { RenameConstraintNode } from '../operation-node/rename-constraint-node.js';
/**
 * This builder can be used to create a `alter table` query.
 */
export class AlterTableBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    renameTo(newTableName) {
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                renameTo: parseTable(newTableName),
            }),
        });
    }
    setSchema(newSchema) {
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                setSchema: IdentifierNode.create(newSchema),
            }),
        });
    }
    alterColumn(column, alteration) {
        const builder = alteration(new AlterColumnBuilder(column));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, builder.toOperationNode()),
        });
    }
    dropColumn(column) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, DropColumnNode.create(column)),
        });
    }
    renameColumn(column, newColumn) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, RenameColumnNode.create(column, newColumn)),
        });
    }
    addColumn(columnName, dataType, build = noop) {
        const builder = build(new ColumnDefinitionBuilder(ColumnDefinitionNode.create(columnName, parseDataTypeExpression(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, AddColumnNode.create(builder.toOperationNode())),
        });
    }
    modifyColumn(columnName, dataType, build = noop) {
        const builder = build(new ColumnDefinitionBuilder(ColumnDefinitionNode.create(columnName, parseDataTypeExpression(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, ModifyColumnNode.create(builder.toOperationNode())),
        });
    }
    /**
     * See {@link CreateTableBuilder.addUniqueConstraint}
     */
    addUniqueConstraint(constraintName, columns, build = noop) {
        const uniqueConstraintBuilder = build(new UniqueConstraintNodeBuilder(UniqueConstraintNode.create(columns, constraintName)));
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: AddConstraintNode.create(uniqueConstraintBuilder.toOperationNode()),
            }),
        });
    }
    /**
     * See {@link CreateTableBuilder.addCheckConstraint}
     */
    addCheckConstraint(constraintName, checkExpression, build = noop) {
        const constraintBuilder = build(new CheckConstraintBuilder(CheckConstraintNode.create(checkExpression.toOperationNode(), constraintName)));
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: AddConstraintNode.create(constraintBuilder.toOperationNode()),
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
    addForeignKeyConstraint(constraintName, columns, targetTable, targetColumns, build = noop) {
        const constraintBuilder = build(new ForeignKeyConstraintBuilder(ForeignKeyConstraintNode.create(columns.map(ColumnNode.create), parseTable(targetTable), targetColumns.map(ColumnNode.create), constraintName)));
        return new AlterTableAddForeignKeyConstraintBuilder({
            ...this.#props,
            constraintBuilder,
        });
    }
    /**
     * See {@link CreateTableBuilder.addPrimaryKeyConstraint}
     */
    addPrimaryKeyConstraint(constraintName, columns, build = noop) {
        const constraintBuilder = build(new PrimaryKeyConstraintBuilder(PrimaryKeyConstraintNode.create(columns, constraintName)));
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                addConstraint: AddConstraintNode.create(constraintBuilder.toOperationNode()),
            }),
        });
    }
    dropConstraint(constraintName) {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropConstraint: DropConstraintNode.create(constraintName),
            }),
        });
    }
    renameConstraint(oldName, newName) {
        return new AlterTableDropConstraintBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                renameConstraint: RenameConstraintNode.create(oldName, newName),
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
        return new AlterTableAddIndexBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                addIndex: AddIndexNode.create(indexName),
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
        return new AlterTableExecutor({
            ...this.#props,
            node: AlterTableNode.cloneWithTableProps(this.#props.node, {
                dropIndex: DropIndexNode.create(indexName),
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
export class AlterTableColumnAlteringBuilder {
    #props;
    constructor(props) {
        this.#props = freeze(props);
    }
    alterColumn(column, alteration) {
        const builder = alteration(new AlterColumnBuilder(column));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, builder.toOperationNode()),
        });
    }
    dropColumn(column) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, DropColumnNode.create(column)),
        });
    }
    renameColumn(column, newColumn) {
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, RenameColumnNode.create(column, newColumn)),
        });
    }
    addColumn(columnName, dataType, build = noop) {
        const builder = build(new ColumnDefinitionBuilder(ColumnDefinitionNode.create(columnName, parseDataTypeExpression(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, AddColumnNode.create(builder.toOperationNode())),
        });
    }
    modifyColumn(columnName, dataType, build = noop) {
        const builder = build(new ColumnDefinitionBuilder(ColumnDefinitionNode.create(columnName, parseDataTypeExpression(dataType))));
        return new AlterTableColumnAlteringBuilder({
            ...this.#props,
            node: AlterTableNode.cloneWithColumnAlteration(this.#props.node, ModifyColumnNode.create(builder.toOperationNode())),
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
