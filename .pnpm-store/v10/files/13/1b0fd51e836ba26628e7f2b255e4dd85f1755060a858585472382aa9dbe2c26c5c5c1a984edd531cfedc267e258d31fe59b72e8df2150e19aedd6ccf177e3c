/// <reference types="./operation-node-transformer.d.ts" />
import { freeze } from '../util/object-utils.js';
import { requireAllProps } from '../util/require-all-props.js';
/**
 * Transforms an operation node tree into another one.
 *
 * Kysely queries are expressed internally as a tree of objects (operation nodes).
 * `OperationNodeTransformer` takes such a tree as its input and returns a
 * transformed deep copy of it. By default the `OperationNodeTransformer`
 * does nothing. You need to override one or more methods to make it do
 * something.
 *
 * There's a method for each node type. For example if you'd like to convert
 * each identifier (table name, column name, alias etc.) from camelCase to
 * snake_case, you'd do something like this:
 *
 * ```ts
 * import { type IdentifierNode, OperationNodeTransformer } from 'kysely'
 * import snakeCase from 'lodash/snakeCase'
 *
 * class CamelCaseTransformer extends OperationNodeTransformer {
 *   override transformIdentifier(node: IdentifierNode): IdentifierNode {
 *     node = super.transformIdentifier(node)
 *
 *     return {
 *       ...node,
 *       name: snakeCase(node.name),
 *     }
 *   }
 * }
 *
 * const transformer = new CamelCaseTransformer()
 *
 * const query = db.selectFrom('person').select(['first_name', 'last_name'])
 *
 * const tree = transformer.transformNode(query.toOperationNode())
 * ```
 */
