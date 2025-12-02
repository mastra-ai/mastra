import { SelectQueryBuilder } from '../query-builder/select-query-builder.js';
import { TableExpressionOrList } from '../parser/table-parser.js';
import { FunctionModule } from '../query-builder/function-module.js';
import { ExtractTypeFromReferenceExpression, ReferenceExpression, SimpleReferenceExpression, StringReference } from '../parser/reference-parser.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { BinaryOperatorExpression, FilterObject, OperandValueExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { Expression } from './expression.js';
import { ExpressionWrapper } from './expression-wrapper.js';
import { ComparisonOperator, JSONOperatorWith$, UnaryOperator } from '../operation-node/operator-node.js';
import { IsNever, SqlBool } from '../util/type-utils.js';
import { ExtractTypeFromValueExpression } from '../parser/value-parser.js';
import { CaseBuilder } from '../query-builder/case-builder.js';
import { JSONPathBuilder } from '../query-builder/json-path-builder.js';
import { OperandExpression } from '../parser/expression-parser.js';
import { RefTuple2, RefTuple3, RefTuple4, RefTuple5, ValTuple2, ValTuple3, ValTuple4, ValTuple5 } from '../parser/tuple-parser.js';
import { Selectable } from '../util/column-type.js';
import { KyselyTypeError } from '../util/type-error.js';
import { DataTypeExpression } from '../parser/data-type-parser.js';
import { SelectFrom } from '../parser/select-from-parser.js';
export interface ExpressionBuilder<DB, TB extends keyof DB> {
    /**
     * Creates a binary expression.
     *
     * This function returns an {@link Expression} and can be used pretty much anywhere.
     * See the examples for a couple of possible use cases.
     *
     * ### Examples
     *
     * A simple comparison:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb('first_name', '=', 'Jennifer'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where "first_name" = $1
     * ```
     *
     * By default the third argument is interpreted as a value. To pass in
     * a column reference, you can use {@link ref}:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb('first_name', '=', eb.ref('last_name')))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where "first_name" = "last_name"
     * ```
     *
     * In the following example `eb` is used to increment an integer column:
     *
     * ```ts
     * await db.updateTable('person')
     *   .set((eb) => ({
     *     age: eb('age', '+', 1)
     *   }))
     *   .where('id', '=', 3)
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * update "person"
     * set "age" = "age" + $1
     * where "id" = $2
     * ```
     *
     * As always, expressions can be nested. Both the first and the third argument
     * can be any expression:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb(
     *     eb.fn<string>('lower', ['first_name']),
     *     'in',
     *     eb.selectFrom('pet')
     *       .select('pet.name')
     *       .where('pet.species', '=', 'cat')
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where lower("first_name") in (
     *   select "pet"."name"
     *   from "pet"
     *   where "pet"."species" = $1
     * )
     * ```
     */
    <RE extends ReferenceExpression<DB, TB>, OP extends BinaryOperatorExpression, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: OP, rhs: VE): ExpressionWrapper<DB, TB, OP extends ComparisonOperator ? SqlBool : OP extends Expression<infer T> ? unknown extends T ? SqlBool : T : ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    /**
     * Returns a copy of `this` expression builder, for destructuring purposes.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .where(({ eb, exists, selectFrom }) =>
     *     eb('first_name', '=', 'Jennifer').and(exists(
     *       selectFrom('pet').whereRef('owner_id', '=', 'person.id').select('pet.id')
     *     ))
     *   )
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "first_name" = $1 and exists (
     *   select "pet.id" from "pet" where "owner_id" = "person.id"
     * )
     * ```
     */
    get eb(): ExpressionBuilder<DB, TB>;
    /**
     * Returns a {@link FunctionModule} that can be used to write type safe function
     * calls.
     *
     * The difference between this and {@link Kysely.fn} is that this one is more
     * type safe. You can only refer to columns visible to the part of the query
     * you are building. {@link Kysely.fn} allows you to refer to columns in any
     * table of the database even if it doesn't produce valid SQL.
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .select((eb) => [
     *     'person.id',
     *     eb.fn.count('pet.id').as('pet_count')
     *   ])
     *   .groupBy('person.id')
     *   .having((eb) => eb.fn.count('pet.id'), '>', 10)
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."id", count("pet"."id") as "pet_count"
     * from "person"
     * inner join "pet" on "pet"."owner_id" = "person"."id"
     * group by "person"."id"
     * having count("pet"."id") > $1
     * ```
     */
    get fn(): FunctionModule<DB, TB>;
    /**
     * Creates a subquery.
     *
     * The query builder returned by this method is typed in a way that you can refer to
     * all tables of the parent query in addition to the subquery's tables.
     *
     * This method accepts all the same inputs as {@link QueryCreator.selectFrom}.
     *
     * ### Examples
     *
     * This example shows that you can refer to both `pet.owner_id` and `person.id`
     * columns from the subquery. This is needed to be able to create correlated
     * subqueries:
     *
     * ```ts
     * const result = await db.selectFrom('pet')
     *   .select((eb) => [
     *     'pet.name',
     *     eb.selectFrom('person')
     *       .whereRef('person.id', '=', 'pet.owner_id')
     *       .select('person.first_name')
     *       .as('owner_name')
     *   ])
     *   .execute()
     *
     * console.log(result[0]?.owner_name)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   "pet"."name",
     *   ( select "person"."first_name"
     *     from "person"
     *     where "person"."id" = "pet"."owner_id"
     *   ) as "owner_name"
     * from "pet"
     * ```
     *
     * You can use a normal query in place of `(qb) => qb.selectFrom(...)` but in
     * that case Kysely typings wouldn't allow you to reference `pet.owner_id`
     * because `pet` is not joined to that query.
     */
    selectFrom<TE extends TableExpressionOrList<DB, TB>>(from: TE): SelectFrom<DB, TB, TE>;
    /**
     * Creates a `case` statement/operator.
     *
     * ### Examples
     *
     * Kitchen sink example with 2 flavors of `case` operator:
     *
     * ```ts
     * const { title, name } = await db
     *   .selectFrom('person')
     *   .where('id', '=', 123)
     *   .select((eb) => [
     *     eb.fn.coalesce('last_name', 'first_name').as('name'),
     *     eb
     *       .case()
     *       .when('gender', '=', 'male')
     *       .then('Mr.')
     *       .when('gender', '=', 'female')
     *       .then(
     *         eb
     *           .case('marital_status')
     *           .when('single')
     *           .then('Ms.')
     *           .else('Mrs.')
     *           .end()
     *       )
     *       .end()
     *       .as('title'),
     *   ])
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   coalesce("last_name", "first_name") as "name",
     *   case
     *     when "gender" = $1 then $2
     *     when "gender" = $3 then
     *       case "marital_status"
     *         when $4 then $5
     *         else $6
     *       end
     *   end as "title"
     * from "person"
     * where "id" = $7
     * ```
     */
    case(): CaseBuilder<DB, TB>;
    case<C extends SimpleReferenceExpression<DB, TB>>(column: C): CaseBuilder<DB, TB, ExtractTypeFromReferenceExpression<DB, TB, C>>;
    case<E extends Expression<any>>(expression: E): CaseBuilder<DB, TB, ExtractTypeFromValueExpression<E>>;
    /**
     * This method can be used to reference columns within the query's context. For
     * a non-type-safe version of this method see {@link sql}'s version.
     *
     * Additionally, this method can be used to reference nested JSON properties or
     * array elements. See {@link JSONPathBuilder} for more information. For regular
     * JSON path expressions you can use {@link jsonPath}.
     *
     * ### Examples
     *
     * By default the third argument of binary expressions is a value.
     * This function can be used to pass in a column reference instead:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.or([
     *     eb('first_name', '=', eb.ref('last_name')),
     *     eb('first_name', '=', eb.ref('middle_name'))
     *   ]))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where "first_name" = "last_name" or "first_name" = "middle_name"
     * ```
     *
     * In the next example we use the `ref` method to reference columns of the virtual
     * table `excluded` in a type-safe way to create an upsert operation:
     *
     * ```ts
     * await db.insertInto('person')
     *   .values({
     *     id: 3,
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston',
     *     gender: 'female',
     *   })
     *   .onConflict((oc) => oc
     *     .column('id')
     *     .doUpdateSet(({ ref }) => ({
     *       first_name: ref('excluded.first_name'),
     *       last_name: ref('excluded.last_name'),
     *       gender: ref('excluded.gender'),
     *     }))
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * insert into "person" ("id", "first_name", "last_name", "gender")
     * values ($1, $2, $3, $4)
     * on conflict ("id") do update set
     *   "first_name" = "excluded"."first_name",
     *   "last_name" = "excluded"."last_name",
     *   "gender" = "excluded"."gender"
     * ```
     *
     * In the next example we use `ref` in a raw sql expression. Unless you want
     * to be as type-safe as possible, this is probably overkill:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.updateTable('pet')
     *   .set((eb) => ({
     *     name: sql<string>`concat(${eb.ref('pet.name')}, ${' the animal'})`
     *   }))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * update "pet" set "name" = concat("pet"."name", $1)
     * ```
     *
     * In the next example we use `ref` to reference a nested JSON property:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .where(({ eb, ref }) => eb(
     *     ref('profile', '->').key('addresses').at(0).key('city'),
     *     '=',
     *     'San Diego'
     *   ))
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "profile"->'addresses'->0->'city' = $1
     * ```
     *
     * You can also compile to a JSON path expression by using the `->$`or `->>$` operator:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .select(({ ref }) =>
     *     ref('profile', '->$')
     *       .key('addresses')
     *       .at('last')
     *       .key('city')
     *       .as('current_city')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `profile`->'$.addresses[last].city' as `current_city` from `person`
     * ```
     */
    ref<RE extends StringReference<DB, TB>>(reference: RE): ExpressionWrapper<DB, TB, ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    ref<RE extends StringReference<DB, TB>>(reference: RE, op: JSONOperatorWith$): JSONPathBuilder<ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    /**
     * Creates a JSON path expression with provided column as root document (the $).
     *
     * For a JSON reference expression, see {@link ref}.
     *
     * ### Examples
     *
     * ```ts
     * await db.updateTable('person')
     *   .set('profile', (eb) => eb.fn('json_set', [
     *     'profile',
     *     eb.jsonPath<'profile'>().key('addresses').at('last').key('city'),
     *     eb.val('San Diego')
     *   ]))
     *   .where('id', '=', 3)
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * update `person`
     * set `profile` = json_set(`profile`, '$.addresses[last].city', $1)
     * where `id` = $2
     * ```
     */
    jsonPath<$ extends StringReference<DB, TB> = never>(): IsNever<$> extends true ? KyselyTypeError<"You must provide a column reference as this method's $ generic"> : JSONPathBuilder<ExtractTypeFromReferenceExpression<DB, TB, $>>;
    /**
     * Creates a table reference.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     * import type { Pet } from 'type-editor' // imaginary module
     *
     * const result = await db.selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .select(eb => [
     *     'person.id',
     *     sql<Pet[]>`jsonb_agg(${eb.table('pet')})`.as('pets')
     *   ])
     *   .groupBy('person.id')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."id", jsonb_agg("pet") as "pets"
     * from "person"
     * inner join "pet" on "pet"."owner_id" = "person"."id"
     * group by "person"."id"
     * ```
     *
     * If you need a column reference, use {@link ref}.
     */
    table<T extends TB & string>(table: T): ExpressionWrapper<DB, TB, Selectable<DB[T]>>;
    /**
     * Returns a value expression.
     *
     * This can be used to pass in a value where a reference is taken by default.
     *
     * This function returns an {@link Expression} and can be used pretty much anywhere.
     *
     * ### Examples
     *
     * Binary expressions take a reference by default as the first argument. `val` could
     * be used to pass in a value instead:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb(
     *     eb.val('cat'),
     *     '=',
     *     eb.fn.any(
     *       eb.selectFrom('pet')
     *         .select('species')
     *         .whereRef('owner_id', '=', 'person.id')
     *     )
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where $1 = any(
     *   select "species"
     *   from "pet"
     *   where "owner_id" = "person"."id"
     * )
     * ```
     */
    val<VE>(value: VE): ExpressionWrapper<DB, TB, ExtractTypeFromValueExpression<VE>>;
    /**
     * Creates a tuple expression.
     *
     * This creates a tuple using column references by default. See {@link tuple}
     * if you need to create value tuples.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where(({ eb, refTuple, tuple }) => eb(
     *     refTuple('first_name', 'last_name'),
     *     'in',
     *     [
     *       tuple('Jennifer', 'Aniston'),
     *       tuple('Sylvester', 'Stallone')
     *     ]
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   "person".*
     * from
     *   "person"
     * where
     *   ("first_name", "last_name")
     *   in
     *   (
     *     ($1, $2),
     *     ($3, $4)
     *   )
     * ```
     *
     * In the next example a reference tuple is compared to a subquery. Note that
     * in this case you need to use the {@link @SelectQueryBuilder.$asTuple | $asTuple}
     * function:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where(({ eb, refTuple, selectFrom }) => eb(
     *     refTuple('first_name', 'last_name'),
     *     'in',
     *     selectFrom('pet')
     *       .select(['name', 'species'])
     *       .where('species', '!=', 'cat')
     *       .$asTuple('name', 'species')
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   "person".*
     * from
     *   "person"
     * where
     *   ("first_name", "last_name")
     *   in
     *   (
     *     select "name", "species"
     *     from "pet"
     *     where "species" != $1
     *   )
     * ```
     */
    refTuple<R1 extends ReferenceExpression<DB, TB>, R2 extends ReferenceExpression<DB, TB>>(value1: R1, value2: R2): ExpressionWrapper<DB, TB, RefTuple2<DB, TB, R1, R2>>;
    refTuple<R1 extends ReferenceExpression<DB, TB>, R2 extends ReferenceExpression<DB, TB>, R3 extends ReferenceExpression<DB, TB>>(value1: R1, value2: R2, value3: R3): ExpressionWrapper<DB, TB, RefTuple3<DB, TB, R1, R2, R3>>;
    refTuple<R1 extends ReferenceExpression<DB, TB>, R2 extends ReferenceExpression<DB, TB>, R3 extends ReferenceExpression<DB, TB>, R4 extends ReferenceExpression<DB, TB>>(value1: R1, value2: R2, value3: R3, value4: R4): ExpressionWrapper<DB, TB, RefTuple4<DB, TB, R1, R2, R3, R4>>;
    refTuple<R1 extends ReferenceExpression<DB, TB>, R2 extends ReferenceExpression<DB, TB>, R3 extends ReferenceExpression<DB, TB>, R4 extends ReferenceExpression<DB, TB>, R5 extends ReferenceExpression<DB, TB>>(value1: R1, value2: R2, value3: R3, value4: R4, value5: R5): ExpressionWrapper<DB, TB, RefTuple5<DB, TB, R1, R2, R3, R4, R5>>;
    /**
     * Creates a value tuple expression.
     *
     * This creates a tuple using values by default. See {@link refTuple} if you need to create
     * tuples using column references.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where(({ eb, refTuple, tuple }) => eb(
     *     refTuple('first_name', 'last_name'),
     *     'in',
     *     [
     *       tuple('Jennifer', 'Aniston'),
     *       tuple('Sylvester', 'Stallone')
     *     ]
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   "person".*
     * from
     *   "person"
     * where
     *   ("first_name", "last_name")
     *   in
     *   (
     *     ($1, $2),
     *     ($3, $4)
     *   )
     * ```
     */
    tuple<V1, V2>(value1: V1, value2: V2): ExpressionWrapper<DB, TB, ValTuple2<V1, V2>>;
    tuple<V1, V2, V3>(value1: V1, value2: V2, value3: V3): ExpressionWrapper<DB, TB, ValTuple3<V1, V2, V3>>;
    tuple<V1, V2, V3, V4>(value1: V1, value2: V2, value3: V3, value4: V4): ExpressionWrapper<DB, TB, ValTuple4<V1, V2, V3, V4>>;
    tuple<V1, V2, V3, V4, V5>(value1: V1, value2: V2, value3: V3, value4: V4, value5: V5): ExpressionWrapper<DB, TB, ValTuple5<V1, V2, V3, V4, V5>>;
    /**
     * Returns a literal value expression.
     *
     * Just like `val` but creates a literal value that gets merged in the SQL.
     * To prevent SQL injections, only `boolean`, `number` and `null` values
     * are accepted. If you need `string` or other literals, use `sql.lit` instead.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .select((eb) => eb.lit(1).as('one'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select 1 as "one" from "person"
     * ```
     */
    lit<VE extends number | boolean | null>(literal: VE): ExpressionWrapper<DB, TB, VE>;
    /**
     * Creates an unary expression.
     *
     * This function returns an {@link Expression} and can be used pretty much anywhere.
     * See the examples for a couple of possible use cases.
     *
     * @see {@link not}, {@link exists} and {@link neg}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .select((eb) => [
     *     'first_name',
     *     eb.unary('-', 'age').as('negative_age')
     *   ])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name", -"age"
     * from "person"
     * ```
     */
    unary<RE extends ReferenceExpression<DB, TB>>(op: UnaryOperator, expr: RE): ExpressionWrapper<DB, TB, ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    /**
     * Creates a `not` operation.
     *
     * A shortcut for `unary('not', expr)`.
     *
     * @see {@link unary}
     */
    not<RE extends ReferenceExpression<DB, TB>>(expr: RE): ExpressionWrapper<DB, TB, ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    /**
     * Creates an `exists` operation.
     *
     * A shortcut for `unary('exists', expr)`.
     *
     * @see {@link unary}
     */
    exists<RE extends ReferenceExpression<DB, TB>>(expr: RE): ExpressionWrapper<DB, TB, SqlBool>;
    /**
     * Creates a negation operation.
     *
     * A shortcut for `unary('-', expr)`.
     *
     * @see {@link unary}
     */
    neg<RE extends ReferenceExpression<DB, TB>>(expr: RE): ExpressionWrapper<DB, TB, ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    /**
     * Creates a `between` expression.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb.between('age', 40, 60))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "age" between $1 and $2
     * ```
     */
    between<RE extends ReferenceExpression<DB, TB>, SE extends OperandValueExpression<DB, TB, RE>, EE extends OperandValueExpression<DB, TB, RE>>(expr: RE, start: SE, end: EE): ExpressionWrapper<DB, TB, SqlBool>;
    /**
     * Creates a `between symmetric` expression.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb.betweenSymmetric('age', 40, 60))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "age" between symmetric $1 and $2
     * ```
     */
    betweenSymmetric<RE extends ReferenceExpression<DB, TB>, SE extends OperandValueExpression<DB, TB, RE>, EE extends OperandValueExpression<DB, TB, RE>>(expr: RE, start: SE, end: EE): ExpressionWrapper<DB, TB, SqlBool>;
    /**
     * Combines two or more expressions using the logical `and` operator.
     *
     * An empty array produces a `true` expression.
     *
     * This function returns an {@link Expression} and can be used pretty much anywhere.
     * See the examples for a couple of possible use cases.
     *
     * ### Examples
     *
     * In this example we use `and` to create a `WHERE expr1 AND expr2 AND expr3`
     * statement:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.and([
     *     eb('first_name', '=', 'Jennifer'),
     *     eb('first_name', '=', 'Arnold'),
     *     eb('first_name', '=', 'Sylvester')
     *   ]))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where (
     *   "first_name" = $1
     *   and "first_name" = $2
     *   and "first_name" = $3
     * )
     * ```
     *
     * Optionally you can use the simpler object notation if you only need
     * equality comparisons:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.and({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   }))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where (
     *   "first_name" = $1
     *   and "last_name" = $2
     * )
     * ```
     */
    and<E extends OperandExpression<SqlBool>>(exprs: ReadonlyArray<E>): ExpressionWrapper<DB, TB, SqlBool>;
    and<E extends Readonly<FilterObject<DB, TB>>>(exprs: E): ExpressionWrapper<DB, TB, SqlBool>;
    /**
     * Combines two or more expressions using the logical `or` operator.
     *
     * An empty array produces a `false` expression.
     *
     * This function returns an {@link Expression} and can be used pretty much anywhere.
     * See the examples for a couple of possible use cases.
     *
     * ### Examples
     *
     * In this example we use `or` to create a `WHERE expr1 OR expr2 OR expr3`
     * statement:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.or([
     *     eb('first_name', '=', 'Jennifer'),
     *     eb('first_name', '=', 'Arnold'),
     *     eb('first_name', '=', 'Sylvester')
     *   ]))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where (
     *   "first_name" = $1
     *   or "first_name" = $2
     *   or "first_name" = $3
     * )
     * ```
     *
     * Optionally you can use the simpler object notation if you only need
     * equality comparisons:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.or({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   }))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where (
     *   "first_name" = $1
     *   or "last_name" = $2
     * )
     * ```
     */
    or<E extends OperandExpression<SqlBool>>(exprs: ReadonlyArray<E>): ExpressionWrapper<DB, TB, SqlBool>;
    or<E extends Readonly<FilterObject<DB, TB>>>(exprs: E): ExpressionWrapper<DB, TB, SqlBool>;
    /**
     * Wraps the expression in parentheses.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb(eb.parens('age', '+', 1), '/', 100), '<', 0.1)
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where ("age" + $1) / $2 < $3
     * ```
     *
     * You can also pass in any expression as the only argument:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll('person')
     *   .where((eb) => eb.parens(
     *     eb('age', '=', 1).or('age', '=', 2)
     *   ).and(
     *     eb('first_name', '=', 'Jennifer').or('first_name', '=', 'Arnold')
     *   ))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*
     * from "person"
     * where ("age" = $1 or "age" = $2) and ("first_name" = $3 or "first_name" = $4)
     * ```
     */
    parens<RE extends ReferenceExpression<DB, TB>, OP extends BinaryOperatorExpression, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: OP, rhs: VE): ExpressionWrapper<DB, TB, OP extends ComparisonOperator ? SqlBool : ExtractTypeFromReferenceExpression<DB, TB, RE>>;
    parens<T>(expr: Expression<T>): ExpressionWrapper<DB, TB, T>;
    /**
     * Creates a `cast(expr as dataType)` expression.
     *
     * Since Kysely can't know the mapping between JavaScript and database types,
     * you need to provide both explicitly.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .select((eb) => [
     *     'id',
     *     'first_name',
     *     eb.cast<number>('age', 'integer').as('age')
     *   ])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select cast("age" as integer) as "age"
     * from "person"
     * ```
     */
    cast<T, RE extends ReferenceExpression<DB, TB> = ReferenceExpression<DB, TB>>(expr: RE, dataType: DataTypeExpression): ExpressionWrapper<DB, TB, T>;
    /**
     * See {@link QueryCreator.withSchema}
     *
     * @deprecated Will be removed in kysely 0.25.0.
     */
    withSchema(schema: string): ExpressionBuilder<DB, TB>;
}
export declare function createExpressionBuilder<DB, TB extends keyof DB>(executor?: QueryExecutor): ExpressionBuilder<DB, TB>;
export declare function expressionBuilder<DB, TB extends keyof DB>(_: SelectQueryBuilder<DB, TB, any>): ExpressionBuilder<DB, TB>;
export declare function expressionBuilder<DB, TB extends keyof DB = never>(): ExpressionBuilder<DB, TB>;
