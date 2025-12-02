import { ExpressionWrapper } from '../expression/expression-wrapper.js';
import { Expression } from '../expression/expression.js';
import { ExtractTypeFromCoalesce1, ExtractTypeFromCoalesce3, ExtractTypeFromCoalesce2, ExtractTypeFromCoalesce4, ExtractTypeFromCoalesce5 } from '../parser/coalesce-parser.js';
import { ExtractTypeFromReferenceExpression, ReferenceExpression, StringReference, ExtractTypeFromStringReference } from '../parser/reference-parser.js';
import { KyselyTypeError } from '../util/type-error.js';
import { IsNever, ShallowDehydrateObject, ShallowDehydrateValue, Simplify } from '../util/type-utils.js';
import { AggregateFunctionBuilder } from './aggregate-function-builder.js';
import { SelectQueryBuilderExpression } from '../query-builder/select-query-builder-expression.js';
import { Selectable, SelectType } from '../util/column-type.js';
/**
 * Helpers for type safe SQL function calls.
 *
 * You can always use the {@link sql} tag to call functions and build arbitrary
 * expressions. This module simply has shortcuts for most common function calls.
 *
 * ### Examples
 *
 * <!-- siteExample("select", "Function calls", 60) -->
 *
 * This example shows how to create function calls. These examples also work in any
 * other place (`where` calls, updates, inserts etc.). The only difference is that you
 * leave out the alias (the `as` call) if you use these in any other place than `select`.
 *
 * ```ts
 * import { sql } from 'kysely'
 *
 * const result = await db.selectFrom('person')
 *   .innerJoin('pet', 'pet.owner_id', 'person.id')
 *   .select(({ fn, val, ref }) => [
 *     'person.id',
 *
 *     // The `fn` module contains the most common
 *     // functions.
 *     fn.count<number>('pet.id').as('pet_count'),
 *
 *     // You can call any function by calling `fn`
 *     // directly. The arguments are treated as column
 *     // references by default. If you want  to pass in
 *     // values, use the `val` function.
 *     fn<string>('concat', [
 *       val('Ms. '),
 *       'first_name',
 *       val(' '),
 *       'last_name'
 *     ]).as('full_name_with_title'),
 *
 *     // You can call any aggregate function using the
 *     // `fn.agg` function.
 *     fn.agg<string[]>('array_agg', ['pet.name']).as('pet_names'),
 *
 *     // And once again, you can use the `sql`
 *     // template tag. The template tag substitutions
 *     // are treated as values by default. If you want
 *     // to reference columns, you can use the `ref`
 *     // function.
 *     sql<string>`concat(
 *       ${ref('first_name')},
 *       ' ',
 *       ${ref('last_name')}
 *     )`.as('full_name')
 *   ])
 *   .groupBy('person.id')
 *   .having((eb) => eb.fn.count('pet.id'), '>', 10)
 *   .execute()
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * select
 *   "person"."id",
 *   count("pet"."id") as "pet_count",
 *   concat($1, "first_name", $2, "last_name") as "full_name_with_title",
 *   array_agg("pet"."name") as "pet_names",
 *   concat("first_name", ' ', "last_name") as "full_name"
 * from "person"
 * inner join "pet" on "pet"."owner_id" = "person"."id"
 * group by "person"."id"
 * having count("pet"."id") > $3
 * ```
 */
