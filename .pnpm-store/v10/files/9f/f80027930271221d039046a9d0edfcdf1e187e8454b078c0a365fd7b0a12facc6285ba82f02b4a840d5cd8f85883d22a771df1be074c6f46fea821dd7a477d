import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { JoinCallbackExpression, JoinReferenceExpression } from '../parser/join-parser.js';
import { From, FromTables, TableExpression } from '../parser/table-parser.js';
import { SelectExpression, SelectCallback } from '../parser/select-parser.js';
import { ReturningAllRow, ReturningCallbackRow, ReturningRow } from '../parser/returning-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { QueryNode } from '../operation-node/query-node.js';
import { DrainOuterGeneric, NarrowPartial, Nullable, ShallowRecord, SimplifyResult, SimplifySingleResult, SqlBool } from '../util/type-utils.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
import { KyselyPlugin } from '../plugin/kysely-plugin.js';
import { WhereInterface } from './where-interface.js';
import { MultiTableReturningInterface } from './returning-interface.js';
import { NoResultErrorConstructor } from './no-result-error.js';
import { DeleteResult } from './delete-result.js';
import { DeleteQueryNode } from '../operation-node/delete-query-node.js';
import { OrderByExpression, OrderByModifiers, DirectedOrderByStringReference } from '../parser/order-by-parser.js';
import { Explainable, ExplainFormat } from '../util/explainable.js';
import { AliasedExpression, Expression } from '../expression/expression.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { KyselyTypeError } from '../util/type-error.js';
import { Streamable } from '../util/streamable.js';
import { ExpressionOrFactory } from '../parser/expression-parser.js';
import { ValueExpression } from '../parser/value-parser.js';
import { OutputCallback, OutputExpression, OutputInterface, SelectExpressionFromOutputCallback, SelectExpressionFromOutputExpression } from './output-interface.js';
import { OrderByInterface } from './order-by-interface.js';
export declare class DeleteQueryBuilder<DB, TB extends keyof DB, O> implements WhereInterface<DB, TB>, MultiTableReturningInterface<DB, TB, O>, OutputInterface<DB, TB, O, 'deleted'>, OrderByInterface<DB, TB, {}>, OperationNodeSource, Compilable<O>, Explainable, Streamable<O> {
    #private;
    constructor(props: DeleteQueryBuilderProps);
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
    where<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): DeleteQueryBuilder<DB, TB, O>;
    where<E extends ExpressionOrFactory<DB, TB, SqlBool>>(expression: E): DeleteQueryBuilder<DB, TB, O>;
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
    whereRef<LRE extends ReferenceExpression<DB, TB>, RRE extends ReferenceExpression<DB, TB>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): DeleteQueryBuilder<DB, TB, O>;
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
    clearWhere(): DeleteQueryBuilder<DB, TB, O>;
    /**
     * Changes a `delete from` query into a `delete top from` query.
     *
     * `top` clause is only supported by some dialects like MS SQL Server.
     *
     * ### Examples
     *
     * Delete the first 5 rows:
     *
     * ```ts
     * await db
     *   .deleteFrom('person')
     *   .top(5)
     *   .where('age', '>', 18)
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * delete top(5) from "person" where "age" > @1
     * ```
     *
     * Delete the first 50% of rows:
     *
     * ```ts
     * await db
     *   .deleteFrom('person')
     *   .top(50, 'percent')
     *   .where('age', '>', 18)
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * delete top(50) percent from "person" where "age" > @1
     * ```
     */
    top(expression: number | bigint, modifiers?: 'percent'): DeleteQueryBuilder<DB, TB, O>;
    /**
     * Adds a `using` clause to the query.
     *
     * This clause allows adding additional tables to the query for filtering/returning
     * only. Usually a non-standard syntactic-sugar alternative to a `where` with a sub-query.
     *
     * ### Examples:
     *
     * ```ts
     * await db
     *   .deleteFrom('pet')
     *   .using('person')
     *   .whereRef('pet.owner_id', '=', 'person.id')
     *   .where('person.first_name', '=', 'Bob')
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * delete from "pet"
     * using "person"
     * where "pet"."owner_id" = "person"."id"
     *   and "person"."first_name" = $1
     * ```
     *
     * On supported databases such as MySQL, this clause allows using joins, but requires
     * at least one of the tables after the `from` keyword to be also named after
     * the `using` keyword. See also {@link innerJoin}, {@link leftJoin}, {@link rightJoin}
     * and {@link fullJoin}.
     *
     * ```ts
     * await db
     *   .deleteFrom('pet')
     *   .using('pet')
     *   .leftJoin('person', 'person.id', 'pet.owner_id')
     *   .where('person.first_name', '=', 'Bob')
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * delete from `pet`
     * using `pet`
     * left join `person` on `person`.`id` = `pet`.`owner_id`
     * where `person`.`first_name` = ?
     * ```
     *
     * You can also chain multiple invocations of this method, or pass an array to
     * a single invocation to name multiple tables.
     *
     * ```ts
     * await db
     *   .deleteFrom('toy')
     *   .using(['pet', 'person'])
     *   .whereRef('toy.pet_id', '=', 'pet.id')
     *   .whereRef('pet.owner_id', '=', 'person.id')
     *   .where('person.first_name', '=', 'Bob')
     *   .returning('pet.name')
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * delete from "toy"
     * using "pet", "person"
     * where "toy"."pet_id" = "pet"."id"
     *   and "pet"."owner_id" = "person"."id"
     *   and "person"."first_name" = $1
     * returning "pet"."name"
     * ```
     */
    using<TE extends TableExpression<DB, keyof DB>>(tables: TE[]): DeleteQueryBuilder<From<DB, TE>, FromTables<DB, TB, TE>, O>;
    using<TE extends TableExpression<DB, keyof DB>>(table: TE): DeleteQueryBuilder<From<DB, TE>, FromTables<DB, TB, TE>, O>;
    /**
     * Joins another table to the query using an inner join.
     *
     * ### Examples
     *
     * Simple usage by providing a table name and two columns to join:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   // `select` needs to come after the call to `innerJoin` so
     *   // that you can select from the joined table.
     *   .select(['person.id', 'pet.name'])
     *   .execute()
     *
     * result[0].id
     * result[0].name
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "person"."id", "pet"."name"
     * from "person"
     * inner join "pet"
     * on "pet"."owner_id" = "person"."id"
     * ```
     *
     * You can give an alias for the joined table like this:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin('pet as p', 'p.owner_id', 'person.id')
     *   .where('p.name', '=', 'Doggo')
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * inner join "pet" as "p"
     * on "p"."owner_id" = "person"."id"
     * where "p".name" = $1
     * ```
     *
     * You can provide a function as the second argument to get a join
     * builder for creating more complex joins. The join builder has a
     * bunch of `on*` methods for building the `on` clause of the join.
     * There's basically an equivalent for every `where` method
     * (`on`, `onRef`, `onExists` etc.). You can do all the same things
     * with the `on` method that you can with the corresponding `where`
     * method. See the `where` method documentation for more examples.
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin(
     *     'pet',
     *     (join) => join
     *       .onRef('pet.owner_id', '=', 'person.id')
     *       .on('pet.name', '=', 'Doggo')
     *   )
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * inner join "pet"
     * on "pet"."owner_id" = "person"."id"
     * and "pet"."name" = $1
     * ```
     *
     * You can join a subquery by providing a select query (or a callback)
     * as the first argument:
     *
     * ```ts
     * await db.selectFrom('person')
     *   .innerJoin(
     *     db.selectFrom('pet')
     *       .select(['owner_id', 'name'])
     *       .where('name', '=', 'Doggo')
     *       .as('doggos'),
     *     'doggos.owner_id',
     *     'person.id',
     *   )
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * inner join (
     *   select "owner_id", "name"
     *   from "pet"
     *   where "name" = $1
     * ) as "doggos"
     * on "doggos"."owner_id" = "person"."id"
     * ```
     */
    innerJoin<TE extends TableExpression<DB, TB>, K1 extends JoinReferenceExpression<DB, TB, TE>, K2 extends JoinReferenceExpression<DB, TB, TE>>(table: TE, k1: K1, k2: K2): DeleteQueryBuilderWithInnerJoin<DB, TB, O, TE>;
    innerJoin<TE extends TableExpression<DB, TB>, FN extends JoinCallbackExpression<DB, TB, TE>>(table: TE, callback: FN): DeleteQueryBuilderWithInnerJoin<DB, TB, O, TE>;
    /**
     * Just like {@link innerJoin} but adds a left join instead of an inner join.
     */
    leftJoin<TE extends TableExpression<DB, TB>, K1 extends JoinReferenceExpression<DB, TB, TE>, K2 extends JoinReferenceExpression<DB, TB, TE>>(table: TE, k1: K1, k2: K2): DeleteQueryBuilderWithLeftJoin<DB, TB, O, TE>;
    leftJoin<TE extends TableExpression<DB, TB>, FN extends JoinCallbackExpression<DB, TB, TE>>(table: TE, callback: FN): DeleteQueryBuilderWithLeftJoin<DB, TB, O, TE>;
    /**
     * Just like {@link innerJoin} but adds a right join instead of an inner join.
     */
    rightJoin<TE extends TableExpression<DB, TB>, K1 extends JoinReferenceExpression<DB, TB, TE>, K2 extends JoinReferenceExpression<DB, TB, TE>>(table: TE, k1: K1, k2: K2): DeleteQueryBuilderWithRightJoin<DB, TB, O, TE>;
    rightJoin<TE extends TableExpression<DB, TB>, FN extends JoinCallbackExpression<DB, TB, TE>>(table: TE, callback: FN): DeleteQueryBuilderWithRightJoin<DB, TB, O, TE>;
    /**
     * Just like {@link innerJoin} but adds a full join instead of an inner join.
     */
    fullJoin<TE extends TableExpression<DB, TB>, K1 extends JoinReferenceExpression<DB, TB, TE>, K2 extends JoinReferenceExpression<DB, TB, TE>>(table: TE, k1: K1, k2: K2): DeleteQueryBuilderWithFullJoin<DB, TB, O, TE>;
    fullJoin<TE extends TableExpression<DB, TB>, FN extends JoinCallbackExpression<DB, TB, TE>>(table: TE, callback: FN): DeleteQueryBuilderWithFullJoin<DB, TB, O, TE>;
    /**
     * Allows you to return data from modified rows.
     *
     * On supported databases like PostgreSQL, this method can be chained to
     * `insert`, `update`, `delete` and `merge` queries to return data.
     *
     * Note that on SQLite you need to give aliases for the expressions to avoid
     * [this bug](https://sqlite.org/forum/forumpost/033daf0b32) in SQLite.
     * For example `.returning('id as id')`.
     *
     * Also see the {@link returningAll} method.
     *
     * ### Examples
     *
     * Return one column:
     *
     * ```ts
     * const { id } = await db
     *   .insertInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .returning('id')
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * Return multiple columns:
     *
     * ```ts
     * const { id, last_name } = await db
     *   .insertInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .returning(['id', 'last_name'])
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * Return arbitrary expressions:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const { id, full_name, first_pet_id } = await db
     *   .insertInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .returning((eb) => [
     *     'id as id',
     *     sql<string>`concat(first_name, ' ', last_name)`.as('full_name'),
     *     eb.selectFrom('pet').select('pet.id').limit(1).as('first_pet_id')
     *   ])
     *   .executeTakeFirstOrThrow()
     * ```
     */
    returning<SE extends SelectExpression<DB, TB>>(selections: ReadonlyArray<SE>): DeleteQueryBuilder<DB, TB, ReturningRow<DB, TB, O, SE>>;
    returning<CB extends SelectCallback<DB, TB>>(callback: CB): DeleteQueryBuilder<DB, TB, ReturningCallbackRow<DB, TB, O, CB>>;
    returning<SE extends SelectExpression<DB, TB>>(selection: SE): DeleteQueryBuilder<DB, TB, ReturningRow<DB, TB, O, SE>>;
    /**
     * Adds `returning *` or `returning table.*` clause to the query.
     *
     * ### Examples
     *
     * Return all columns.
     *
     * ```ts
     * const pets = await db
     *   .deleteFrom('pet')
     *   .returningAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL)
     *
     * ```sql
     * delete from "pet" returning *
     * ```
     *
     * Return all columns from all tables
     *
     * ```ts
     * const result = await db
     *   .deleteFrom('toy')
     *   .using(['pet', 'person'])
     *   .whereRef('toy.pet_id', '=', 'pet.id')
     *   .whereRef('pet.owner_id', '=', 'person.id')
     *   .where('person.first_name', '=', 'Zoro')
     *   .returningAll()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL)
     *
     * ```sql
     * delete from "toy"
     * using "pet", "person"
     * where "toy"."pet_id" = "pet"."id"
     * and "pet"."owner_id" = "person"."id"
     * and "person"."first_name" = $1
     * returning *
     * ```
     *
     * Return all columns from a single table.
     *
     * ```ts
     * const result = await db
     *   .deleteFrom('toy')
     *   .using(['pet', 'person'])
     *   .whereRef('toy.pet_id', '=', 'pet.id')
     *   .whereRef('pet.owner_id', '=', 'person.id')
     *   .where('person.first_name', '=', 'Itachi')
     *   .returningAll('pet')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL)
     *
     * ```sql
     * delete from "toy"
     * using "pet", "person"
     * where "toy"."pet_id" = "pet"."id"
     * and "pet"."owner_id" = "person"."id"
     * and "person"."first_name" = $1
     * returning "pet".*
     * ```
     *
     * Return all columns from multiple tables.
     *
     * ```ts
     * const result = await db
     *   .deleteFrom('toy')
     *   .using(['pet', 'person'])
     *   .whereRef('toy.pet_id', '=', 'pet.id')
     *   .whereRef('pet.owner_id', '=', 'person.id')
     *   .where('person.first_name', '=', 'Luffy')
     *   .returningAll(['toy', 'pet'])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL)
     *
     * ```sql
     * delete from "toy"
     * using "pet", "person"
     * where "toy"."pet_id" = "pet"."id"
     * and "pet"."owner_id" = "person"."id"
     * and "person"."first_name" = $1
     * returning "toy".*, "pet".*
     * ```
     */
    returningAll<T extends TB>(tables: ReadonlyArray<T>): DeleteQueryBuilder<DB, TB, ReturningAllRow<DB, T, O>>;
    /**
     * Adds a `returning *` or `returning table.*` to an insert/update/delete/merge
     * query on databases that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll<T extends TB>(table: T): DeleteQueryBuilder<DB, TB, ReturningAllRow<DB, T, O>>;
    returningAll(): DeleteQueryBuilder<DB, TB, ReturningAllRow<DB, TB, O>>;
    /**
     * Allows you to return data from modified rows.
     *
     * On supported databases like MS SQL Server (MSSQL), this method can be chained
     * to `insert`, `update`, `delete` and `merge` queries to return data.
     *
     * Also see the {@link outputAll} method.
     *
     * ### Examples
     *
     * Return one column:
     *
     * ```ts
     * const { id } = await db
     *   .insertInto('person')
     *   .output('inserted.id')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston',
     *     gender: 'female',
     *   })
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MSSQL):
     *
     * ```sql
     * insert into "person" ("first_name", "last_name", "gender")
     * output "inserted"."id"
     * values (@1, @2, @3)
     * ```
     *
     * Return multiple columns:
     *
     * ```ts
     * const { old_first_name, old_last_name, new_first_name, new_last_name } = await db
     *   .updateTable('person')
     *   .set({ first_name: 'John', last_name: 'Doe' })
     *   .output([
     *     'deleted.first_name as old_first_name',
     *     'deleted.last_name as old_last_name',
     *     'inserted.first_name as new_first_name',
     *     'inserted.last_name as new_last_name',
     *   ])
     *   .where('created_at', '<', new Date())
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MSSQL):
     *
     * ```sql
     * update "person"
     * set "first_name" = @1, "last_name" = @2
     * output "deleted"."first_name" as "old_first_name",
     *   "deleted"."last_name" as "old_last_name",
     *   "inserted"."first_name" as "new_first_name",
     *   "inserted"."last_name" as "new_last_name"
     * where "created_at" < @3
     * ```
     *
     * Return arbitrary expressions:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const { full_name } = await db
     *   .deleteFrom('person')
     *   .output((eb) => sql<string>`concat(${eb.ref('deleted.first_name')}, ' ', ${eb.ref('deleted.last_name')})`.as('full_name'))
     *   .where('created_at', '<', new Date())
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (MSSQL):
     *
     * ```sql
     * delete from "person"
     * output concat("deleted"."first_name", ' ', "deleted"."last_name") as "full_name"
     * where "created_at" < @1
     * ```
     *
     * Return the action performed on the row:
     *
     * ```ts
     * await db
     *   .mergeInto('person')
     *   .using('pet', 'pet.owner_id', 'person.id')
     *   .whenMatched()
     *   .thenDelete()
     *   .whenNotMatched()
     *   .thenInsertValues({
     *     first_name: 'John',
     *     last_name: 'Doe',
     *     gender: 'male'
     *   })
     *   .output([
     *     'inserted.id as inserted_id',
     *     'deleted.id as deleted_id',
     *   ])
     *   .execute()
     * ```
     *
     * The generated SQL (MSSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "pet"."owner_id" = "person"."id"
     * when matched then delete
     * when not matched then
     * insert ("first_name", "last_name", "gender")
     * values (@1, @2, @3)
     * output "inserted"."id" as "inserted_id", "deleted"."id" as "deleted_id"
     * ```
     *
     */
    output<OE extends OutputExpression<DB, TB, 'deleted'>>(selections: readonly OE[]): DeleteQueryBuilder<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputExpression<OE>>>;
    output<CB extends OutputCallback<DB, TB, 'deleted'>>(callback: CB): DeleteQueryBuilder<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputCallback<CB>>>;
    output<OE extends OutputExpression<DB, TB, 'deleted'>>(selection: OE): DeleteQueryBuilder<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputExpression<OE>>>;
    /**
     * Adds an `output {prefix}.*` to an `insert`/`update`/`delete`/`merge` query on databases
     * that support `output` such as MS SQL Server (MSSQL).
     *
     * Also see the {@link output} method.
     */
    outputAll(table: 'deleted'): DeleteQueryBuilder<DB, TB, ReturningAllRow<DB, TB, O>>;
    /**
     * Clears all `returning` clauses from the query.
     *
     * ### Examples
     *
     * ```ts
     * await db.deleteFrom('pet')
     *   .returningAll()
     *   .where('name', '=', 'Max')
     *   .clearReturning()
     *   .execute()
     * ```
     *
     * The generated SQL(PostgreSQL):
     *
     * ```sql
     * delete from "pet" where "name" = "Max"
     * ```
     */
    clearReturning(): DeleteQueryBuilder<DB, TB, DeleteResult>;
    /**
     * Clears the `limit` clause from the query.
     *
     * ### Examples
     *
     * ```ts
     * await db.deleteFrom('pet')
     *   .returningAll()
     *   .where('name', '=', 'Max')
     *   .limit(5)
     *   .clearLimit()
     *   .execute()
     * ```
     *
     * The generated SQL(PostgreSQL):
     *
     * ```sql
     * delete from "pet" where "name" = "Max" returning *
     * ```
     */
    clearLimit(): DeleteQueryBuilder<DB, TB, O>;
    /**
     * @description This is only supported by some dialects like MySQL or SQLite with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`.
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}>>(expr: OE, modifiers?: OrderByModifiers): DeleteQueryBuilder<DB, TB, O>;
    /**
     * @description This is only supported by some dialects like MySQL or SQLite with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`.
     * @deprecated It does ~2-2.6x more compile-time instantiations compared to multiple chained `orderBy(expr, modifiers?)` calls (in `order by` clauses with reasonable item counts), and has broken autocompletion.
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}> | DirectedOrderByStringReference<DB, TB, {}>>(exprs: ReadonlyArray<OE>): DeleteQueryBuilder<DB, TB, O>;
    /**
     * @description This is only supported by some dialects like MySQL or SQLite with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`.
     * @deprecated It does ~2.9x more compile-time instantiations compared to a `orderBy(expr, direction)` call.
     */
    orderBy<OE extends DirectedOrderByStringReference<DB, TB, {}>>(expr: OE): DeleteQueryBuilder<DB, TB, O>;
    /**
     * @description This is only supported by some dialects like MySQL or SQLite with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`.
     * @deprecated Use `orderBy(expr, (ob) => ...)` instead.
     */
    orderBy<OE extends OrderByExpression<DB, TB, {}>>(expr: OE, modifiers: Expression<any>): DeleteQueryBuilder<DB, TB, O>;
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
    clearOrderBy(): DeleteQueryBuilder<DB, TB, O>;
    /**
     * Adds a limit clause to the query.
     *
     * A limit clause in a delete query is only supported by some dialects
     * like MySQL.
     *
     * ### Examples
     *
     * Delete 5 oldest items in a table:
     *
     * ```ts
     * await db
     *   .deleteFrom('pet')
     *   .orderBy('created_at')
     *   .limit(5)
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * delete from `pet` order by `created_at` limit ?
     * ```
     */
    limit(limit: ValueExpression<DB, TB, number>): DeleteQueryBuilder<DB, TB, O>;
    /**
     * This can be used to add any additional SQL to the end of the query.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.deleteFrom('person')
     *   .where('first_name', '=', 'John')
     *   .modifyEnd(sql`-- This is a comment`)
     *   .execute()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * delete from `person`
     * where `first_name` = "John" -- This is a comment
     * ```
     */
    modifyEnd(modifier: Expression<any>): DeleteQueryBuilder<DB, TB, O>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     *
     * If you want to conditionally call a method on `this`, see
     * the {@link $if} method.
     *
     * ### Examples
     *
     * The next example uses a helper function `log` to log a query:
     *
     * ```ts
     * import type { Compilable } from 'kysely'
     *
     * function log<T extends Compilable>(qb: T): T {
     *   console.log(qb.compile())
     *   return qb
     * }
     *
     * await db.deleteFrom('person')
     *   .$call(log)
     *   .execute()
     * ```
     */
    $call<T>(func: (qb: this) => T): T;
    /**
     * Call `func(this)` if `condition` is true.
     *
     * This method is especially handy with optional selects. Any `returning` or `returningAll`
     * method calls add columns as optional fields to the output type when called inside
     * the `func` callback. This is because we can't know if those selections were actually
     * made before running the code.
     *
     * You can also call any other methods inside the callback.
     *
     * ### Examples
     *
     * ```ts
     * async function deletePerson(id: number, returnLastName: boolean) {
     *   return await db
     *     .deleteFrom('person')
     *     .where('id', '=', id)
     *     .returning(['id', 'first_name'])
     *     .$if(returnLastName, (qb) => qb.returning('last_name'))
     *     .executeTakeFirstOrThrow()
     * }
     * ```
     *
     * Any selections added inside the `if` callback will be added as optional fields to the
     * output type since we can't know if the selections were actually made before running
     * the code. In the example above the return type of the `deletePerson` function is:
     *
     * ```ts
     * Promise<{
     *   id: number
     *   first_name: string
     *   last_name?: string
     * }>
     * ```
     */
    $if<O2>(condition: boolean, func: (qb: this) => DeleteQueryBuilder<any, any, O2>): O2 extends DeleteResult ? DeleteQueryBuilder<DB, TB, DeleteResult> : O2 extends O & infer E ? DeleteQueryBuilder<DB, TB, O & Partial<E>> : DeleteQueryBuilder<DB, TB, Partial<O2>>;
    /**
     * Change the output type of the query.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `DeleteQueryBuilder` with a new output type.
     */
    $castTo<C>(): DeleteQueryBuilder<DB, TB, C>;
    /**
     * Narrows (parts of) the output type of the query.
     *
     * Kysely tries to be as type-safe as possible, but in some cases we have to make
     * compromises for better maintainability and compilation performance. At present,
     * Kysely doesn't narrow the output type of the query when using {@link where} and {@link returning} or {@link returningAll}.
     *
     * This utility method is very useful for these situations, as it removes unncessary
     * runtime assertion/guard code. Its input type is limited to the output type
     * of the query, so you can't add a column that doesn't exist, or change a column's
     * type to something that doesn't exist in its union type.
     *
     * ### Examples
     *
     * Turn this code:
     *
     * ```ts
     * import type { Person } from 'type-editor' // imaginary module
     *
     * const person = await db.deleteFrom('person')
     *   .where('id', '=', 3)
     *   .where('nullable_column', 'is not', null)
     *   .returningAll()
     *   .executeTakeFirstOrThrow()
     *
     * if (isWithNoNullValue(person)) {
     *   functionThatExpectsPersonWithNonNullValue(person)
     * }
     *
     * function isWithNoNullValue(person: Person): person is Person & { nullable_column: string } {
     *   return person.nullable_column != null
     * }
     * ```
     *
     * Into this:
     *
     * ```ts
     * import type { NotNull } from 'kysely'
     *
     * const person = await db.deleteFrom('person')
     *   .where('id', '=', 3)
     *   .where('nullable_column', 'is not', null)
     *   .returningAll()
     *   .$narrowType<{ nullable_column: NotNull }>()
     *   .executeTakeFirstOrThrow()
     *
     * functionThatExpectsPersonWithNonNullValue(person)
     * ```
     */
    $narrowType<T>(): DeleteQueryBuilder<DB, TB, NarrowPartial<O, T>>;
    /**
     * Asserts that query's output row type equals the given type `T`.
     *
     * This method can be used to simplify excessively complex types to make TypeScript happy
     * and much faster.
     *
     * Kysely uses complex type magic to achieve its type safety. This complexity is sometimes too much
     * for TypeScript and you get errors like this:
     *
     * ```
     * error TS2589: Type instantiation is excessively deep and possibly infinite.
     * ```
     *
     * In these case you can often use this method to help TypeScript a little bit. When you use this
     * method to assert the output type of a query, Kysely can drop the complex output type that
     * consists of multiple nested helper types and replace it with the simple asserted type.
     *
     * Using this method doesn't reduce type safety at all. You have to pass in a type that is
     * structurally equal to the current type.
     *
     * ### Examples
     *
     * ```ts
     * import type { Species } from 'type-editor' // imaginary module
     *
     * async function deletePersonAndPets(personId: number) {
     *   return await db
     *     .with('deleted_person', (qb) => qb
     *        .deleteFrom('person')
     *        .where('id', '=', personId)
     *        .returning('first_name')
     *        .$assertType<{ first_name: string }>()
     *     )
     *     .with('deleted_pets', (qb) => qb
     *       .deleteFrom('pet')
     *       .where('owner_id', '=', personId)
     *       .returning(['name as pet_name', 'species'])
     *       .$assertType<{ pet_name: string, species: Species }>()
     *     )
     *     .selectFrom(['deleted_person', 'deleted_pets'])
     *     .selectAll()
     *     .execute()
     * }
     * ```
     */
    $assertType<T extends O>(): O extends T ? DeleteQueryBuilder<DB, TB, T> : KyselyTypeError<`$assertType() call failed: The type passed in is not equal to the output type of the query.`>;
    /**
     * Returns a copy of this DeleteQueryBuilder instance with the given plugin installed.
     */
    withPlugin(plugin: KyselyPlugin): DeleteQueryBuilder<DB, TB, O>;
    toOperationNode(): DeleteQueryNode;
    compile(): CompiledQuery<SimplifyResult<O>>;
    /**
     * Executes the query and returns an array of rows.
     *
     * Also see the {@link executeTakeFirst} and {@link executeTakeFirstOrThrow} methods.
     */
    execute(): Promise<SimplifyResult<O>[]>;
    /**
     * Executes the query and returns the first result or undefined if
     * the query returned no result.
     */
    executeTakeFirst(): Promise<SimplifySingleResult<O>>;
    /**
     * Executes the query and returns the first result or throws if
     * the query returned no result.
     *
     * By default an instance of {@link NoResultError} is thrown, but you can
     * provide a custom error class, or callback as the only argument to throw a different
     * error.
     */
    executeTakeFirstOrThrow(errorConstructor?: NoResultErrorConstructor | ((node: QueryNode) => Error)): Promise<SimplifyResult<O>>;
    /**
     * Executes the query and streams the rows.
     *
     * The optional argument `chunkSize` defines how many rows to fetch from the database
     * at a time. It only affects some dialects like PostgreSQL that support it.
     *
     * ### Examples
     *
     * ```ts
     * const stream = db
     *   .selectFrom('person')
     *   .select(['first_name', 'last_name'])
     *   .where('gender', '=', 'other')
     *   .stream()
     *
     * for await (const person of stream) {
     *   console.log(person.first_name)
     *
     *   if (person.last_name === 'Something') {
     *     // Breaking or returning before the stream has ended will release
     *     // the database connection and invalidate the stream.
     *     break
     *   }
     * }
     * ```
     */
    stream(chunkSize?: number): AsyncIterableIterator<O>;
    /**
     * Executes query with `explain` statement before the main query.
     *
     * ```ts
     * const explained = await db
     *  .selectFrom('person')
     *  .where('gender', '=', 'female')
     *  .selectAll()
     *  .explain('json')
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * explain format=json select * from `person` where `gender` = ?
     * ```
     *
     * You can also execute `explain analyze` statements.
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const explained = await db
     *  .selectFrom('person')
     *  .where('gender', '=', 'female')
     *  .selectAll()
     *  .explain('json', sql`analyze`)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * explain (analyze, format json) select * from "person" where "gender" = $1
     * ```
     */
    explain<ER extends Record<string, any> = Record<string, any>>(format?: ExplainFormat, options?: Expression<any>): Promise<ER[]>;
}
export interface DeleteQueryBuilderProps {
    readonly queryId: QueryId;
    readonly queryNode: DeleteQueryNode;
    readonly executor: QueryExecutor;
}
export type DeleteQueryBuilderWithInnerJoin<DB, TB extends keyof DB, O, TE extends TableExpression<DB, TB>> = TE extends `${infer T} as ${infer A}` ? T extends keyof DB ? InnerJoinedBuilder<DB, TB, O, A, DB[T]> : never : TE extends keyof DB ? DeleteQueryBuilder<DB, TB | TE, O> : TE extends AliasedExpression<infer QO, infer QA> ? InnerJoinedBuilder<DB, TB, O, QA, QO> : TE extends (qb: any) => AliasedExpression<infer QO, infer QA> ? InnerJoinedBuilder<DB, TB, O, QA, QO> : never;
type InnerJoinedBuilder<DB, TB extends keyof DB, O, A extends string, R> = A extends keyof DB ? DeleteQueryBuilder<InnerJoinedDB<DB, A, R>, TB | A, O> : DeleteQueryBuilder<DB & ShallowRecord<A, R>, TB | A, O>;
type InnerJoinedDB<DB, A extends string, R> = DrainOuterGeneric<{
    [C in keyof DB | A]: C extends A ? R : C extends keyof DB ? DB[C] : never;
}>;
export type DeleteQueryBuilderWithLeftJoin<DB, TB extends keyof DB, O, TE extends TableExpression<DB, TB>> = TE extends `${infer T} as ${infer A}` ? T extends keyof DB ? LeftJoinedBuilder<DB, TB, O, A, DB[T]> : never : TE extends keyof DB ? LeftJoinedBuilder<DB, TB, O, TE, DB[TE]> : TE extends AliasedExpression<infer QO, infer QA> ? LeftJoinedBuilder<DB, TB, O, QA, QO> : TE extends (qb: any) => AliasedExpression<infer QO, infer QA> ? LeftJoinedBuilder<DB, TB, O, QA, QO> : never;
type LeftJoinedBuilder<DB, TB extends keyof DB, O, A extends keyof any, R> = A extends keyof DB ? DeleteQueryBuilder<LeftJoinedDB<DB, A, R>, TB | A, O> : DeleteQueryBuilder<DB & ShallowRecord<A, Nullable<R>>, TB | A, O>;
type LeftJoinedDB<DB, A extends keyof any, R> = DrainOuterGeneric<{
    [C in keyof DB | A]: C extends A ? Nullable<R> : C extends keyof DB ? DB[C] : never;
}>;
export type DeleteQueryBuilderWithRightJoin<DB, TB extends keyof DB, O, TE extends TableExpression<DB, TB>> = TE extends `${infer T} as ${infer A}` ? T extends keyof DB ? RightJoinedBuilder<DB, TB, O, A, DB[T]> : never : TE extends keyof DB ? RightJoinedBuilder<DB, TB, O, TE, DB[TE]> : TE extends AliasedExpression<infer QO, infer QA> ? RightJoinedBuilder<DB, TB, O, QA, QO> : TE extends (qb: any) => AliasedExpression<infer QO, infer QA> ? RightJoinedBuilder<DB, TB, O, QA, QO> : never;
type RightJoinedBuilder<DB, TB extends keyof DB, O, A extends keyof any, R> = DeleteQueryBuilder<RightJoinedDB<DB, TB, A, R>, TB | A, O>;
type RightJoinedDB<DB, TB extends keyof DB, A extends keyof any, R> = DrainOuterGeneric<{
    [C in keyof DB | A]: C extends A ? R : C extends TB ? Nullable<DB[C]> : C extends keyof DB ? DB[C] : never;
}>;
export type DeleteQueryBuilderWithFullJoin<DB, TB extends keyof DB, O, TE extends TableExpression<DB, TB>> = TE extends `${infer T} as ${infer A}` ? T extends keyof DB ? OuterJoinedBuilder<DB, TB, O, A, DB[T]> : never : TE extends keyof DB ? OuterJoinedBuilder<DB, TB, O, TE, DB[TE]> : TE extends AliasedExpression<infer QO, infer QA> ? OuterJoinedBuilder<DB, TB, O, QA, QO> : TE extends (qb: any) => AliasedExpression<infer QO, infer QA> ? OuterJoinedBuilder<DB, TB, O, QA, QO> : never;
type OuterJoinedBuilder<DB, TB extends keyof DB, O, A extends keyof any, R> = DeleteQueryBuilder<OuterJoinedBuilderDB<DB, TB, A, R>, TB | A, O>;
type OuterJoinedBuilderDB<DB, TB extends keyof DB, A extends keyof any, R> = DrainOuterGeneric<{
    [C in keyof DB | A]: C extends A ? Nullable<R> : C extends TB ? Nullable<DB[C]> : C extends keyof DB ? DB[C] : never;
}>;
export {};
