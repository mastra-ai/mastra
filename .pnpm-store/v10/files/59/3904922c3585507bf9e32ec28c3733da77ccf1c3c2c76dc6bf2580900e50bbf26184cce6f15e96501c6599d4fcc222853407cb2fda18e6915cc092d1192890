"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelectQueryBuilder = createSelectQueryBuilder;
const alias_node_js_1 = require("../operation-node/alias-node.js");
const select_modifier_node_js_1 = require("../operation-node/select-modifier-node.js");
const join_parser_js_1 = require("../parser/join-parser.js");
const table_parser_js_1 = require("../parser/table-parser.js");
const select_parser_js_1 = require("../parser/select-parser.js");
const reference_parser_js_1 = require("../parser/reference-parser.js");
const select_query_node_js_1 = require("../operation-node/select-query-node.js");
const query_node_js_1 = require("../operation-node/query-node.js");
const order_by_parser_js_1 = require("../parser/order-by-parser.js");
const limit_node_js_1 = require("../operation-node/limit-node.js");
const offset_node_js_1 = require("../operation-node/offset-node.js");
const object_utils_js_1 = require("../util/object-utils.js");
const group_by_parser_js_1 = require("../parser/group-by-parser.js");
const no_result_error_js_1 = require("./no-result-error.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const set_operation_parser_js_1 = require("../parser/set-operation-parser.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const expression_wrapper_js_1 = require("../expression/expression-wrapper.js");
const value_parser_js_1 = require("../parser/value-parser.js");
const fetch_parser_js_1 = require("../parser/fetch-parser.js");
const top_parser_js_1 = require("../parser/top-parser.js");
class SelectQueryBuilderImpl {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    get expressionType() {
        return undefined;
    }
    get isSelectQueryBuilder() {
        return true;
    }
    where(...args) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithWhere(this.#props.queryNode, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)),
        });
    }
    whereRef(lhs, op, rhs) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithWhere(this.#props.queryNode, (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(lhs, op, rhs)),
        });
    }
    having(...args) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithHaving(this.#props.queryNode, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)),
        });
    }
    havingRef(lhs, op, rhs) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithHaving(this.#props.queryNode, (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(lhs, op, rhs)),
        });
    }
    select(selection) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSelections(this.#props.queryNode, (0, select_parser_js_1.parseSelectArg)(selection)),
        });
    }
    distinctOn(selection) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithDistinctOn(this.#props.queryNode, (0, reference_parser_js_1.parseReferenceExpressionOrList)(selection)),
        });
    }
    modifyFront(modifier) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithFrontModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.createWithExpression(modifier.toOperationNode())),
        });
    }
    modifyEnd(modifier) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.createWithExpression(modifier.toOperationNode())),
        });
    }
    distinct() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithFrontModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('Distinct')),
        });
    }
    forUpdate(of) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('ForUpdate', of ? (0, object_utils_js_1.asArray)(of).map(table_parser_js_1.parseTable) : undefined)),
        });
    }
    forShare(of) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('ForShare', of ? (0, object_utils_js_1.asArray)(of).map(table_parser_js_1.parseTable) : undefined)),
        });
    }
    forKeyShare(of) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('ForKeyShare', of ? (0, object_utils_js_1.asArray)(of).map(table_parser_js_1.parseTable) : undefined)),
        });
    }
    forNoKeyUpdate(of) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('ForNoKeyUpdate', of ? (0, object_utils_js_1.asArray)(of).map(table_parser_js_1.parseTable) : undefined)),
        });
    }
    skipLocked() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('SkipLocked')),
        });
    }
    noWait() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, select_modifier_node_js_1.SelectModifierNode.create('NoWait')),
        });
    }
    selectAll(table) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSelections(this.#props.queryNode, (0, select_parser_js_1.parseSelectAll)(table)),
        });
    }
    innerJoin(...args) {
        return this.#join('InnerJoin', args);
    }
    leftJoin(...args) {
        return this.#join('LeftJoin', args);
    }
    rightJoin(...args) {
        return this.#join('RightJoin', args);
    }
    fullJoin(...args) {
        return this.#join('FullJoin', args);
    }
    crossJoin(...args) {
        return this.#join('CrossJoin', args);
    }
    innerJoinLateral(...args) {
        return this.#join('LateralInnerJoin', args);
    }
    leftJoinLateral(...args) {
        return this.#join('LateralLeftJoin', args);
    }
    crossJoinLateral(...args) {
        return this.#join('LateralCrossJoin', args);
    }
    crossApply(...args) {
        return this.#join('CrossApply', args);
    }
    outerApply(...args) {
        return this.#join('OuterApply', args);
    }
    #join(joinType, args) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithJoin(this.#props.queryNode, (0, join_parser_js_1.parseJoin)(joinType, args)),
        });
    }
    orderBy(...args) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithOrderByItems(this.#props.queryNode, (0, order_by_parser_js_1.parseOrderBy)(args)),
        });
    }
    groupBy(groupBy) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithGroupByItems(this.#props.queryNode, (0, group_by_parser_js_1.parseGroupBy)(groupBy)),
        });
    }
    limit(limit) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithLimit(this.#props.queryNode, limit_node_js_1.LimitNode.create((0, value_parser_js_1.parseValueExpression)(limit))),
        });
    }
    offset(offset) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithOffset(this.#props.queryNode, offset_node_js_1.OffsetNode.create((0, value_parser_js_1.parseValueExpression)(offset))),
        });
    }
    fetch(rowCount, modifier = 'only') {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithFetch(this.#props.queryNode, (0, fetch_parser_js_1.parseFetch)(rowCount, modifier)),
        });
    }
    top(expression, modifiers) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithTop(this.#props.queryNode, (0, top_parser_js_1.parseTop)(expression, modifiers)),
        });
    }
    union(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('union', expression, false)),
        });
    }
    unionAll(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('union', expression, true)),
        });
    }
    intersect(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('intersect', expression, false)),
        });
    }
    intersectAll(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('intersect', expression, true)),
        });
    }
    except(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('except', expression, false)),
        });
    }
    exceptAll(expression) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSetOperations(this.#props.queryNode, (0, set_operation_parser_js_1.parseSetOperations)('except', expression, true)),
        });
    }
    as(alias) {
        return new AliasedSelectQueryBuilderImpl(this, alias);
    }
    clearSelect() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithoutSelections(this.#props.queryNode),
        });
    }
    clearWhere() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithoutWhere(this.#props.queryNode),
        });
    }
    clearLimit() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithoutLimit(this.#props.queryNode),
        });
    }
    clearOffset() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithoutOffset(this.#props.queryNode),
        });
    }
    clearOrderBy() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithoutOrderBy(this.#props.queryNode),
        });
    }
    clearGroupBy() {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithoutGroupBy(this.#props.queryNode),
        });
    }
    $call(func) {
        return func(this);
    }
    $if(condition, func) {
        if (condition) {
            return func(this);
        }
        return new SelectQueryBuilderImpl({
            ...this.#props,
        });
    }
    $castTo() {
        return new SelectQueryBuilderImpl(this.#props);
    }
    $narrowType() {
        return new SelectQueryBuilderImpl(this.#props);
    }
    $assertType() {
        return new SelectQueryBuilderImpl(this.#props);
    }
    $asTuple() {
        return new expression_wrapper_js_1.ExpressionWrapper(this.toOperationNode());
    }
    $asScalar() {
        return new expression_wrapper_js_1.ExpressionWrapper(this.toOperationNode());
    }
    withPlugin(plugin) {
        return new SelectQueryBuilderImpl({
            ...this.#props,
            executor: this.#props.executor.withPlugin(plugin),
        });
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.queryNode, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    async execute() {
        const compiledQuery = this.compile();
        const result = await this.#props.executor.executeQuery(compiledQuery);
        return result.rows;
    }
    async executeTakeFirst() {
        const [result] = await this.execute();
        return result;
    }
    async executeTakeFirstOrThrow(errorConstructor = no_result_error_js_1.NoResultError) {
        const result = await this.executeTakeFirst();
        if (result === undefined) {
            const error = (0, no_result_error_js_1.isNoResultErrorConstructor)(errorConstructor)
                ? new errorConstructor(this.toOperationNode())
                : errorConstructor(this.toOperationNode());
            throw error;
        }
        return result;
    }
    async *stream(chunkSize = 100) {
        const compiledQuery = this.compile();
        const stream = this.#props.executor.stream(compiledQuery, chunkSize);
        for await (const item of stream) {
            yield* item.rows;
        }
    }
    async explain(format, options) {
        const builder = new SelectQueryBuilderImpl({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithExplain(this.#props.queryNode, format, options),
        });
        return await builder.execute();
    }
}
function createSelectQueryBuilder(props) {
    return new SelectQueryBuilderImpl(props);
}
/**
 * {@link SelectQueryBuilder} with an alias. The result of calling {@link SelectQueryBuilder.as}.
 */
class AliasedSelectQueryBuilderImpl {
    #queryBuilder;
    #alias;
    constructor(queryBuilder, alias) {
        this.#queryBuilder = queryBuilder;
        this.#alias = alias;
    }
    get expression() {
        return this.#queryBuilder;
    }
    get alias() {
        return this.#alias;
    }
    get isAliasedSelectQueryBuilder() {
        return true;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create(this.#queryBuilder.toOperationNode(), identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
