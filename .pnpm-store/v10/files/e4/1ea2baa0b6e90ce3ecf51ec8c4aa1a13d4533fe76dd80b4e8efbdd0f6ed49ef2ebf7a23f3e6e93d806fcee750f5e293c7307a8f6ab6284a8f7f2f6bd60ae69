import { Expression } from '../expression/expression.js';
import { OrderByExpression, DirectedOrderByStringReference, OrderByModifiers } from '../parser/order-by-parser.js';
export interface OrderByInterface<DB, TB extends keyof DB, O> {
    /**
     * Adds an `order by` clause to the query.
     *
     * `orderBy` calls are additive. Meaning, additional `orderBy` calls append to
     * the existing order by clause.
     *
     * `orderBy` is supported in select queries on all dialects. In MySQL, you can
     * also use `orderBy` in update and delete queries.
     *
     * In a single call you can add a single column/expression or multiple columns/expressions.
     *
     * Single column/expression calls can have 1-2 arguments. The first argument is
     * the expression to order by, while the second optional argument is the direction
     * (`asc` or `desc`), a callback that accepts and returns an {@link OrderByItemBuilder}
     * or an expression.
     *
     * See {@link clearOrderBy} to remove the `order by` clause from a query.
     *
     * ### Examples
     *
     * Single column/expression per call:
     *
     * ```ts
     * await db
     *   .selectFrom('person')
     *   .select('person.first_name as fn')
     *   .orderBy('id')
     *   .orderBy('fn', 'desc')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."first_name" as "fn"
     * from "person"
     * order by "id", "fn" desc
     * ```
     *
     * Building advanced modifiers:
     *
     * ```ts
     * await db
     *   .selectFrom('person')
     *   .select('person.first_name as fn')
     *   .orderBy('id', (ob) => ob.desc().nullsFirst())
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."first_name" as "fn"
     * from "person"
     * order by "id" desc nulls first
     * ```
     *
     * The order by expression can also be a raw sql expression or a subquery
     * in addition to column references:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .orderBy((eb) => eb.selectFrom('pet')
     *     .select('pet.name')
     *     .whereRef('pet.owner_id', '=', 'person.id')
     *     .limit(1)
     *   )
     *   .orderBy(
     *     sql<string>`concat(first_name, last_name) asc`
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * order by
     *   ( select "pet"."name"
     *     from "pet"
     *     where "pet"."owner_id" = "person"."id"
     *     limit $1
     *   ) asc,
     *   concat(first_name, last_name) asc
     * ```
     *
     * `dynamic.ref` can be used to refer to columns not known at
     * compile time:
     *
     * ```ts
     * async function someQuery(orderBy: string) {
     *   const { ref } = db.dynamic
     *
     *   return await db
     *     .selectFrom('person')
     *     .select('person.first_name as fn')
     *     .orderBy(ref(orderBy))
     *     .execute()
     * }
     *
     * someQuery('fn')
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."first_name" as "fn"
     * from "person"
     * order by "fn"
     * ```
     */
    orderBy<OE extends OrderByExpression<DB, TB, O>>(expr: OE, modifiers?: OrderByModifiers): OrderByInterface<DB, TB, O>;
    /**
     * @deprecated It does ~2-2.6x more compile-time instantiations compared to multiple chained `orderBy(expr, modifiers?)` calls (in `order by` clauses with reasonable item counts), and has broken autocompletion.
     */
    orderBy<OE extends OrderByExpression<DB, TB, O> | DirectedOrderByStringReference<DB, TB, O>>(exprs: ReadonlyArray<OE>): OrderByInterface<DB, TB, O>;
    /**
     * @deprecated It does ~2.9x more compile-time instantiations compared to a `orderBy(expr, direction)` call.
     */
    orderBy<OE extends DirectedOrderByStringReference<DB, TB, O>>(expr: OE): OrderByInterface<DB, TB, O>;
    /**
     * @deprecated Use `orderBy(expr, (ob) => ...)` instead.
     */
    orderBy<OE extends OrderByExpression<DB, TB, O>>(expr: OE, modifiers: Expression<any>): OrderByInterface<DB, TB, O>;
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
    clearOrderBy(): OrderByInterface<DB, TB, O>;
}
