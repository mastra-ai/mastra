import { Expression } from '../expression/expression.js';
import { OnConflictNode } from '../operation-node/on-conflict-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { ExpressionOrFactory } from '../parser/expression-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { UpdateObjectExpression } from '../parser/update-set-parser.js';
import { Updateable } from '../util/column-type.js';
import { AnyColumn, SqlBool } from '../util/type-utils.js';
import { WhereInterface } from './where-interface.js';
export declare class OnConflictBuilder<DB, TB extends keyof DB> implements WhereInterface<DB, TB> {
    #private;
    constructor(props: OnConflictBuilderProps);
    /**
     * Specify a single column as the conflict target.
     *
     * Also see the {@link columns}, {@link constraint} and {@link expression}
     * methods for alternative ways to specify the conflict target.
     */
    column(column: AnyColumn<DB, TB>): OnConflictBuilder<DB, TB>;
    /**
     * Specify a list of columns as the conflict target.
     *
     * Also see the {@link column}, {@link constraint} and {@link expression}
     * methods for alternative ways to specify the conflict target.
     */
    columns(columns: ReadonlyArray<AnyColumn<DB, TB>>): OnConflictBuilder<DB, TB>;
    /**
     * Specify a specific constraint by name as the conflict target.
     *
     * Also see the {@link column}, {@link columns} and {@link expression}
     * methods for alternative ways to specify the conflict target.
     */
    constraint(constraintName: string): OnConflictBuilder<DB, TB>;
    /**
     * Specify an expression as the conflict target.
     *
     * This can be used if the unique index is an expression index.
     *
     * Also see the {@link column}, {@link columns} and {@link constraint}
     * methods for alternative ways to specify the conflict target.
     */
    expression(expression: Expression<any>): OnConflictBuilder<DB, TB>;
    /**
     * Adds a `where` expression to the query.
     *
     * Calling this method multiple times will combine the expressions using `and`.
     *
     * Also see {@link whereRef}
     *
     * ### Examples
     *
     * <!-- siteExample("where", "Simple where clause", 10) -->
     *
     * `where` method calls are combined with `AND`:
     *
     * ```ts
     * const person = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('first_name', '=', 'Jennifer')
     *   .where('age', '>', 40)
     *   .executeTakeFirst()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "first_name" = $1 and "age" > $2
     * ```
     *
     * Operator can be any supported operator or if the typings don't support it
     * you can always use:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * sql`your operator`
     * ```
     *
     * <!-- siteExample("where", "Where in", 20) -->
     *
     * Find multiple items using a list of identifiers:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('id', 'in', [1, 2, 3])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "id" in ($1, $2, $3)
     * ```
     *
     * <!-- siteExample("where", "Object filter", 30) -->
     *
     * You can use the `and` function to create a simple equality
     * filter using an object
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb.and({
     *     first_name: 'Jennifer',
     *     last_name: eb.ref('first_name')
     *   }))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   and "last_name" = "first_name"
     * )
     * ```
     *
     * <!-- siteExample("where", "OR where", 40) -->
     *
     * To combine conditions using `OR`, you can use the expression builder.
     * There are two ways to create `OR` expressions. Both are shown in this
     * example:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   // 1. Using the `or` method on the expression builder:
     *   .where((eb) => eb.or([
     *     eb('first_name', '=', 'Jennifer'),
     *     eb('first_name', '=', 'Sylvester')
     *   ]))
     *   // 2. Chaining expressions using the `or` method on the
     *   // created expressions:
     *   .where((eb) =>
     *     eb('last_name', '=', 'Aniston').or('last_name', '=', 'Stallone')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   ("first_name" = $1 or "first_name" = $2)
     *   and
     *   ("last_name" = $3 or "last_name" = $4)
     * )
     * ```
     *
     * <!-- siteExample("where", "Conditional where calls", 50) -->
     *
     * You can add expressions conditionally like this:
     *
     * ```ts
     * import { Expression, SqlBool } from 'kysely'
     *
     * const firstName: string | undefined = 'Jennifer'
     * const lastName: string | undefined = 'Aniston'
     * const under18 = true
     * const over60 = true
     *
     * let query = db
     *   .selectFrom('person')
     *   .selectAll()
     *
     * if (firstName) {
     *   // The query builder is immutable. Remember to reassign
     *   // the result back to the query variable.
     *   query = query.where('first_name', '=', firstName)
     * }
     *
     * if (lastName) {
     *   query = query.where('last_name', '=', lastName)
     * }
     *
     * if (under18 || over60) {
     *   // Conditional OR expressions can be added like this.
     *   query = query.where((eb) => {
     *     const ors: Expression<SqlBool>[] = []
     *
     *     if (under18) {
     *       ors.push(eb('age', '<', 18))
     *     }
     *
     *     if (over60) {
     *       ors.push(eb('age', '>', 60))
     *     }
     *
     *     return eb.or(ors)
     *   })
     * }
     *
     * const persons = await query.execute()
     * ```
     *
     * Both the first and third argument can also be arbitrary expressions like
     * subqueries. An expression can defined by passing a function and calling
     * the methods of the {@link ExpressionBuilder} passed to the callback:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(
     *     (qb) => qb.selectFrom('pet')
     *       .select('pet.name')
     *       .whereRef('pet.owner_id', '=', 'person.id')
     *       .limit(1),
     *     '=',
     *     'Fluffy'
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   select "pet"."name"
     *   from "pet"
     *   where "pet"."owner_id" = "person"."id"
     *   limit $1
     * ) = $2
     * ```
     *
     * A `where in` query can be built by using the `in` operator and an array
     * of values. The values in the array can also be expressions:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('person.id', 'in', [100, 200, 300])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "id" in ($1, $2, $3)
     * ```
     *
     * <!-- siteExample("where", "Complex where clause", 60) -->
     *
     * For complex `where` expressions you can pass in a single callback and
     * use the `ExpressionBuilder` to build your expression:
     *
     * ```ts
     * const firstName = 'Jennifer'
     * const maxAge = 60
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll('person')
     *   .where(({ eb, or, and, not, exists, selectFrom }) => and([
     *     or([
     *       eb('first_name', '=', firstName),
     *       eb('age', '<', maxAge)
     *     ]),
     *     not(exists(
     *       selectFrom('pet')
     *         .select('pet.id')
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *     ))
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
     *   (
     *     "first_name" = $1
     *     or "age" < $2
     *   )
     *   and not exists (
     *     select "pet"."id" from "pet" where "pet"."owner_id" = "person"."id"
     *   )
     * )
     * ```
     *
     * If everything else fails, you can always use the {@link sql} tag
     * as any of the arguments, including the operator:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(
     *     sql<string>`coalesce(first_name, last_name)`,
     *     'like',
     *     '%' + name + '%',
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * where coalesce(first_name, last_name) like $1
     * ```
     *
     * In all examples above the columns were known at compile time
     * (except for the raw {@link sql} expressions). By default kysely only
     * allows you to refer to columns that exist in the database **and**
     * can be referred to in the current query and context.
     *
     * Sometimes you may want to refer to columns that come from the user
     * input and thus are not available at compile time.
     *
     * You have two options, the {@link sql} tag or `db.dynamic`. The example below
     * uses both:
     *
     * ```ts
     * import { sql } from 'kysely'
     * const { ref } = db.dynamic
     *
     * const columnFromUserInput: string = 'id'
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(ref(columnFromUserInput), '=', 1)
     *   .where(sql.id(columnFromUserInput), '=', 2)
     *   .execute()
     * ```
     */
    where<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): OnConflictBuilder<DB, TB>;
    where<E extends ExpressionOrFactory<DB, TB, SqlBool>>(expression: E): OnConflictBuilder<DB, TB>;
    /**
     * Adds a `where` clause where both sides of the operator are references
     * to columns.
     *
     * The normal `where` method treats the right hand side argument as a
     * value by default. `whereRef` treats it as a column reference. This method is
     * expecially useful with joins and correlated subqueries.
     *
     * ### Examples
     *
     * Usage with a join:
     *
     * ```ts
     * db.selectFrom(['person', 'pet'])
     *   .selectAll()
     *   .whereRef('person.first_name', '=', 'pet.name')
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person", "pet" where "person"."first_name" = "pet"."name"
     * ```
     *
     * Usage in a subquery:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll('person')
     *   .select((eb) => eb
     *     .selectFrom('pet')
     *     .select('name')
     *     .whereRef('pet.owner_id', '=', 'person.id')
     *     .limit(1)
     *     .as('pet_name')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person".*, (
     *   select "name"
     *   from "pet"
     *   where "pet"."owner_id" = "person"."id"
     *   limit $1
     * ) as "pet_name"
     * from "person"
     */
    whereRef<LRE extends ReferenceExpression<DB, TB>, RRE extends ReferenceExpression<DB, TB>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): OnConflictBuilder<DB, TB>;
    /**
     * Clears all where expressions from the query.
     *
     * ### Examples
     *
     * ```ts
     * db.selectFrom('person')
     *   .selectAll()
     *   .where('id','=',42)
     *   .clearWhere()
     * ```
     *
     * The generated SQL(PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * ```
     */
    clearWhere(): OnConflictBuilder<DB, TB>;
    /**
     * Adds the "do nothing" conflict action.
     *
     * ### Examples
     *
     * ```ts
     * const id = 1
     * const first_name = 'John'
     *
     * await db
     *   .insertInto('person')
     *   .values({ first_name, id })
     *   .onConflict((oc) => oc
     *     .column('id')
     *     .doNothing()
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * insert into "person" ("first_name", "id")
     * values ($1, $2)
     * on conflict ("id") do nothing
     * ```
     */
    doNothing(): OnConflictDoNothingBuilder<DB, TB>;
    /**
     * Adds the "do update set" conflict action.
     *
     * ### Examples
     *
     * ```ts
     * const id = 1
     * const first_name = 'John'
     *
     * await db
     *   .insertInto('person')
     *   .values({ first_name, id })
     *   .onConflict((oc) => oc
     *     .column('id')
     *     .doUpdateSet({ first_name })
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * insert into "person" ("first_name", "id")
     * values ($1, $2)
     * on conflict ("id")
     * do update set "first_name" = $3
     * ```
     *
     * In the next example we use the `ref` method to reference
     * columns of the virtual table `excluded` in a type-safe way
     * to create an upsert operation:
     *
     * ```ts
     * import type { NewPerson } from 'type-editor' // imaginary module
     *
     * async function upsertPerson(person: NewPerson): Promise<void> {
     *   await db.insertInto('person')
     *     .values(person)
     *     .onConflict((oc) => oc
     *       .column('id')
     *       .doUpdateSet((eb) => ({
     *         first_name: eb.ref('excluded.first_name'),
     *         last_name: eb.ref('excluded.last_name')
     *       })
     *     )
     *   )
     *   .execute()
     * }
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * insert into "person" ("first_name", "last_name")
     * values ($1, $2)
     * on conflict ("id")
     * do update set
     *  "first_name" = excluded."first_name",
     *  "last_name" = excluded."last_name"
     * ```
     */
    doUpdateSet(update: UpdateObjectExpression<OnConflictDatabase<DB, TB>, OnConflictTables<TB>, OnConflictTables<TB>>): OnConflictUpdateBuilder<OnConflictDatabase<DB, TB>, OnConflictTables<TB>>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
}
export interface OnConflictBuilderProps {
    readonly onConflictNode: OnConflictNode;
}
export type OnConflictDatabase<DB, TB extends keyof DB> = {
    [K in keyof DB | 'excluded']: Updateable<K extends keyof DB ? DB[K] : DB[TB]>;
};
export type OnConflictTables<TB> = TB | 'excluded';
export declare class OnConflictDoNothingBuilder<DB, TB extends keyof DB> implements OperationNodeSource {
    #private;
    constructor(props: OnConflictBuilderProps);
    toOperationNode(): OnConflictNode;
}
export declare class OnConflictUpdateBuilder<DB, TB extends keyof DB> implements WhereInterface<DB, TB>, OperationNodeSource {
    #private;
    constructor(props: OnConflictBuilderProps);
    /**
     * Specify a where condition for the update operation.
     *
     * See {@link WhereInterface.where} for more info.
     */
    where<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): OnConflictUpdateBuilder<DB, TB>;
    /**
     * Adds a `where` expression to the query.
     *
     * Calling this method multiple times will combine the expressions using `and`.
     *
     * Also see {@link whereRef}
     *
     * ### Examples
     *
     * <!-- siteExample("where", "Simple where clause", 10) -->
     *
     * `where` method calls are combined with `AND`:
     *
     * ```ts
     * const person = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('first_name', '=', 'Jennifer')
     *   .where('age', '>', 40)
     *   .executeTakeFirst()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "first_name" = $1 and "age" > $2
     * ```
     *
     * Operator can be any supported operator or if the typings don't support it
     * you can always use:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * sql`your operator`
     * ```
     *
     * <!-- siteExample("where", "Where in", 20) -->
     *
     * Find multiple items using a list of identifiers:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('id', 'in', [1, 2, 3])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "id" in ($1, $2, $3)
     * ```
     *
     * <!-- siteExample("where", "Object filter", 30) -->
     *
     * You can use the `and` function to create a simple equality
     * filter using an object
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where((eb) => eb.and({
     *     first_name: 'Jennifer',
     *     last_name: eb.ref('first_name')
     *   }))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   and "last_name" = "first_name"
     * )
     * ```
     *
     * <!-- siteExample("where", "OR where", 40) -->
     *
     * To combine conditions using `OR`, you can use the expression builder.
     * There are two ways to create `OR` expressions. Both are shown in this
     * example:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   // 1. Using the `or` method on the expression builder:
     *   .where((eb) => eb.or([
     *     eb('first_name', '=', 'Jennifer'),
     *     eb('first_name', '=', 'Sylvester')
     *   ]))
     *   // 2. Chaining expressions using the `or` method on the
     *   // created expressions:
     *   .where((eb) =>
     *     eb('last_name', '=', 'Aniston').or('last_name', '=', 'Stallone')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   ("first_name" = $1 or "first_name" = $2)
     *   and
     *   ("last_name" = $3 or "last_name" = $4)
     * )
     * ```
     *
     * <!-- siteExample("where", "Conditional where calls", 50) -->
     *
     * You can add expressions conditionally like this:
     *
     * ```ts
     * import { Expression, SqlBool } from 'kysely'
     *
     * const firstName: string | undefined = 'Jennifer'
     * const lastName: string | undefined = 'Aniston'
     * const under18 = true
     * const over60 = true
     *
     * let query = db
     *   .selectFrom('person')
     *   .selectAll()
     *
     * if (firstName) {
     *   // The query builder is immutable. Remember to reassign
     *   // the result back to the query variable.
     *   query = query.where('first_name', '=', firstName)
     * }
     *
     * if (lastName) {
     *   query = query.where('last_name', '=', lastName)
     * }
     *
     * if (under18 || over60) {
     *   // Conditional OR expressions can be added like this.
     *   query = query.where((eb) => {
     *     const ors: Expression<SqlBool>[] = []
     *
     *     if (under18) {
     *       ors.push(eb('age', '<', 18))
     *     }
     *
     *     if (over60) {
     *       ors.push(eb('age', '>', 60))
     *     }
     *
     *     return eb.or(ors)
     *   })
     * }
     *
     * const persons = await query.execute()
     * ```
     *
     * Both the first and third argument can also be arbitrary expressions like
     * subqueries. An expression can defined by passing a function and calling
     * the methods of the {@link ExpressionBuilder} passed to the callback:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(
     *     (qb) => qb.selectFrom('pet')
     *       .select('pet.name')
     *       .whereRef('pet.owner_id', '=', 'person.id')
     *       .limit(1),
     *     '=',
     *     'Fluffy'
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   select "pet"."name"
     *   from "pet"
     *   where "pet"."owner_id" = "person"."id"
     *   limit $1
     * ) = $2
     * ```
     *
     * A `where in` query can be built by using the `in` operator and an array
     * of values. The values in the array can also be expressions:
     *
     * ```ts
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where('person.id', 'in', [100, 200, 300])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person" where "id" in ($1, $2, $3)
     * ```
     *
     * <!-- siteExample("where", "Complex where clause", 60) -->
     *
     * For complex `where` expressions you can pass in a single callback and
     * use the `ExpressionBuilder` to build your expression:
     *
     * ```ts
     * const firstName = 'Jennifer'
     * const maxAge = 60
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll('person')
     *   .where(({ eb, or, and, not, exists, selectFrom }) => and([
     *     or([
     *       eb('first_name', '=', firstName),
     *       eb('age', '<', maxAge)
     *     ]),
     *     not(exists(
     *       selectFrom('pet')
     *         .select('pet.id')
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *     ))
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
     *   (
     *     "first_name" = $1
     *     or "age" < $2
     *   )
     *   and not exists (
     *     select "pet"."id" from "pet" where "pet"."owner_id" = "person"."id"
     *   )
     * )
     * ```
     *
     * If everything else fails, you can always use the {@link sql} tag
     * as any of the arguments, including the operator:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(
     *     sql<string>`coalesce(first_name, last_name)`,
     *     'like',
     *     '%' + name + '%',
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * where coalesce(first_name, last_name) like $1
     * ```
     *
     * In all examples above the columns were known at compile time
     * (except for the raw {@link sql} expressions). By default kysely only
     * allows you to refer to columns that exist in the database **and**
     * can be referred to in the current query and context.
     *
     * Sometimes you may want to refer to columns that come from the user
     * input and thus are not available at compile time.
     *
     * You have two options, the {@link sql} tag or `db.dynamic`. The example below
     * uses both:
     *
     * ```ts
     * import { sql } from 'kysely'
     * const { ref } = db.dynamic
     *
     * const columnFromUserInput: string = 'id'
     *
     * const persons = await db
     *   .selectFrom('person')
     *   .selectAll()
     *   .where(ref(columnFromUserInput), '=', 1)
     *   .where(sql.id(columnFromUserInput), '=', 2)
     *   .execute()
     * ```
     */
    where<E extends ExpressionOrFactory<DB, TB, SqlBool>>(expression: E): OnConflictUpdateBuilder<DB, TB>;
    /**
     * Specify a where condition for the update operation.
     *
     * See {@link WhereInterface.whereRef} for more info.
     */
    whereRef<LRE extends ReferenceExpression<DB, TB>, RRE extends ReferenceExpression<DB, TB>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): OnConflictUpdateBuilder<DB, TB>;
    /**
     * Clears all where expressions from the query.
     *
     * ### Examples
     *
     * ```ts
     * db.selectFrom('person')
     *   .selectAll()
     *   .where('id','=',42)
     *   .clearWhere()
     * ```
     *
     * The generated SQL(PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * ```
     */
    clearWhere(): OnConflictUpdateBuilder<DB, TB>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): OnConflictNode;
}
