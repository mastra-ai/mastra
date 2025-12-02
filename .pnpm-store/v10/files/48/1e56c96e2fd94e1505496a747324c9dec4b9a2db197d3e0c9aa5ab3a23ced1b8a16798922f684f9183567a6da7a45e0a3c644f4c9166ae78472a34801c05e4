"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AliasedAggregateFunctionBuilder = exports.AggregateFunctionBuilder = void 0;
const object_utils_js_1 = require("../util/object-utils.js");
const aggregate_function_node_js_1 = require("../operation-node/aggregate-function-node.js");
const alias_node_js_1 = require("../operation-node/alias-node.js");
const identifier_node_js_1 = require("../operation-node/identifier-node.js");
const parse_utils_js_1 = require("../parser/parse-utils.js");
const binary_operation_parser_js_1 = require("../parser/binary-operation-parser.js");
const order_by_parser_js_1 = require("../parser/order-by-parser.js");
const query_node_js_1 = require("../operation-node/query-node.js");
class AggregateFunctionBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /** @private */
    get expressionType() {
        return undefined;
    }
    /**
     * Returns an aliased version of the function.
     *
     * In addition to slapping `as "the_alias"` to the end of the SQL,
     * this method also provides strict typing:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(
     *     (eb) => eb.fn.count<number>('id').as('person_count')
     *   )
     *   .executeTakeFirstOrThrow()
     *
     * // `person_count: number` field exists in the result type.
     * console.log(result.person_count)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select count("id") as "person_count"
     * from "person"
     * ```
     */
    as(alias) {
        return new AliasedAggregateFunctionBuilder(this, alias);
    }
    /**
     * Adds a `distinct` clause inside the function.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) =>
     *     eb.fn.count<number>('first_name').distinct().as('first_name_count')
     *   )
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select count(distinct "first_name") as "first_name_count"
     * from "person"
     * ```
     */
    distinct() {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.cloneWithDistinct(this.#props.aggregateFunctionNode),
        });
    }
    orderBy(...args) {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: query_node_js_1.QueryNode.cloneWithOrderByItems(this.#props.aggregateFunctionNode, (0, order_by_parser_js_1.parseOrderBy)(args)),
        });
    }
    clearOrderBy() {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: query_node_js_1.QueryNode.cloneWithoutOrderBy(this.#props.aggregateFunctionNode),
        });
    }
    withinGroupOrderBy(...args) {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.cloneWithOrderBy(this.#props.aggregateFunctionNode, (0, order_by_parser_js_1.parseOrderBy)(args), true),
        });
    }
    filterWhere(...args) {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.cloneWithFilter(this.#props.aggregateFunctionNode, (0, binary_operation_parser_js_1.parseValueBinaryOperationOrExpression)(args)),
        });
    }
    /**
     * Adds a `filter` clause with a nested `where` clause after the function, where
     * both sides of the operator are references to columns.
     *
     * Similar to {@link WhereInterface}'s `whereRef` method.
     *
     * ### Examples
     *
     * Count people with same first and last names versus general public:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) => [
     *     eb.fn
     *       .count<number>('id')
     *       .filterWhereRef('first_name', '=', 'last_name')
     *       .as('repeat_name_count'),
     *     eb.fn.count<number>('id').as('total_count'),
     *   ])
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   count("id") filter(where "first_name" = "last_name") as "repeat_name_count",
     *   count("id") as "total_count"
     * from "person"
     * ```
     */
    filterWhereRef(lhs, op, rhs) {
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.cloneWithFilter(this.#props.aggregateFunctionNode, (0, binary_operation_parser_js_1.parseReferentialBinaryOperation)(lhs, op, rhs)),
        });
    }
    /**
     * Adds an `over` clause (window functions) after the function.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(
     *     (eb) => eb.fn.avg<number>('age').over().as('average_age')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select avg("age") over() as "average_age"
     * from "person"
     * ```
     *
     * Also supports passing a callback that returns an over builder,
     * allowing to add partition by and sort by clauses inside over.
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(
     *     (eb) => eb.fn.avg<number>('age').over(
     *       ob => ob.partitionBy('last_name').orderBy('first_name', 'asc')
     *     ).as('average_age')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select avg("age") over(partition by "last_name" order by "first_name" asc) as "average_age"
     * from "person"
     * ```
     */
    over(over) {
        const builder = (0, parse_utils_js_1.createOverBuilder)();
        return new AggregateFunctionBuilder({
            ...this.#props,
            aggregateFunctionNode: aggregate_function_node_js_1.AggregateFunctionNode.cloneWithOver(this.#props.aggregateFunctionNode, (over ? over(builder) : builder).toOperationNode()),
        });
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call(func) {
        return func(this);
    }
    /**
     * Casts the expression to the given type.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `AggregateFunctionBuilder` with a new output type.
     */
    $castTo() {
        return new AggregateFunctionBuilder(this.#props);
    }
    /**
     * Omit null from the expression's type.
     *
     * This function can be useful in cases where you know an expression can't be
     * null, but Kysely is unable to infer it.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of `this` with a new output type.
     */
    $notNull() {
        return new AggregateFunctionBuilder(this.#props);
    }
    toOperationNode() {
        return this.#props.aggregateFunctionNode;
    }
}
exports.AggregateFunctionBuilder = AggregateFunctionBuilder;
/**
 * {@link AggregateFunctionBuilder} with an alias. The result of calling {@link AggregateFunctionBuilder.as}.
 */
class AliasedAggregateFunctionBuilder {
    #aggregateFunctionBuilder;
    #alias;
    constructor(aggregateFunctionBuilder, alias) {
        this.#aggregateFunctionBuilder = aggregateFunctionBuilder;
        this.#alias = alias;
    }
    /** @private */
    get expression() {
        return this.#aggregateFunctionBuilder;
    }
    /** @private */
    get alias() {
        return this.#alias;
    }
    toOperationNode() {
        return alias_node_js_1.AliasNode.create(this.#aggregateFunctionBuilder.toOperationNode(), identifier_node_js_1.IdentifierNode.create(this.#alias));
    }
}
exports.AliasedAggregateFunctionBuilder = AliasedAggregateFunctionBuilder;