export interface FunctionModule<DB, TB extends keyof DB> {
    /**
     * Creates a function call.
     *
     * To create an aggregate function call, use {@link FunctionModule.agg}.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('person')
     *   .selectAll('person')
     *   .where(db.fn('upper', ['first_name']), '=', 'JENNIFER')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where upper("first_name") = $1
     * ```
     *
     * If you prefer readability over type-safety, you can always use raw `sql`:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.selectFrom('person')
     *   .selectAll('person')
     *   .where(sql<string>`upper(first_name)`, '=', 'JENNIFER')
     *   .execute()
     * ```
     */
    <O, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(name: string, args?: ReadonlyArray<RE>): ExpressionWrapper<DB, TB, O>;
    /**
     * Creates an aggregate function call.
     *
     * This is a specialized version of the `fn` method, that returns an {@link AggregateFunctionBuilder}
     * instance. A builder that allows you to chain additional methods such as `distinct`,
     * `filterWhere` and `over`.
     *
     * See {@link avg}, {@link count}, {@link countAll}, {@link max}, {@link min}, {@link sum}
     * shortcuts of common aggregate functions.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('person')
     *   .select(({ fn }) => [
     *     fn.agg<number>('rank').over().as('rank'),
     *     fn.agg<string>('group_concat', ['first_name']).distinct().as('first_names')
     *   ])
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select rank() over() as "rank",
     *   group_concat(distinct "first_name") as "first_names"
     * from "person"
     * ```
     */
    agg<O, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(name: string, args?: ReadonlyArray<RE>): AggregateFunctionBuilder<DB, TB, O>;
    /**
     * Calls the `avg` function for the column or expression given as the argument.
     *
     * This sql function calculates the average value for a given column.
     *
     * For additional functionality such as distinct, filtering and window functions,
     * refer to {@link AggregateFunctionBuilder}. An instance of this builder is
     * returned when calling this function.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.avg('price').as('avg_price'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select avg("price") as "avg_price" from "toy"
     * ```
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression will be `number | string` by default. This is because Kysely can't know the
     * type the db driver outputs. Sometimes the output can be larger than the largest
     * JavaScript number and a string is returned instead. Most drivers allow you
     * to configure the output type of large numbers and Kysely can't know if you've
     * done so.
     *
     * You can specify the output type of the expression by providing the type as
     * the first type argument:
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.avg<number>('price').as('avg_price'))
     *   .execute()
     * ```
     *
     * Sometimes a null is returned, e.g. when row count is 0, and no `group by`
     * was used. It is highly recommended to include null in the output type union
     * and handle null values in post-execute code, or wrap the function with a {@link coalesce}
     * function.
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.avg<number | null>('price').as('avg_price'))
     *   .execute()
     * ```
     */
    avg<O extends number | string | null = number | string, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE): AggregateFunctionBuilder<DB, TB, O>;
    /**
     * Calls the `coalesce` function for given arguments.
     *
     * This sql function returns the first non-null value from left to right, commonly
     * used to provide a default scalar for nullable columns or functions.
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression is inferred in the same manner that the sql function computes.
     * A union of arguments' types - if a non-nullable argument exists, it stops
     * there (ignoring any further arguments' types) and exludes null from the final
     * union type.
     *
     * `(string | null, number | null)` is inferred as `string | number | null`.
     *
     * `(string | null, number, Date | null)` is inferred as `string | number`.
     *
     * `(number, string | null)` is inferred as `number`.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.selectFrom('person')
     *   .select((eb) => eb.fn.coalesce('nullable_column', sql.lit('<unknown>')).as('column'))
     *   .where('first_name', '=', 'Jessie')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select coalesce("nullable_column", '<unknown>') as "column" from "person" where "first_name" = $1
     * ```
     *
     * You can combine this function with other helpers in this module:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .select((eb) => eb.fn.coalesce(eb.fn.avg<number | null>('age'), eb.lit(0)).as('avg_age'))
     *   .where('first_name', '=', 'Jennifer')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select coalesce(avg("age"), 0) as "avg_age" from "person" where "first_name" = $1
     * ```
     */
    coalesce<V1 extends ReferenceExpression<DB, TB>>(v1: V1): ExpressionWrapper<DB, TB, ExtractTypeFromCoalesce1<DB, TB, V1>>;
    coalesce<V1 extends ReferenceExpression<DB, TB>, V2 extends ReferenceExpression<DB, TB>>(v1: V1, v2: V2): ExpressionWrapper<DB, TB, ExtractTypeFromCoalesce2<DB, TB, V1, V2>>;
    coalesce<V1 extends ReferenceExpression<DB, TB>, V2 extends ReferenceExpression<DB, TB>, V3 extends ReferenceExpression<DB, TB>>(v1: V1, v2: V2, v3: V3): ExpressionWrapper<DB, TB, ExtractTypeFromCoalesce3<DB, TB, V1, V2, V3>>;
    coalesce<V1 extends ReferenceExpression<DB, TB>, V2 extends ReferenceExpression<DB, TB>, V3 extends ReferenceExpression<DB, TB>, V4 extends ReferenceExpression<DB, TB>>(v1: V1, v2: V2, v3: V3, v4: V4): ExpressionWrapper<DB, TB, ExtractTypeFromCoalesce4<DB, TB, V1, V2, V3, V4>>;
    coalesce<V1 extends ReferenceExpression<DB, TB>, V2 extends ReferenceExpression<DB, TB>, V3 extends ReferenceExpression<DB, TB>, V4 extends ReferenceExpression<DB, TB>, V5 extends ReferenceExpression<DB, TB>>(v1: V1, v2: V2, v3: V3, v4: V4, v5: V5): ExpressionWrapper<DB, TB, ExtractTypeFromCoalesce5<DB, TB, V1, V2, V3, V4, V5>>;
    /**
     * Calls the `count` function for the column or expression given as the argument.
     *
     * When called with a column as argument, this sql function counts the number of rows where there
     * is a non-null value in that column.
     *
     * For counting all rows nulls included (`count(*)`), see {@link countAll}.
     *
     * For additional functionality such as distinct, filtering and window functions,
     * refer to {@link AggregateFunctionBuilder}. An instance of this builder is
     * returned when calling this function.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.count('id').as('num_toys'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select count("id") as "num_toys" from "toy"
     * ```
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression will be `number | string | bigint` by default. This is because
     * Kysely can't know the type the db driver outputs. Sometimes the output can
     * be larger than the largest JavaScript number and a string is returned instead.
     * Most drivers allow you to configure the output type of large numbers and Kysely
     * can't know if you've done so.
     *
     * You can specify the output type of the expression by providing
     * the type as the first type argument:
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.count<number>('id').as('num_toys'))
     *   .execute()
     * ```
     */
    count<O extends number | string | bigint, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE): AggregateFunctionBuilder<DB, TB, O>;
    /**
     * Calls the `count` function with `*` or `table.*` as argument.
     *
     * When called with `*` as argument, this sql function counts the number of rows,
     * nulls included.
     *
     * For counting rows with non-null values in a given column (`count(column)`),
     * see {@link count}.
     *
     * For additional functionality such as filtering and window functions, refer
     * to {@link AggregateFunctionBuilder}. An instance of this builder is returned
     * when calling this function.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.countAll().as('num_toys'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select count(*) as "num_toys" from "toy"
     * ```
     *
     * If this is used in a `select` statement, the type of the selected expression
     * will be `number | string | bigint` by default. This is because Kysely
     * can't know the type the db driver outputs. Sometimes the output can be larger
     * than the largest JavaScript number and a string is returned instead. Most
     * drivers allow you to configure the output type of large numbers and Kysely
     * can't know if you've done so.
     *
     * You can specify the output type of the expression by providing
     * the type as the first type argument:
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.countAll<number>().as('num_toys'))
     *   .execute()
     * ```
     *
     * Some databases, such as PostgreSQL, support scoping the function to a specific
     * table:
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .innerJoin('pet', 'pet.id', 'toy.pet_id')
     *   .select((eb) => eb.fn.countAll('toy').as('num_toys'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select count("toy".*) as "num_toys"
     * from "toy" inner join "pet" on "pet"."id" = "toy"."pet_id"
     * ```
     */
    countAll<O extends number | string | bigint, T extends TB = TB>(table: T): AggregateFunctionBuilder<DB, TB, O>;
    countAll<O extends number | string | bigint>(): AggregateFunctionBuilder<DB, TB, O>;
    /**
     * Calls the `max` function for the column or expression given as the argument.
     *
     * This sql function calculates the maximum value for a given column.
     *
     * For additional functionality such as distinct, filtering and window functions,
     * refer to {@link AggregateFunctionBuilder}. An instance of this builder is
     * returned when calling this function.
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression will be the referenced column's type. This is because the result
     * is within the column's value range.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.max('price').as('max_price'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select max("price") as "max_price" from "toy"
     * ```
     *
     * Sometimes a null is returned, e.g. when row count is 0, and no `group by`
     * was used. It is highly recommended to include null in the output type union
     * and handle null values in post-execute code, or wrap the function with a {@link coalesce}
     * function.
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.max<number | null>('price').as('max_price'))
     *   .execute()
     * ```
     */
    max<O extends number | string | Date | bigint | null = never, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE): AggregateFunctionBuilder<DB, TB, IsNever<O> extends true ? ExtractTypeFromReferenceExpression<DB, TB, RE, number | string | Date | bigint> : O>;
    /**
     * Calls the `min` function for the column or expression given as the argument.
     *
     * This sql function calculates the minimum value for a given column.
     *
     * For additional functionality such as distinct, filtering and window functions,
     * refer to {@link AggregateFunctionBuilder}. An instance of this builder is
     * returned when calling this function.
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression will be the referenced column's type. This is because the result
     * is within the column's value range.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.min('price').as('min_price'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select min("price") as "min_price" from "toy"
     * ```
     *
     * Sometimes a null is returned, e.g. when row count is 0, and no `group by`
     * was used. It is highly recommended to include null in the output type union
     * and handle null values in post-execute code, or wrap the function with a {@link coalesce}
     * function.
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.min<number | null>('price').as('min_price'))
     *   .execute()
     * ```
     */
    min<O extends number | string | Date | bigint | null = never, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE): AggregateFunctionBuilder<DB, TB, IsNever<O> extends true ? ExtractTypeFromReferenceExpression<DB, TB, RE, number | string | Date | bigint> : O>;
    /**
     * Calls the `sum` function for the column or expression given as the argument.
     *
     * This sql function sums the values of a given column.
     *
     * For additional functionality such as distinct, filtering and window functions,
     * refer to {@link AggregateFunctionBuilder}. An instance of this builder is
     * returned when calling this function.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.sum('price').as('total_price'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select sum("price") as "total_price" from "toy"
     * ```
     *
     * If this function is used in a `select` statement, the type of the selected
     * expression will be `number | string` by default. This is because Kysely can't know the
     * type the db driver outputs. Sometimes the output can be larger than the largest
     * JavaScript number and a string is returned instead. Most drivers allow you
     * to configure the output type of large numbers and Kysely can't know if you've
     * done so.
     *
     * You can specify the output type of the expression by providing the type as
     * the first type argument:
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.sum<number>('price').as('total_price'))
     *   .execute()
     * ```
     *
     * Sometimes a null is returned, e.g. when row count is 0, and no `group by`
     * was used. It is highly recommended to include null in the output type union
     * and handle null values in post-execute code, or wrap the function with a {@link coalesce}
     * function.
     *
     * ```ts
     * await db.selectFrom('toy')
     *   .select((eb) => eb.fn.sum<number | null>('price').as('total_price'))
     *   .execute()
     * ```
     */
    sum<O extends number | string | bigint | null = number | string | bigint, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE): AggregateFunctionBuilder<DB, TB, O>;
    /**
     * Calls the `any` function for the column or expression given as the argument.
     *
     * The argument must be a subquery or evaluate to an array.
     *
     * ### Examples
     *
     * In the following example, `nicknames` is assumed to be a column of type `string[]`:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb(
     *     eb.val('Jen'), '=', eb.fn.any('person.nicknames')
     *   ))
     *   .execute()
     * ```
     *
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   "person".*
     * from
     *   "person"
     * where
     *  $1 = any("person"."nicknames")
     * ```
     */
    any<RE extends StringReference<DB, TB>>(expr: RE): Exclude<ExtractTypeFromReferenceExpression<DB, TB, RE>, null> extends ReadonlyArray<infer I> ? ExpressionWrapper<DB, TB, I> : KyselyTypeError<'any(expr) call failed: expr must be an array'>;
    any<T>(subquery: SelectQueryBuilderExpression<Record<string, T>>): ExpressionWrapper<DB, TB, T>;
    any<T>(expr: Expression<ReadonlyArray<T>>): ExpressionWrapper<DB, TB, T>;
    /**
     * Creates a `json_agg` function call.
     *
     * This is only supported by some dialects like PostgreSQL.
     *
     * ### Examples
     *
     * You can use it on table expressions:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .select((eb) => ['first_name', eb.fn.jsonAgg('pet').as('pets')])
     *   .groupBy('person.first_name')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name", json_agg("pet") as "pets"
     * from "person"
     * inner join "pet" on "pet"."owner_id" = "person"."id"
     * group by "person"."first_name"
     * ```
     *
     * or on columns:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .select((eb) => [
     *     'first_name',
     *     eb.fn.jsonAgg('pet.name').as('pet_names'),
     *   ])
     *   .groupBy('person.first_name')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name", json_agg("pet"."name") AS "pet_names"
     * from "person"
     * inner join "pet" ON "pet"."owner_id" = "person"."id"
     * group by "person"."first_name"
     * ```
     */
    jsonAgg<T extends (TB & string) | Expression<unknown>>(table: T): AggregateFunctionBuilder<DB, TB, T extends TB ? Simplify<ShallowDehydrateObject<Selectable<DB[T]>>>[] : T extends Expression<infer O> ? Simplify<ShallowDehydrateObject<O>>[] : never>;
    jsonAgg<RE extends StringReference<DB, TB>>(column: RE): AggregateFunctionBuilder<DB, TB, ShallowDehydrateValue<SelectType<ExtractTypeFromStringReference<DB, TB, RE>>>[] | null>;
    /**
     * Creates a to_json function call.
     *
     * This function is only available on PostgreSQL.
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .select((eb) => ['first_name', eb.fn.toJson('pet').as('pet')])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name", to_json("pet") as "pet"
     * from "person"
     * inner join "pet" on "pet"."owner_id" = "person"."id"
     * ```
     */
    toJson<T extends (TB & string) | Expression<unknown>>(table: T): ExpressionWrapper<DB, TB, T extends TB ? Simplify<ShallowDehydrateObject<Selectable<DB[T]>>> : T extends Expression<infer O> ? Simplify<ShallowDehydrateObject<O>> : never>;
}
export declare function createFunctionModule<DB, TB extends keyof DB>(): FunctionModule<DB, TB>;
