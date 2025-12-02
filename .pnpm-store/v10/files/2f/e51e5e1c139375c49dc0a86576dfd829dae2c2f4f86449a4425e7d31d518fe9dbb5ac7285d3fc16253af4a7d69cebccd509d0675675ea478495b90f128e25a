import { AliasNode } from './alias-node.js';
import { ColumnNode } from './column-node.js';
import { IdentifierNode } from './identifier-node.js';
import { OperationNode } from './operation-node.js';
import { ReferenceNode } from './reference-node.js';
import { SelectAllNode } from './select-all-node.js';
import { SelectionNode } from './selection-node.js';
import { TableNode } from './table-node.js';
import { AndNode } from './and-node.js';
import { JoinNode } from './join-node.js';
import { OrNode } from './or-node.js';
import { ParensNode } from './parens-node.js';
import { PrimitiveValueListNode } from './primitive-value-list-node.js';
import { RawNode } from './raw-node.js';
import { SelectQueryNode } from './select-query-node.js';
import { ValueListNode } from './value-list-node.js';
import { ValueNode } from './value-node.js';
import { OperatorNode } from './operator-node.js';
import { FromNode } from './from-node.js';
import { WhereNode } from './where-node.js';
import { InsertQueryNode } from './insert-query-node.js';
import { DeleteQueryNode } from './delete-query-node.js';
import { ReturningNode } from './returning-node.js';
import { CreateTableNode } from './create-table-node.js';
import { AddColumnNode } from './add-column-node.js';
import { DropTableNode } from './drop-table-node.js';
import { DataTypeNode } from './data-type-node.js';
import { OrderByNode } from './order-by-node.js';
import { OrderByItemNode } from './order-by-item-node.js';
import { GroupByNode } from './group-by-node.js';
import { GroupByItemNode } from './group-by-item-node.js';
import { UpdateQueryNode } from './update-query-node.js';
import { ColumnUpdateNode } from './column-update-node.js';
import { LimitNode } from './limit-node.js';
import { OffsetNode } from './offset-node.js';
import { OnConflictNode } from './on-conflict-node.js';
import { CreateIndexNode } from './create-index-node.js';
import { ListNode } from './list-node.js';
import { DropIndexNode } from './drop-index-node.js';
import { PrimaryKeyConstraintNode } from './primary-key-constraint-node.js';
import { UniqueConstraintNode } from './unique-constraint-node.js';
import { ReferencesNode } from './references-node.js';
import { CheckConstraintNode } from './check-constraint-node.js';
import { WithNode } from './with-node.js';
import { CommonTableExpressionNode } from './common-table-expression-node.js';
import { CommonTableExpressionNameNode } from './common-table-expression-name-node.js';
import { HavingNode } from './having-node.js';
import { CreateSchemaNode } from './create-schema-node.js';
import { DropSchemaNode } from './drop-schema-node.js';
import { AlterTableNode } from './alter-table-node.js';
import { DropColumnNode } from './drop-column-node.js';
import { RenameColumnNode } from './rename-column-node.js';
import { AlterColumnNode } from './alter-column-node.js';
import { AddConstraintNode } from './add-constraint-node.js';
import { DropConstraintNode } from './drop-constraint-node.js';
import { ForeignKeyConstraintNode } from './foreign-key-constraint-node.js';
import { ColumnDefinitionNode } from './column-definition-node.js';
import { ModifyColumnNode } from './modify-column-node.js';
import { OnDuplicateKeyNode } from './on-duplicate-key-node.js';
import { CreateViewNode } from './create-view-node.js';
import { DropViewNode } from './drop-view-node.js';
import { GeneratedNode } from './generated-node.js';
import { DefaultValueNode } from './default-value-node.js';
import { OnNode } from './on-node.js';
import { ValuesNode } from './values-node.js';
import { SelectModifierNode } from './select-modifier-node.js';
import { CreateTypeNode } from './create-type-node.js';
import { DropTypeNode } from './drop-type-node.js';
import { ExplainNode } from './explain-node.js';
import { SchemableIdentifierNode } from './schemable-identifier-node.js';
import { DefaultInsertValueNode } from './default-insert-value-node.js';
import { AggregateFunctionNode } from './aggregate-function-node.js';
import { OverNode } from './over-node.js';
import { PartitionByNode } from './partition-by-node.js';
import { PartitionByItemNode } from './partition-by-item-node.js';
import { SetOperationNode } from './set-operation-node.js';
import { BinaryOperationNode } from './binary-operation-node.js';
import { UnaryOperationNode } from './unary-operation-node.js';
import { UsingNode } from './using-node.js';
import { FunctionNode } from './function-node.js';
import { CaseNode } from './case-node.js';
import { WhenNode } from './when-node.js';
import { JSONReferenceNode } from './json-reference-node.js';
import { JSONPathNode } from './json-path-node.js';
import { JSONPathLegNode } from './json-path-leg-node.js';
import { JSONOperatorChainNode } from './json-operator-chain-node.js';
import { TupleNode } from './tuple-node.js';
import { MergeQueryNode } from './merge-query-node.js';
import { MatchedNode } from './matched-node.js';
import { AddIndexNode } from './add-index-node.js';
import { CastNode } from './cast-node.js';
import { FetchNode } from './fetch-node.js';
import { TopNode } from './top-node.js';
import { OutputNode } from './output-node.js';
import { RefreshMaterializedViewNode } from './refresh-materialized-view-node.js';
import { OrActionNode } from './or-action-node.js';
import { CollateNode } from './collate-node.js';
import { QueryId } from '../util/query-id.js';
import { RenameConstraintNode } from './rename-constraint-node.js';
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
export declare class OperationNodeTransformer {
    #private;
    protected readonly nodeStack: OperationNode[];
    transformNode<T extends OperationNode | undefined>(node: T, queryId?: QueryId): T;
    protected transformNodeImpl<T extends OperationNode>(node: T, queryId?: QueryId): T;
    protected transformNodeList<T extends ReadonlyArray<OperationNode> | undefined>(list: T, queryId?: QueryId): T;
    protected transformSelectQuery(node: SelectQueryNode, queryId?: QueryId): SelectQueryNode;
    protected transformSelection(node: SelectionNode, queryId?: QueryId): SelectionNode;
    protected transformColumn(node: ColumnNode, queryId?: QueryId): ColumnNode;
    protected transformAlias(node: AliasNode, queryId?: QueryId): AliasNode;
    protected transformTable(node: TableNode, queryId?: QueryId): TableNode;
    protected transformFrom(node: FromNode, queryId?: QueryId): FromNode;
    protected transformReference(node: ReferenceNode, queryId?: QueryId): ReferenceNode;
    protected transformAnd(node: AndNode, queryId?: QueryId): AndNode;
    protected transformOr(node: OrNode, queryId?: QueryId): OrNode;
    protected transformValueList(node: ValueListNode, queryId?: QueryId): ValueListNode;
    protected transformParens(node: ParensNode, queryId?: QueryId): ParensNode;
    protected transformJoin(node: JoinNode, queryId?: QueryId): JoinNode;
    protected transformRaw(node: RawNode, queryId?: QueryId): RawNode;
    protected transformWhere(node: WhereNode, queryId?: QueryId): WhereNode;
    protected transformInsertQuery(node: InsertQueryNode, queryId?: QueryId): InsertQueryNode;
    protected transformValues(node: ValuesNode, queryId?: QueryId): ValuesNode;
    protected transformDeleteQuery(node: DeleteQueryNode, queryId?: QueryId): DeleteQueryNode;
    protected transformReturning(node: ReturningNode, queryId?: QueryId): ReturningNode;
    protected transformCreateTable(node: CreateTableNode, queryId?: QueryId): CreateTableNode;
    protected transformColumnDefinition(node: ColumnDefinitionNode, queryId?: QueryId): ColumnDefinitionNode;
    protected transformAddColumn(node: AddColumnNode, queryId?: QueryId): AddColumnNode;
    protected transformDropTable(node: DropTableNode, queryId?: QueryId): DropTableNode;
    protected transformOrderBy(node: OrderByNode, queryId?: QueryId): OrderByNode;
    protected transformOrderByItem(node: OrderByItemNode, queryId?: QueryId): OrderByItemNode;
    protected transformGroupBy(node: GroupByNode, queryId?: QueryId): GroupByNode;
    protected transformGroupByItem(node: GroupByItemNode, queryId?: QueryId): GroupByItemNode;
    protected transformUpdateQuery(node: UpdateQueryNode, queryId?: QueryId): UpdateQueryNode;
    protected transformColumnUpdate(node: ColumnUpdateNode, queryId?: QueryId): ColumnUpdateNode;
    protected transformLimit(node: LimitNode, queryId?: QueryId): LimitNode;
    protected transformOffset(node: OffsetNode, queryId?: QueryId): OffsetNode;
    protected transformOnConflict(node: OnConflictNode, queryId?: QueryId): OnConflictNode;
    protected transformOnDuplicateKey(node: OnDuplicateKeyNode, queryId?: QueryId): OnDuplicateKeyNode;
    protected transformCreateIndex(node: CreateIndexNode, queryId?: QueryId): CreateIndexNode;
    protected transformList(node: ListNode, queryId?: QueryId): ListNode;
    protected transformDropIndex(node: DropIndexNode, queryId?: QueryId): DropIndexNode;
    protected transformPrimaryKeyConstraint(node: PrimaryKeyConstraintNode, queryId?: QueryId): PrimaryKeyConstraintNode;
    protected transformUniqueConstraint(node: UniqueConstraintNode, queryId?: QueryId): UniqueConstraintNode;
    protected transformForeignKeyConstraint(node: ForeignKeyConstraintNode, queryId?: QueryId): ForeignKeyConstraintNode;
    protected transformSetOperation(node: SetOperationNode, queryId?: QueryId): SetOperationNode;
    protected transformReferences(node: ReferencesNode, queryId?: QueryId): ReferencesNode;
    protected transformCheckConstraint(node: CheckConstraintNode, queryId?: QueryId): CheckConstraintNode;
    protected transformWith(node: WithNode, queryId?: QueryId): WithNode;
    protected transformCommonTableExpression(node: CommonTableExpressionNode, queryId?: QueryId): CommonTableExpressionNode;
    protected transformCommonTableExpressionName(node: CommonTableExpressionNameNode, queryId?: QueryId): CommonTableExpressionNameNode;
    protected transformHaving(node: HavingNode, queryId?: QueryId): HavingNode;
    protected transformCreateSchema(node: CreateSchemaNode, queryId?: QueryId): CreateSchemaNode;
    protected transformDropSchema(node: DropSchemaNode, queryId?: QueryId): DropSchemaNode;
    protected transformAlterTable(node: AlterTableNode, queryId?: QueryId): AlterTableNode;
    protected transformDropColumn(node: DropColumnNode, queryId?: QueryId): DropColumnNode;
    protected transformRenameColumn(node: RenameColumnNode, queryId?: QueryId): RenameColumnNode;
    protected transformAlterColumn(node: AlterColumnNode, queryId?: QueryId): AlterColumnNode;
    protected transformModifyColumn(node: ModifyColumnNode, queryId?: QueryId): ModifyColumnNode;
    protected transformAddConstraint(node: AddConstraintNode, queryId?: QueryId): AddConstraintNode;
    protected transformDropConstraint(node: DropConstraintNode, queryId?: QueryId): DropConstraintNode;
    protected transformRenameConstraint(node: RenameConstraintNode, queryId?: QueryId): RenameConstraintNode;
    protected transformCreateView(node: CreateViewNode, queryId?: QueryId): CreateViewNode;
    protected transformRefreshMaterializedView(node: RefreshMaterializedViewNode, queryId?: QueryId): RefreshMaterializedViewNode;
    protected transformDropView(node: DropViewNode, queryId?: QueryId): DropViewNode;
    protected transformGenerated(node: GeneratedNode, queryId?: QueryId): GeneratedNode;
    protected transformDefaultValue(node: DefaultValueNode, queryId?: QueryId): DefaultValueNode;
    protected transformOn(node: OnNode, queryId?: QueryId): OnNode;
    protected transformSelectModifier(node: SelectModifierNode, queryId?: QueryId): SelectModifierNode;
    protected transformCreateType(node: CreateTypeNode, queryId?: QueryId): CreateTypeNode;
    protected transformDropType(node: DropTypeNode, queryId?: QueryId): DropTypeNode;
    protected transformExplain(node: ExplainNode, queryId?: QueryId): ExplainNode;
    protected transformSchemableIdentifier(node: SchemableIdentifierNode, queryId?: QueryId): SchemableIdentifierNode;
    protected transformAggregateFunction(node: AggregateFunctionNode, queryId?: QueryId): AggregateFunctionNode;
    protected transformOver(node: OverNode, queryId?: QueryId): OverNode;
    protected transformPartitionBy(node: PartitionByNode, queryId?: QueryId): PartitionByNode;
    protected transformPartitionByItem(node: PartitionByItemNode, queryId?: QueryId): PartitionByItemNode;
    protected transformBinaryOperation(node: BinaryOperationNode, queryId?: QueryId): BinaryOperationNode;
    protected transformUnaryOperation(node: UnaryOperationNode, queryId?: QueryId): UnaryOperationNode;
    protected transformUsing(node: UsingNode, queryId?: QueryId): UsingNode;
    protected transformFunction(node: FunctionNode, queryId?: QueryId): FunctionNode;
    protected transformCase(node: CaseNode, queryId?: QueryId): CaseNode;
    protected transformWhen(node: WhenNode, queryId?: QueryId): WhenNode;
    protected transformJSONReference(node: JSONReferenceNode, queryId?: QueryId): JSONReferenceNode;
    protected transformJSONPath(node: JSONPathNode, queryId?: QueryId): JSONPathNode;
    protected transformJSONPathLeg(node: JSONPathLegNode, _queryId?: QueryId): JSONPathLegNode;
    protected transformJSONOperatorChain(node: JSONOperatorChainNode, queryId?: QueryId): JSONOperatorChainNode;
    protected transformTuple(node: TupleNode, queryId?: QueryId): TupleNode;
    protected transformMergeQuery(node: MergeQueryNode, queryId?: QueryId): MergeQueryNode;
    protected transformMatched(node: MatchedNode, _queryId?: QueryId): MatchedNode;
    protected transformAddIndex(node: AddIndexNode, queryId?: QueryId): AddIndexNode;
    protected transformCast(node: CastNode, queryId?: QueryId): CastNode;
    protected transformFetch(node: FetchNode, queryId?: QueryId): FetchNode;
    protected transformTop(node: TopNode, _queryId?: QueryId): TopNode;
    protected transformOutput(node: OutputNode, queryId?: QueryId): OutputNode;
    protected transformDataType(node: DataTypeNode, _queryId?: QueryId): DataTypeNode;
    protected transformSelectAll(node: SelectAllNode, _queryId?: QueryId): SelectAllNode;
    protected transformIdentifier(node: IdentifierNode, _queryId?: QueryId): IdentifierNode;
    protected transformValue(node: ValueNode, _queryId?: QueryId): ValueNode;
    protected transformPrimitiveValueList(node: PrimitiveValueListNode, _queryId?: QueryId): PrimitiveValueListNode;
    protected transformOperator(node: OperatorNode, _queryId?: QueryId): OperatorNode;
    protected transformDefaultInsertValue(node: DefaultInsertValueNode, _queryId?: QueryId): DefaultInsertValueNode;
    protected transformOrAction(node: OrActionNode, _queryId?: QueryId): OrActionNode;
    protected transformCollate(node: CollateNode, _queryId?: QueryId): CollateNode;
}
