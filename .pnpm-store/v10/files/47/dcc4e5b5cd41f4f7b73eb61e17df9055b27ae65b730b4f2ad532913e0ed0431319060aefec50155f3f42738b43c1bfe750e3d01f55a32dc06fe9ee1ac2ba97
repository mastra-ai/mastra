import { Expression } from '../expression/expression.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OverNode } from '../operation-node/over-node.js';
import { DirectedOrderByStringReference, OrderByExpression, OrderByModifiers } from '../parser/order-by-parser.js';
import { PartitionByExpression } from '../parser/partition-by-parser.js';
import { OrderByInterface } from './order-by-interface.js';
export declare class OverBuilder<DB, TB extends keyof DB> implements OrderByInterface<DB, TB, {}>, OperationNodeSource {
    #private;
    constructor(props: OverBuilderProps);
    /**
     * Adds an `order by` clause or item inside the `over` function.
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(
     *     (eb) => eb.fn.avg<number>('age').over(
     *       ob => ob.orderBy('first_name', 'asc').orderBy('last_name', 'asc')
     *     ).as('average_age')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select avg("age") over(order by "first_name" asc, "last_name" asc) as "average_age"
     * from "person"
     * ```
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}>>(expr: OE, modifiers?: OrderByModifiers): OverBuilder<DB, TB>;
    /**
     * @deprecated It does ~2-2.6x more compile-time instantiations compared to multiple chained `orderBy(expr, modifiers?)` calls (in `order by` clauses with reasonable item counts), and has broken autocompletion.
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}> | DirectedOrderByStringReference<DB, TB, {}>>(exprs: ReadonlyArray<OE>): OverBuilder<DB, TB>;
    /**
     * @deprecated It does ~2.9x more compile-time instantiations compared to a `orderBy(expr, direction)` call.
     */
    orderBy<OE extends DirectedOrderByStringReference<DB, TB, {}>>(expr: OE): OverBuilder<DB, TB>;
    /**
     * @deprecated Use `orderBy(expr, (ob) => ...)` instead.
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}>>(expr: OE, modifiers: Expression<any>): OverBuilder<DB, TB>;
    /**
     * Clears the `order by` clause from the query.
     *
     * See {@link orderBy} for adding an `order by` clause or item to a query.
     *
     * ### Examples
     *
     * ```ts
     * const query = db
     *   .selectFrom('person')
     *   .selectAll()
     *   .orderBy('id', 'desc')
     *
     * const results = await query
     *   .clearOrderBy()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * ```
     */
    clearOrderBy(): OverBuilder<DB, TB>;
    /**
     * Adds partition by clause item/s inside the over function.
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(
     *     (eb) => eb.fn.avg<number>('age').over(
     *       ob => ob.partitionBy(['last_name', 'first_name'])
     *     ).as('average_age')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select avg("age") over(partition by "last_name", "first_name") as "average_age"
     * from "person"
     * ```
     */
    partitionBy(partitionBy: ReadonlyArray<PartitionByExpression<DB, TB>>): OverBuilder<DB, TB>;
    partitionBy<PE extends PartitionByExpression<DB, TB>>(partitionBy: PE): OverBuilder<DB, TB>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): OverNode;
}
export interface OverBuilderProps {
    readonly overNode: OverNode;
}