export class OperationNodeTransformer {
    nodeStack = [];
    #transformers = freeze({
        AliasNode: this.transformAlias.bind(this),
        ColumnNode: this.transformColumn.bind(this),
        IdentifierNode: this.transformIdentifier.bind(this),
        SchemableIdentifierNode: this.transformSchemableIdentifier.bind(this),
        RawNode: this.transformRaw.bind(this),
        ReferenceNode: this.transformReference.bind(this),
        SelectQueryNode: this.transformSelectQuery.bind(this),
        SelectionNode: this.transformSelection.bind(this),
        TableNode: this.transformTable.bind(this),
        FromNode: this.transformFrom.bind(this),
        SelectAllNode: this.transformSelectAll.bind(this),
        AndNode: this.transformAnd.bind(this),
        OrNode: this.transformOr.bind(this),
        ValueNode: this.transformValue.bind(this),
        ValueListNode: this.transformValueList.bind(this),
        PrimitiveValueListNode: this.transformPrimitiveValueList.bind(this),
        ParensNode: this.transformParens.bind(this),
        JoinNode: this.transformJoin.bind(this),
        OperatorNode: this.transformOperator.bind(this),
        WhereNode: this.transformWhere.bind(this),
        InsertQueryNode: this.transformInsertQuery.bind(this),
        DeleteQueryNode: this.transformDeleteQuery.bind(this),
        ReturningNode: this.transformReturning.bind(this),
        CreateTableNode: this.transformCreateTable.bind(this),
        AddColumnNode: this.transformAddColumn.bind(this),
        ColumnDefinitionNode: this.transformColumnDefinition.bind(this),
        DropTableNode: this.transformDropTable.bind(this),
        DataTypeNode: this.transformDataType.bind(this),
        OrderByNode: this.transformOrderBy.bind(this),
        OrderByItemNode: this.transformOrderByItem.bind(this),
        GroupByNode: this.transformGroupBy.bind(this),
        GroupByItemNode: this.transformGroupByItem.bind(this),
        UpdateQueryNode: this.transformUpdateQuery.bind(this),
        ColumnUpdateNode: this.transformColumnUpdate.bind(this),
        LimitNode: this.transformLimit.bind(this),
        OffsetNode: this.transformOffset.bind(this),
        OnConflictNode: this.transformOnConflict.bind(this),
        OnDuplicateKeyNode: this.transformOnDuplicateKey.bind(this),
        CreateIndexNode: this.transformCreateIndex.bind(this),
        DropIndexNode: this.transformDropIndex.bind(this),
        ListNode: this.transformList.bind(this),
        PrimaryKeyConstraintNode: this.transformPrimaryKeyConstraint.bind(this),
        UniqueConstraintNode: this.transformUniqueConstraint.bind(this),
        ReferencesNode: this.transformReferences.bind(this),
        CheckConstraintNode: this.transformCheckConstraint.bind(this),
        WithNode: this.transformWith.bind(this),
        CommonTableExpressionNode: this.transformCommonTableExpression.bind(this),
        CommonTableExpressionNameNode: this.transformCommonTableExpressionName.bind(this),
        HavingNode: this.transformHaving.bind(this),
        CreateSchemaNode: this.transformCreateSchema.bind(this),
        DropSchemaNode: this.transformDropSchema.bind(this),
        AlterTableNode: this.transformAlterTable.bind(this),
        DropColumnNode: this.transformDropColumn.bind(this),
        RenameColumnNode: this.transformRenameColumn.bind(this),
        AlterColumnNode: this.transformAlterColumn.bind(this),
        ModifyColumnNode: this.transformModifyColumn.bind(this),
        AddConstraintNode: this.transformAddConstraint.bind(this),
        DropConstraintNode: this.transformDropConstraint.bind(this),
        RenameConstraintNode: this.transformRenameConstraint.bind(this),
        ForeignKeyConstraintNode: this.transformForeignKeyConstraint.bind(this),
        CreateViewNode: this.transformCreateView.bind(this),
        RefreshMaterializedViewNode: this.transformRefreshMaterializedView.bind(this),
        DropViewNode: this.transformDropView.bind(this),
        GeneratedNode: this.transformGenerated.bind(this),
        DefaultValueNode: this.transformDefaultValue.bind(this),
        OnNode: this.transformOn.bind(this),
        ValuesNode: this.transformValues.bind(this),
        SelectModifierNode: this.transformSelectModifier.bind(this),
        CreateTypeNode: this.transformCreateType.bind(this),
        DropTypeNode: this.transformDropType.bind(this),
        ExplainNode: this.transformExplain.bind(this),
        DefaultInsertValueNode: this.transformDefaultInsertValue.bind(this),
        AggregateFunctionNode: this.transformAggregateFunction.bind(this),
        OverNode: this.transformOver.bind(this),
        PartitionByNode: this.transformPartitionBy.bind(this),
        PartitionByItemNode: this.transformPartitionByItem.bind(this),
        SetOperationNode: this.transformSetOperation.bind(this),
        BinaryOperationNode: this.transformBinaryOperation.bind(this),
        UnaryOperationNode: this.transformUnaryOperation.bind(this),
        UsingNode: this.transformUsing.bind(this),
        FunctionNode: this.transformFunction.bind(this),
        CaseNode: this.transformCase.bind(this),
        WhenNode: this.transformWhen.bind(this),
        JSONReferenceNode: this.transformJSONReference.bind(this),
        JSONPathNode: this.transformJSONPath.bind(this),
        JSONPathLegNode: this.transformJSONPathLeg.bind(this),
        JSONOperatorChainNode: this.transformJSONOperatorChain.bind(this),
        TupleNode: this.transformTuple.bind(this),
        MergeQueryNode: this.transformMergeQuery.bind(this),
        MatchedNode: this.transformMatched.bind(this),
        AddIndexNode: this.transformAddIndex.bind(this),
        CastNode: this.transformCast.bind(this),
        FetchNode: this.transformFetch.bind(this),
        TopNode: this.transformTop.bind(this),
        OutputNode: this.transformOutput.bind(this),
        OrActionNode: this.transformOrAction.bind(this),
        CollateNode: this.transformCollate.bind(this),
    });
    transformNode(node, queryId) {
        if (!node) {
            return node;
        }
        this.nodeStack.push(node);
        const out = this.transformNodeImpl(node, queryId);
        this.nodeStack.pop();
        return freeze(out);
    }
    transformNodeImpl(node, queryId) {
        return this.#transformers[node.kind](node, queryId);
    }
    transformNodeList(list, queryId) {
        if (!list) {
            return list;
        }
        return freeze(list.map((node) => this.transformNode(node, queryId)));
    }
    transformSelectQuery(node, queryId) {
        return requireAllProps({
            kind: 'SelectQueryNode',
            from: this.transformNode(node.from, queryId),
            selections: this.transformNodeList(node.selections, queryId),
            distinctOn: this.transformNodeList(node.distinctOn, queryId),
            joins: this.transformNodeList(node.joins, queryId),
            groupBy: this.transformNode(node.groupBy, queryId),
            orderBy: this.transformNode(node.orderBy, queryId),
            where: this.transformNode(node.where, queryId),
            frontModifiers: this.transformNodeList(node.frontModifiers, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            limit: this.transformNode(node.limit, queryId),
            offset: this.transformNode(node.offset, queryId),
            with: this.transformNode(node.with, queryId),
            having: this.transformNode(node.having, queryId),
            explain: this.transformNode(node.explain, queryId),
            setOperations: this.transformNodeList(node.setOperations, queryId),
            fetch: this.transformNode(node.fetch, queryId),
            top: this.transformNode(node.top, queryId),
        });
    }
    transformSelection(node, queryId) {
        return requireAllProps({
            kind: 'SelectionNode',
            selection: this.transformNode(node.selection, queryId),
        });
    }
    transformColumn(node, queryId) {
        return requireAllProps({
            kind: 'ColumnNode',
            column: this.transformNode(node.column, queryId),
        });
    }
    transformAlias(node, queryId) {
        return requireAllProps({
            kind: 'AliasNode',
            node: this.transformNode(node.node, queryId),
            alias: this.transformNode(node.alias, queryId),
        });
    }
    transformTable(node, queryId) {
        return requireAllProps({
            kind: 'TableNode',
            table: this.transformNode(node.table, queryId),
        });
    }
    transformFrom(node, queryId) {
        return requireAllProps({
            kind: 'FromNode',
            froms: this.transformNodeList(node.froms, queryId),
        });
    }
    transformReference(node, queryId) {
        return requireAllProps({
            kind: 'ReferenceNode',
            column: this.transformNode(node.column, queryId),
            table: this.transformNode(node.table, queryId),
        });
    }
    transformAnd(node, queryId) {
        return requireAllProps({
            kind: 'AndNode',
            left: this.transformNode(node.left, queryId),
            right: this.transformNode(node.right, queryId),
        });
    }
    transformOr(node, queryId) {
        return requireAllProps({
            kind: 'OrNode',
            left: this.transformNode(node.left, queryId),
            right: this.transformNode(node.right, queryId),
        });
    }
    transformValueList(node, queryId) {
        return requireAllProps({
            kind: 'ValueListNode',
            values: this.transformNodeList(node.values, queryId),
        });
    }
    transformParens(node, queryId) {
        return requireAllProps({
            kind: 'ParensNode',
            node: this.transformNode(node.node, queryId),
        });
    }
    transformJoin(node, queryId) {
        return requireAllProps({
            kind: 'JoinNode',
            joinType: node.joinType,
            table: this.transformNode(node.table, queryId),
            on: this.transformNode(node.on, queryId),
        });
    }
    transformRaw(node, queryId) {
        return requireAllProps({
            kind: 'RawNode',
            sqlFragments: freeze([...node.sqlFragments]),
            parameters: this.transformNodeList(node.parameters, queryId),
        });
    }
    transformWhere(node, queryId) {
        return requireAllProps({
            kind: 'WhereNode',
            where: this.transformNode(node.where, queryId),
        });
    }
    transformInsertQuery(node, queryId) {
        return requireAllProps({
            kind: 'InsertQueryNode',
            into: this.transformNode(node.into, queryId),
            columns: this.transformNodeList(node.columns, queryId),
            values: this.transformNode(node.values, queryId),
            returning: this.transformNode(node.returning, queryId),
            onConflict: this.transformNode(node.onConflict, queryId),
            onDuplicateKey: this.transformNode(node.onDuplicateKey, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            with: this.transformNode(node.with, queryId),
            ignore: node.ignore,
            orAction: this.transformNode(node.orAction, queryId),
            replace: node.replace,
            explain: this.transformNode(node.explain, queryId),
            defaultValues: node.defaultValues,
            top: this.transformNode(node.top, queryId),
            output: this.transformNode(node.output, queryId),
        });
    }
    transformValues(node, queryId) {
        return requireAllProps({
            kind: 'ValuesNode',
            values: this.transformNodeList(node.values, queryId),
        });
    }
    transformDeleteQuery(node, queryId) {
        return requireAllProps({
            kind: 'DeleteQueryNode',
            from: this.transformNode(node.from, queryId),
            using: this.transformNode(node.using, queryId),
            joins: this.transformNodeList(node.joins, queryId),
            where: this.transformNode(node.where, queryId),
            returning: this.transformNode(node.returning, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            with: this.transformNode(node.with, queryId),
            orderBy: this.transformNode(node.orderBy, queryId),
            limit: this.transformNode(node.limit, queryId),
            explain: this.transformNode(node.explain, queryId),
            top: this.transformNode(node.top, queryId),
            output: this.transformNode(node.output, queryId),
        });
    }
    transformReturning(node, queryId) {
        return requireAllProps({
            kind: 'ReturningNode',
            selections: this.transformNodeList(node.selections, queryId),
        });
    }
    transformCreateTable(node, queryId) {
        return requireAllProps({
            kind: 'CreateTableNode',
            table: this.transformNode(node.table, queryId),
            columns: this.transformNodeList(node.columns, queryId),
            constraints: this.transformNodeList(node.constraints, queryId),
            temporary: node.temporary,
            ifNotExists: node.ifNotExists,
            onCommit: node.onCommit,
            frontModifiers: this.transformNodeList(node.frontModifiers, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            selectQuery: this.transformNode(node.selectQuery, queryId),
        });
    }
    transformColumnDefinition(node, queryId) {
        return requireAllProps({
            kind: 'ColumnDefinitionNode',
            column: this.transformNode(node.column, queryId),
            dataType: this.transformNode(node.dataType, queryId),
            references: this.transformNode(node.references, queryId),
            primaryKey: node.primaryKey,
            autoIncrement: node.autoIncrement,
            unique: node.unique,
            notNull: node.notNull,
            unsigned: node.unsigned,
            defaultTo: this.transformNode(node.defaultTo, queryId),
            check: this.transformNode(node.check, queryId),
            generated: this.transformNode(node.generated, queryId),
            frontModifiers: this.transformNodeList(node.frontModifiers, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            nullsNotDistinct: node.nullsNotDistinct,
            identity: node.identity,
            ifNotExists: node.ifNotExists,
        });
    }
    transformAddColumn(node, queryId) {
        return requireAllProps({
            kind: 'AddColumnNode',
            column: this.transformNode(node.column, queryId),
        });
    }
    transformDropTable(node, queryId) {
        return requireAllProps({
            kind: 'DropTableNode',
            table: this.transformNode(node.table, queryId),
            ifExists: node.ifExists,
            cascade: node.cascade,
        });
    }
    transformOrderBy(node, queryId) {
        return requireAllProps({
            kind: 'OrderByNode',
            items: this.transformNodeList(node.items, queryId),
        });
    }
    transformOrderByItem(node, queryId) {
        return requireAllProps({
            kind: 'OrderByItemNode',
            orderBy: this.transformNode(node.orderBy, queryId),
            direction: this.transformNode(node.direction, queryId),
            collation: this.transformNode(node.collation, queryId),
            nulls: node.nulls,
        });
    }
    transformGroupBy(node, queryId) {
        return requireAllProps({
            kind: 'GroupByNode',
            items: this.transformNodeList(node.items, queryId),
        });
    }
    transformGroupByItem(node, queryId) {
        return requireAllProps({
            kind: 'GroupByItemNode',
            groupBy: this.transformNode(node.groupBy, queryId),
        });
    }
    transformUpdateQuery(node, queryId) {
        return requireAllProps({
            kind: 'UpdateQueryNode',
            table: this.transformNode(node.table, queryId),
            from: this.transformNode(node.from, queryId),
            joins: this.transformNodeList(node.joins, queryId),
            where: this.transformNode(node.where, queryId),
            updates: this.transformNodeList(node.updates, queryId),
            returning: this.transformNode(node.returning, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            with: this.transformNode(node.with, queryId),
            explain: this.transformNode(node.explain, queryId),
            limit: this.transformNode(node.limit, queryId),
            top: this.transformNode(node.top, queryId),
            output: this.transformNode(node.output, queryId),
            orderBy: this.transformNode(node.orderBy, queryId),
        });
    }
    transformColumnUpdate(node, queryId) {
        return requireAllProps({
            kind: 'ColumnUpdateNode',
            column: this.transformNode(node.column, queryId),
            value: this.transformNode(node.value, queryId),
        });
    }
    transformLimit(node, queryId) {
        return requireAllProps({
            kind: 'LimitNode',
            limit: this.transformNode(node.limit, queryId),
        });
    }
    transformOffset(node, queryId) {
        return requireAllProps({
            kind: 'OffsetNode',
            offset: this.transformNode(node.offset, queryId),
        });
    }
    transformOnConflict(node, queryId) {
        return requireAllProps({
            kind: 'OnConflictNode',
            columns: this.transformNodeList(node.columns, queryId),
            constraint: this.transformNode(node.constraint, queryId),
            indexExpression: this.transformNode(node.indexExpression, queryId),
            indexWhere: this.transformNode(node.indexWhere, queryId),
            updates: this.transformNodeList(node.updates, queryId),
            updateWhere: this.transformNode(node.updateWhere, queryId),
            doNothing: node.doNothing,
        });
    }
    transformOnDuplicateKey(node, queryId) {
        return requireAllProps({
            kind: 'OnDuplicateKeyNode',
            updates: this.transformNodeList(node.updates, queryId),
        });
    }
    transformCreateIndex(node, queryId) {
        return requireAllProps({
            kind: 'CreateIndexNode',
            name: this.transformNode(node.name, queryId),
            table: this.transformNode(node.table, queryId),
            columns: this.transformNodeList(node.columns, queryId),
            unique: node.unique,
            using: this.transformNode(node.using, queryId),
            ifNotExists: node.ifNotExists,
            where: this.transformNode(node.where, queryId),
            nullsNotDistinct: node.nullsNotDistinct,
        });
    }
    transformList(node, queryId) {
        return requireAllProps({
            kind: 'ListNode',
            items: this.transformNodeList(node.items, queryId),
        });
    }
    transformDropIndex(node, queryId) {
        return requireAllProps({
            kind: 'DropIndexNode',
            name: this.transformNode(node.name, queryId),
            table: this.transformNode(node.table, queryId),
            ifExists: node.ifExists,
            cascade: node.cascade,
        });
    }
    transformPrimaryKeyConstraint(node, queryId) {
        return requireAllProps({
            kind: 'PrimaryKeyConstraintNode',
            columns: this.transformNodeList(node.columns, queryId),
            name: this.transformNode(node.name, queryId),
            deferrable: node.deferrable,
            initiallyDeferred: node.initiallyDeferred,
        });
    }
    transformUniqueConstraint(node, queryId) {
        return requireAllProps({
            kind: 'UniqueConstraintNode',
            columns: this.transformNodeList(node.columns, queryId),
            name: this.transformNode(node.name, queryId),
            nullsNotDistinct: node.nullsNotDistinct,
            deferrable: node.deferrable,
            initiallyDeferred: node.initiallyDeferred,
        });
    }
    transformForeignKeyConstraint(node, queryId) {
        return requireAllProps({
            kind: 'ForeignKeyConstraintNode',
            columns: this.transformNodeList(node.columns, queryId),
            references: this.transformNode(node.references, queryId),
            name: this.transformNode(node.name, queryId),
            onDelete: node.onDelete,
            onUpdate: node.onUpdate,
            deferrable: node.deferrable,
            initiallyDeferred: node.initiallyDeferred,
        });
    }
    transformSetOperation(node, queryId) {
        return requireAllProps({
            kind: 'SetOperationNode',
            operator: node.operator,
            expression: this.transformNode(node.expression, queryId),
            all: node.all,
        });
    }
    transformReferences(node, queryId) {
        return requireAllProps({
            kind: 'ReferencesNode',
            table: this.transformNode(node.table, queryId),
            columns: this.transformNodeList(node.columns, queryId),
            onDelete: node.onDelete,
            onUpdate: node.onUpdate,
        });
    }
    transformCheckConstraint(node, queryId) {
        return requireAllProps({
            kind: 'CheckConstraintNode',
            expression: this.transformNode(node.expression, queryId),
            name: this.transformNode(node.name, queryId),
        });
    }
    transformWith(node, queryId) {
        return requireAllProps({
            kind: 'WithNode',
            expressions: this.transformNodeList(node.expressions, queryId),
            recursive: node.recursive,
        });
    }
    transformCommonTableExpression(node, queryId) {
        return requireAllProps({
            kind: 'CommonTableExpressionNode',
            name: this.transformNode(node.name, queryId),
            materialized: node.materialized,
            expression: this.transformNode(node.expression, queryId),
        });
    }
    transformCommonTableExpressionName(node, queryId) {
        return requireAllProps({
            kind: 'CommonTableExpressionNameNode',
            table: this.transformNode(node.table, queryId),
            columns: this.transformNodeList(node.columns, queryId),
        });
    }
    transformHaving(node, queryId) {
        return requireAllProps({
            kind: 'HavingNode',
            having: this.transformNode(node.having, queryId),
        });
    }
    transformCreateSchema(node, queryId) {
        return requireAllProps({
            kind: 'CreateSchemaNode',
            schema: this.transformNode(node.schema, queryId),
            ifNotExists: node.ifNotExists,
        });
    }
    transformDropSchema(node, queryId) {
        return requireAllProps({
            kind: 'DropSchemaNode',
            schema: this.transformNode(node.schema, queryId),
            ifExists: node.ifExists,
            cascade: node.cascade,
        });
    }
    transformAlterTable(node, queryId) {
        return requireAllProps({
            kind: 'AlterTableNode',
            table: this.transformNode(node.table, queryId),
            renameTo: this.transformNode(node.renameTo, queryId),
            setSchema: this.transformNode(node.setSchema, queryId),
            columnAlterations: this.transformNodeList(node.columnAlterations, queryId),
            addConstraint: this.transformNode(node.addConstraint, queryId),
            dropConstraint: this.transformNode(node.dropConstraint, queryId),
            renameConstraint: this.transformNode(node.renameConstraint, queryId),
            addIndex: this.transformNode(node.addIndex, queryId),
            dropIndex: this.transformNode(node.dropIndex, queryId),
        });
    }
    transformDropColumn(node, queryId) {
        return requireAllProps({
            kind: 'DropColumnNode',
            column: this.transformNode(node.column, queryId),
        });
    }
    transformRenameColumn(node, queryId) {
        return requireAllProps({
            kind: 'RenameColumnNode',
            column: this.transformNode(node.column, queryId),
            renameTo: this.transformNode(node.renameTo, queryId),
        });
    }
    transformAlterColumn(node, queryId) {
        return requireAllProps({
            kind: 'AlterColumnNode',
            column: this.transformNode(node.column, queryId),
            dataType: this.transformNode(node.dataType, queryId),
            dataTypeExpression: this.transformNode(node.dataTypeExpression, queryId),
            setDefault: this.transformNode(node.setDefault, queryId),
            dropDefault: node.dropDefault,
            setNotNull: node.setNotNull,
            dropNotNull: node.dropNotNull,
        });
    }
    transformModifyColumn(node, queryId) {
        return requireAllProps({
            kind: 'ModifyColumnNode',
            column: this.transformNode(node.column, queryId),
        });
    }
    transformAddConstraint(node, queryId) {
        return requireAllProps({
            kind: 'AddConstraintNode',
            constraint: this.transformNode(node.constraint, queryId),
        });
    }
    transformDropConstraint(node, queryId) {
        return requireAllProps({
            kind: 'DropConstraintNode',
            constraintName: this.transformNode(node.constraintName, queryId),
            ifExists: node.ifExists,
            modifier: node.modifier,
        });
    }
    transformRenameConstraint(node, queryId) {
        return requireAllProps({
            kind: 'RenameConstraintNode',
            oldName: this.transformNode(node.oldName, queryId),
            newName: this.transformNode(node.newName, queryId),
        });
    }
    transformCreateView(node, queryId) {
        return requireAllProps({
            kind: 'CreateViewNode',
            name: this.transformNode(node.name, queryId),
            temporary: node.temporary,
            orReplace: node.orReplace,
            ifNotExists: node.ifNotExists,
            materialized: node.materialized,
            columns: this.transformNodeList(node.columns, queryId),
            as: this.transformNode(node.as, queryId),
        });
    }
    transformRefreshMaterializedView(node, queryId) {
        return requireAllProps({
            kind: 'RefreshMaterializedViewNode',
            name: this.transformNode(node.name, queryId),
            concurrently: node.concurrently,
            withNoData: node.withNoData,
        });
    }
    transformDropView(node, queryId) {
        return requireAllProps({
            kind: 'DropViewNode',
            name: this.transformNode(node.name, queryId),
            ifExists: node.ifExists,
            materialized: node.materialized,
            cascade: node.cascade,
        });
    }
    transformGenerated(node, queryId) {
        return requireAllProps({
            kind: 'GeneratedNode',
            byDefault: node.byDefault,
            always: node.always,
            identity: node.identity,
            stored: node.stored,
            expression: this.transformNode(node.expression, queryId),
        });
    }
    transformDefaultValue(node, queryId) {
        return requireAllProps({
            kind: 'DefaultValueNode',
            defaultValue: this.transformNode(node.defaultValue, queryId),
        });
    }
    transformOn(node, queryId) {
        return requireAllProps({
            kind: 'OnNode',
            on: this.transformNode(node.on, queryId),
        });
    }
    transformSelectModifier(node, queryId) {
        return requireAllProps({
            kind: 'SelectModifierNode',
            modifier: node.modifier,
            rawModifier: this.transformNode(node.rawModifier, queryId),
            of: this.transformNodeList(node.of, queryId),
        });
    }
    transformCreateType(node, queryId) {
        return requireAllProps({
            kind: 'CreateTypeNode',
            name: this.transformNode(node.name, queryId),
            enum: this.transformNode(node.enum, queryId),
        });
    }
    transformDropType(node, queryId) {
        return requireAllProps({
            kind: 'DropTypeNode',
            name: this.transformNode(node.name, queryId),
            ifExists: node.ifExists,
        });
    }
    transformExplain(node, queryId) {
        return requireAllProps({
            kind: 'ExplainNode',
            format: node.format,
            options: this.transformNode(node.options, queryId),
        });
    }
    transformSchemableIdentifier(node, queryId) {
        return requireAllProps({
            kind: 'SchemableIdentifierNode',
            schema: this.transformNode(node.schema, queryId),
            identifier: this.transformNode(node.identifier, queryId),
        });
    }
    transformAggregateFunction(node, queryId) {
        return requireAllProps({
            kind: 'AggregateFunctionNode',
            func: node.func,
            aggregated: this.transformNodeList(node.aggregated, queryId),
            distinct: node.distinct,
            orderBy: this.transformNode(node.orderBy, queryId),
            withinGroup: this.transformNode(node.withinGroup, queryId),
            filter: this.transformNode(node.filter, queryId),
            over: this.transformNode(node.over, queryId),
        });
    }
    transformOver(node, queryId) {
        return requireAllProps({
            kind: 'OverNode',
            orderBy: this.transformNode(node.orderBy, queryId),
            partitionBy: this.transformNode(node.partitionBy, queryId),
        });
    }
    transformPartitionBy(node, queryId) {
        return requireAllProps({
            kind: 'PartitionByNode',
            items: this.transformNodeList(node.items, queryId),
        });
    }
    transformPartitionByItem(node, queryId) {
        return requireAllProps({
            kind: 'PartitionByItemNode',
            partitionBy: this.transformNode(node.partitionBy, queryId),
        });
    }
    transformBinaryOperation(node, queryId) {
        return requireAllProps({
            kind: 'BinaryOperationNode',
            leftOperand: this.transformNode(node.leftOperand, queryId),
            operator: this.transformNode(node.operator, queryId),
            rightOperand: this.transformNode(node.rightOperand, queryId),
        });
    }
    transformUnaryOperation(node, queryId) {
        return requireAllProps({
            kind: 'UnaryOperationNode',
            operator: this.transformNode(node.operator, queryId),
            operand: this.transformNode(node.operand, queryId),
        });
    }
    transformUsing(node, queryId) {
        return requireAllProps({
            kind: 'UsingNode',
            tables: this.transformNodeList(node.tables, queryId),
        });
    }
    transformFunction(node, queryId) {
        return requireAllProps({
            kind: 'FunctionNode',
            func: node.func,
            arguments: this.transformNodeList(node.arguments, queryId),
        });
    }
    transformCase(node, queryId) {
        return requireAllProps({
            kind: 'CaseNode',
            value: this.transformNode(node.value, queryId),
            when: this.transformNodeList(node.when, queryId),
            else: this.transformNode(node.else, queryId),
            isStatement: node.isStatement,
        });
    }
    transformWhen(node, queryId) {
        return requireAllProps({
            kind: 'WhenNode',
            condition: this.transformNode(node.condition, queryId),
            result: this.transformNode(node.result, queryId),
        });
    }
    transformJSONReference(node, queryId) {
        return requireAllProps({
            kind: 'JSONReferenceNode',
            reference: this.transformNode(node.reference, queryId),
            traversal: this.transformNode(node.traversal, queryId),
        });
    }
    transformJSONPath(node, queryId) {
        return requireAllProps({
            kind: 'JSONPathNode',
            inOperator: this.transformNode(node.inOperator, queryId),
            pathLegs: this.transformNodeList(node.pathLegs, queryId),
        });
    }
    transformJSONPathLeg(node, _queryId) {
        return requireAllProps({
            kind: 'JSONPathLegNode',
            type: node.type,
            value: node.value,
        });
    }
    transformJSONOperatorChain(node, queryId) {
        return requireAllProps({
            kind: 'JSONOperatorChainNode',
            operator: this.transformNode(node.operator, queryId),
            values: this.transformNodeList(node.values, queryId),
        });
    }
    transformTuple(node, queryId) {
        return requireAllProps({
            kind: 'TupleNode',
            values: this.transformNodeList(node.values, queryId),
        });
    }
    transformMergeQuery(node, queryId) {
        return requireAllProps({
            kind: 'MergeQueryNode',
            into: this.transformNode(node.into, queryId),
            using: this.transformNode(node.using, queryId),
            whens: this.transformNodeList(node.whens, queryId),
            with: this.transformNode(node.with, queryId),
            top: this.transformNode(node.top, queryId),
            endModifiers: this.transformNodeList(node.endModifiers, queryId),
            output: this.transformNode(node.output, queryId),
            returning: this.transformNode(node.returning, queryId),
        });
    }
    transformMatched(node, _queryId) {
        return requireAllProps({
            kind: 'MatchedNode',
            not: node.not,
            bySource: node.bySource,
        });
    }
    transformAddIndex(node, queryId) {
        return requireAllProps({
            kind: 'AddIndexNode',
            name: this.transformNode(node.name, queryId),
            columns: this.transformNodeList(node.columns, queryId),
            unique: node.unique,
            using: this.transformNode(node.using, queryId),
            ifNotExists: node.ifNotExists,
        });
    }
    transformCast(node, queryId) {
        return requireAllProps({
            kind: 'CastNode',
            expression: this.transformNode(node.expression, queryId),
            dataType: this.transformNode(node.dataType, queryId),
        });
    }
    transformFetch(node, queryId) {
        return requireAllProps({
            kind: 'FetchNode',
            rowCount: this.transformNode(node.rowCount, queryId),
            modifier: node.modifier,
        });
    }
    transformTop(node, _queryId) {
        return requireAllProps({
            kind: 'TopNode',
            expression: node.expression,
            modifiers: node.modifiers,
        });
    }
    transformOutput(node, queryId) {
        return requireAllProps({
            kind: 'OutputNode',
            selections: this.transformNodeList(node.selections, queryId),
        });
    }
    transformDataType(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformSelectAll(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformIdentifier(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformValue(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformPrimitiveValueList(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformOperator(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformDefaultInsertValue(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformOrAction(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
    transformCollate(node, _queryId) {
        // An Object.freezed leaf node. No need to clone.
        return node;
    }
}
