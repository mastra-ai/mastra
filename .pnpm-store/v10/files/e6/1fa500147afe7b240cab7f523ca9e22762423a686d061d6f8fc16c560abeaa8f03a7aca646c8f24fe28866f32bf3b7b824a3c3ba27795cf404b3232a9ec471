import { AlterTableNode } from '../operation-node/alter-table-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { ColumnDefinitionBuilderCallback } from './column-definition-builder.js';
import { QueryId } from '../util/query-id.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { DataTypeExpression } from '../parser/data-type-parser.js';
import { ForeignKeyConstraintBuilderCallback } from './foreign-key-constraint-builder.js';
import { Expression } from '../expression/expression.js';
import { AlterColumnBuilderCallback } from './alter-column-builder.js';
import { AlterTableExecutor } from './alter-table-executor.js';
import { AlterTableAddForeignKeyConstraintBuilder } from './alter-table-add-foreign-key-constraint-builder.js';
import { AlterTableDropConstraintBuilder } from './alter-table-drop-constraint-builder.js';
import { AlterTableAddIndexBuilder } from './alter-table-add-index-builder.js';
import { UniqueConstraintNodeBuilderCallback } from './unique-constraint-builder.js';
import { PrimaryKeyConstraintBuilderCallback } from './primary-key-constraint-builder.js';
import { CheckConstraintBuilderCallback } from './check-constraint-builder.js';
/**
 * This builder can be used to create a `alter table` query.
 */
export declare class AlterTableBuilder implements ColumnAlteringInterface {
    #private;
    constructor(props: AlterTableBuilderProps);
    renameTo(newTableName: string): AlterTableExecutor;
    setSchema(newSchema: string): AlterTableExecutor;
    alterColumn(column: string, alteration: AlterColumnBuilderCallback): AlterTableColumnAlteringBuilder;
    dropColumn(column: string): AlterTableColumnAlteringBuilder;
    renameColumn(column: string, newColumn: string): AlterTableColumnAlteringBuilder;
    /**
     * See {@link CreateTableBuilder.addColumn}
     */
    addColumn(columnName: string, dataType: DataTypeExpression, build?: ColumnDefinitionBuilderCallback): AlterTableColumnAlteringBuilder;
    /**
     * Creates an `alter table modify column` query. The `modify column` statement
     * is only implemeted by MySQL and oracle AFAIK. On other databases you
     * should use the `alterColumn` method.
     */
    modifyColumn(columnName: string, dataType: DataTypeExpression, build?: ColumnDefinitionBuilderCallback): AlterTableColumnAlteringBuilder;
    /**
     * See {@link CreateTableBuilder.addUniqueConstraint}
     */
    addUniqueConstraint(constraintName: string, columns: string[], build?: UniqueConstraintNodeBuilderCallback): AlterTableExecutor;
    /**
     * See {@link CreateTableBuilder.addCheckConstraint}
     */
    addCheckConstraint(constraintName: string, checkExpression: Expression<any>, build?: CheckConstraintBuilderCallback): AlterTableExecutor;
    /**
     * See {@link CreateTableBuilder.addForeignKeyConstraint}
     *
     * Unlike {@link CreateTableBuilder.addForeignKeyConstraint} this method returns
     * the constraint builder and doesn't take a callback as the last argument. This
     * is because you can only add one column per `ALTER TABLE` query.
     */
    addForeignKeyConstraint(constraintName: string, columns: string[], targetTable: string, targetColumns: string[], build?: ForeignKeyConstraintBuilderCallback): AlterTableAddForeignKeyConstraintBuilder;
    /**
     * See {@link CreateTableBuilder.addPrimaryKeyConstraint}
     */
    addPrimaryKeyConstraint(constraintName: string, columns: string[], build?: PrimaryKeyConstraintBuilderCallback): AlterTableExecutor;
    dropConstraint(constraintName: string): AlterTableDropConstraintBuilder;
    renameConstraint(oldName: string, newName: string): AlterTableDropConstraintBuilder;
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
    addIndex(indexName: string): AlterTableAddIndexBuilder;
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
    dropIndex(indexName: string): AlterTableExecutor;
    /**
     * Calls the given function passing `this` as the only argument.
     *
     * See {@link CreateTableBuilder.$call}
     */
    $call<T>(func: (qb: this) => T): T;
}
export interface AlterTableBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: AlterTableNode;
}
export interface ColumnAlteringInterface {
    alterColumn(column: string, alteration: AlterColumnBuilderCallback): ColumnAlteringInterface;
    dropColumn(column: string): ColumnAlteringInterface;
    renameColumn(column: string, newColumn: string): ColumnAlteringInterface;
    /**
     * See {@link CreateTableBuilder.addColumn}
     */
    addColumn(columnName: string, dataType: DataTypeExpression, build?: ColumnDefinitionBuilderCallback): ColumnAlteringInterface;
    /**
     * Creates an `alter table modify column` query. The `modify column` statement
     * is only implemeted by MySQL and oracle AFAIK. On other databases you
     * should use the `alterColumn` method.
     */
    modifyColumn(columnName: string, dataType: DataTypeExpression, build: ColumnDefinitionBuilderCallback): ColumnAlteringInterface;
}
export declare class AlterTableColumnAlteringBuilder implements ColumnAlteringInterface, OperationNodeSource, Compilable {
    #private;
    constructor(props: AlterTableColumnAlteringBuilderProps);
    alterColumn(column: string, alteration: AlterColumnBuilderCallback): AlterTableColumnAlteringBuilder;
    dropColumn(column: string): AlterTableColumnAlteringBuilder;
    renameColumn(column: string, newColumn: string): AlterTableColumnAlteringBuilder;
    /**
     * See {@link CreateTableBuilder.addColumn}
     */
    addColumn(columnName: string, dataType: DataTypeExpression, build?: ColumnDefinitionBuilderCallback): AlterTableColumnAlteringBuilder;
    /**
     * Creates an `alter table modify column` query. The `modify column` statement
     * is only implemeted by MySQL and oracle AFAIK. On other databases you
     * should use the `alterColumn` method.
     */
    modifyColumn(columnName: string, dataType: DataTypeExpression, build?: ColumnDefinitionBuilderCallback): AlterTableColumnAlteringBuilder;
    toOperationNode(): AlterTableNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface AlterTableColumnAlteringBuilderProps extends AlterTableBuilderProps {
}
