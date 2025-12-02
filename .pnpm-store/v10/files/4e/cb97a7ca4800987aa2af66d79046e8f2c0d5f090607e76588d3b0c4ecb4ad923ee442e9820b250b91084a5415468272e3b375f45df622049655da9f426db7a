import { AliasedExpression, Expression } from '../expression/expression.js';
import { MergeQueryNode } from '../operation-node/merge-query-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { QueryNode } from '../operation-node/query-node.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { ExpressionOrFactory } from '../parser/expression-parser.js';
import { InsertObjectOrList, InsertObjectOrListFactory } from '../parser/insert-values-parser.js';
import { JoinCallbackExpression, JoinReferenceExpression } from '../parser/join-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { ReturningAllRow, ReturningCallbackRow, ReturningRow } from '../parser/returning-parser.js';
import { SelectCallback, SelectExpression } from '../parser/select-parser.js';
import { TableExpression } from '../parser/table-parser.js';
import { ExtractUpdateTypeFromReferenceExpression, UpdateObject, UpdateObjectFactory } from '../parser/update-set-parser.js';
import { ValueExpression } from '../parser/value-parser.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { Compilable } from '../util/compilable.js';
import { QueryId } from '../util/query-id.js';
import { ShallowRecord, SimplifyResult, SimplifySingleResult, SqlBool } from '../util/type-utils.js';
import { MergeResult } from './merge-result.js';
import { NoResultErrorConstructor } from './no-result-error.js';
import { OutputCallback, OutputExpression, OutputInterface, OutputPrefix, SelectExpressionFromOutputCallback, SelectExpressionFromOutputExpression } from './output-interface.js';
import { MultiTableReturningInterface } from './returning-interface.js';
import { UpdateQueryBuilder } from './update-query-builder.js';
export declare class MergeQueryBuilder<DB, TT extends keyof DB, O> implements MultiTableReturningInterface<DB, TT, O>, OutputInterface<DB, TT, O> {
    #private;
    constructor(props: MergeQueryBuilderProps);
    /**
     * This can be used to add any additional SQL to the end of the query.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db
     *   .mergeInto('person')
     *   .using('pet', 'pet.owner_id', 'person.id')
     *   .whenMatched()
     *   .thenDelete()
     *   .modifyEnd(sql.raw('-- this is a comment'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person" using "pet" on "pet"."owner_id" = "person"."id" when matched then delete -- this is a comment
     * ```
     */
    modifyEnd(modifier: Expression<any>): MergeQueryBuilder<DB, TT, O>;
    /**
     * Changes a `merge into` query to an `merge top into` query.
     *
     * `top` clause is only supported by some dialects like MS SQL Server.
     *
     * ### Examples
     *
     * Affect 5 matched rows at most:
     *
     * ```ts
     * await db.mergeInto('person')
     *   .top(5)
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * merge top(5) into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     *
     * Affect 50% of matched rows:
     *
     * ```ts
     * await db.mergeInto('person')
     *   .top(50, 'percent')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * merge top(50) percent into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    top(expression: number | bigint, modifiers?: 'percent'): MergeQueryBuilder<DB, TT, O>;
    /**
     * Adds the `using` clause to the query.
     *
     * This method is similar to {@link SelectQueryBuilder.innerJoin}, so see the
     * documentation for that method for more examples.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    using<TE extends TableExpression<DB, TT>, K1 extends JoinReferenceExpression<DB, TT, TE>, K2 extends JoinReferenceExpression<DB, TT, TE>>(sourceTable: TE, k1: K1, k2: K2): ExtractWheneableMergeQueryBuilder<DB, TT, TE, O>;
    using<TE extends TableExpression<DB, TT>, FN extends JoinCallbackExpression<DB, TT, TE>>(sourceTable: TE, callback: FN): ExtractWheneableMergeQueryBuilder<DB, TT, TE, O>;
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
    returning<SE extends SelectExpression<DB, TT>>(selections: ReadonlyArray<SE>): MergeQueryBuilder<DB, TT, ReturningRow<DB, TT, O, SE>>;
    returning<CB extends SelectCallback<DB, TT>>(callback: CB): MergeQueryBuilder<DB, TT, ReturningCallbackRow<DB, TT, O, CB>>;
    returning<SE extends SelectExpression<DB, TT>>(selection: SE): MergeQueryBuilder<DB, TT, ReturningRow<DB, TT, O, SE>>;
    /**
     * Adds a `returning *` or `returning table.*` to an insert/update/delete/merge
     * query on databases that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll<T extends TT>(table: T): MergeQueryBuilder<DB, TT, ReturningAllRow<DB, T, O>>;
    returningAll(): MergeQueryBuilder<DB, TT, ReturningAllRow<DB, TT, O>>;
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
    output<OE extends OutputExpression<DB, TT>>(selections: readonly OE[]): MergeQueryBuilder<DB, TT, ReturningRow<DB, TT, O, SelectExpressionFromOutputExpression<OE>>>;
    output<CB extends OutputCallback<DB, TT>>(callback: CB): MergeQueryBuilder<DB, TT, ReturningRow<DB, TT, O, SelectExpressionFromOutputCallback<CB>>>;
    output<OE extends OutputExpression<DB, TT>>(selection: OE): MergeQueryBuilder<DB, TT, ReturningRow<DB, TT, O, SelectExpressionFromOutputExpression<OE>>>;
    /**
     * Adds an `output {prefix}.*` to an `insert`/`update`/`delete`/`merge` query on databases
     * that support `output` such as MS SQL Server (MSSQL).
     *
     * Also see the {@link output} method.
     */
    outputAll(table: OutputPrefix): MergeQueryBuilder<DB, TT, ReturningAllRow<DB, TT, O>>;
}
export interface MergeQueryBuilderProps {
    readonly queryId: QueryId;
    readonly queryNode: MergeQueryNode;
    readonly executor: QueryExecutor;
}
export declare class WheneableMergeQueryBuilder<DB, TT extends keyof DB, ST extends keyof DB, O> implements Compilable<O>, MultiTableReturningInterface<DB, TT | ST, O>, OutputInterface<DB, TT, O>, OperationNodeSource {
    #private;
    constructor(props: MergeQueryBuilderProps);
    /**
     * This can be used to add any additional SQL to the end of the query.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db
     *   .mergeInto('person')
     *   .using('pet', 'pet.owner_id', 'person.id')
     *   .whenMatched()
     *   .thenDelete()
     *   .modifyEnd(sql.raw('-- this is a comment'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person" using "pet" on "pet"."owner_id" = "person"."id" when matched then delete -- this is a comment
     * ```
     */
    modifyEnd(modifier: Expression<any>): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * See {@link MergeQueryBuilder.top}.
     */
    top(expression: number | bigint, modifiers?: 'percent'): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Adds a simple `when matched` clause to the query.
     *
     * For a `when matched` clause with an `and` condition, see {@link whenMatchedAnd}.
     *
     * For a simple `when not matched` clause, see {@link whenNotMatched}.
     *
     * For a `when not matched` clause with an `and` condition, see {@link whenNotMatchedAnd}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    whenMatched(): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT | ST, O>;
    /**
     * Adds the `when matched` clause to the query with an `and` condition.
     *
     * This method is similar to {@link SelectQueryBuilder.where}, so see the documentation
     * for that method for more examples.
     *
     * For a simple `when matched` clause (without an `and` condition) see {@link whenMatched}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatchedAnd('person.first_name', '=', 'John')
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched and "person"."first_name" = $1 then
     *   delete
     * ```
     */
    whenMatchedAnd<RE extends ReferenceExpression<DB, TT | ST>, VE extends OperandValueExpressionOrList<DB, TT | ST, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT | ST, O>;
    whenMatchedAnd<E extends ExpressionOrFactory<DB, TT | ST, SqlBool>>(expression: E): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT | ST, O>;
    /**
     * Adds the `when matched` clause to the query with an `and` condition. But unlike
     * {@link whenMatchedAnd}, this method accepts a column reference as the 3rd argument.
     *
     * This method is similar to {@link SelectQueryBuilder.whereRef}, so see the documentation
     * for that method for more examples.
     */
    whenMatchedAndRef<LRE extends ReferenceExpression<DB, TT | ST>, RRE extends ReferenceExpression<DB, TT | ST>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT | ST, O>;
    /**
     * Adds a simple `when not matched` clause to the query.
     *
     * For a `when not matched` clause with an `and` condition, see {@link whenNotMatchedAnd}.
     *
     * For a simple `when matched` clause, see {@link whenMatched}.
     *
     * For a `when matched` clause with an `and` condition, see {@link whenMatchedAnd}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatched()
     *   .thenInsertValues({
     *     first_name: 'John',
     *     last_name: 'Doe',
     *   })
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched then
     *   insert ("first_name", "last_name") values ($1, $2)
     * ```
     */
    whenNotMatched(): NotMatchedThenableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Adds the `when not matched` clause to the query with an `and` condition.
     *
     * This method is similar to {@link SelectQueryBuilder.where}, so see the documentation
     * for that method for more examples.
     *
     * For a simple `when not matched` clause (without an `and` condition) see {@link whenNotMatched}.
     *
     * Unlike {@link whenMatchedAnd}, you cannot reference columns from the table merged into.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatchedAnd('pet.name', '=', 'Lucky')
     *   .thenInsertValues({
     *     first_name: 'John',
     *     last_name: 'Doe',
     *   })
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched and "pet"."name" = $1 then
     *   insert ("first_name", "last_name") values ($2, $3)
     * ```
     */
    whenNotMatchedAnd<RE extends ReferenceExpression<DB, ST>, VE extends OperandValueExpressionOrList<DB, ST, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): NotMatchedThenableMergeQueryBuilder<DB, TT, ST, O>;
    whenNotMatchedAnd<E extends ExpressionOrFactory<DB, ST, SqlBool>>(expression: E): NotMatchedThenableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Adds the `when not matched` clause to the query with an `and` condition. But unlike
     * {@link whenNotMatchedAnd}, this method accepts a column reference as the 3rd argument.
     *
     * Unlike {@link whenMatchedAndRef}, you cannot reference columns from the target table.
     *
     * This method is similar to {@link SelectQueryBuilder.whereRef}, so see the documentation
     * for that method for more examples.
     */
    whenNotMatchedAndRef<LRE extends ReferenceExpression<DB, ST>, RRE extends ReferenceExpression<DB, ST>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): NotMatchedThenableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Adds a simple `when not matched by source` clause to the query.
     *
     * Supported in MS SQL Server.
     *
     * Similar to {@link whenNotMatched}, but returns a {@link MatchedThenableMergeQueryBuilder}.
     */
    whenNotMatchedBySource(): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT, O>;
    /**
     * Adds the `when not matched by source` clause to the query with an `and` condition.
     *
     * Supported in MS SQL Server.
     *
     * Similar to {@link whenNotMatchedAnd}, but returns a {@link MatchedThenableMergeQueryBuilder}.
     */
    whenNotMatchedBySourceAnd<RE extends ReferenceExpression<DB, TT>, VE extends OperandValueExpressionOrList<DB, TT, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT, O>;
    whenNotMatchedBySourceAnd<E extends ExpressionOrFactory<DB, TT, SqlBool>>(expression: E): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT, O>;
    /**
     * Adds the `when not matched by source` clause to the query with an `and` condition.
     *
     * Similar to {@link whenNotMatchedAndRef}, but you can reference columns from
     * the target table, and not from source table and returns a {@link MatchedThenableMergeQueryBuilder}.
     */
    whenNotMatchedBySourceAndRef<LRE extends ReferenceExpression<DB, TT>, RRE extends ReferenceExpression<DB, TT>>(lhs: LRE, op: ComparisonOperatorExpression, rhs: RRE): MatchedThenableMergeQueryBuilder<DB, TT, ST, TT, O>;
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
    returning<SE extends SelectExpression<DB, TT | ST>>(selections: ReadonlyArray<SE>): WheneableMergeQueryBuilder<DB, TT, ST, ReturningRow<DB, TT | ST, O, SE>>;
    returning<CB extends SelectCallback<DB, TT | ST>>(callback: CB): WheneableMergeQueryBuilder<DB, TT, ST, ReturningCallbackRow<DB, TT | ST, O, CB>>;
    returning<SE extends SelectExpression<DB, TT | ST>>(selection: SE): WheneableMergeQueryBuilder<DB, TT, ST, ReturningRow<DB, TT | ST, O, SE>>;
    /**
     * Adds a `returning *` or `returning table.*` to an insert/update/delete/merge
     * query on databases that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll<T extends TT | ST>(table: T): WheneableMergeQueryBuilder<DB, TT, ST, ReturningAllRow<DB, T, O>>;
    returningAll(): WheneableMergeQueryBuilder<DB, TT, ST, ReturningAllRow<DB, TT | ST, O>>;
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
    output<OE extends OutputExpression<DB, TT>>(selections: readonly OE[]): WheneableMergeQueryBuilder<DB, TT, ST, ReturningRow<DB, TT, O, SelectExpressionFromOutputExpression<OE>>>;
    output<CB extends OutputCallback<DB, TT>>(callback: CB): WheneableMergeQueryBuilder<DB, TT, ST, ReturningRow<DB, TT, O, SelectExpressionFromOutputCallback<CB>>>;
    output<OE extends OutputExpression<DB, TT>>(selection: OE): WheneableMergeQueryBuilder<DB, TT, ST, ReturningRow<DB, TT, O, SelectExpressionFromOutputExpression<OE>>>;
    /**
     * Adds an `output {prefix}.*` to an `insert`/`update`/`delete`/`merge` query on databases
     * that support `output` such as MS SQL Server (MSSQL).
     *
     * Also see the {@link output} method.
     */
    outputAll(table: OutputPrefix): WheneableMergeQueryBuilder<DB, TT, ST, ReturningAllRow<DB, TT, O>>;
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
     * await db.updateTable('person')
     *   .set({ first_name: 'John' })
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
     * import type { PersonUpdate } from 'type-editor' // imaginary module
     *
     * async function updatePerson(id: number, updates: PersonUpdate, returnLastName: boolean) {
     *   return await db
     *     .updateTable('person')
     *     .set(updates)
     *     .where('id', '=', id)
     *     .returning(['id', 'first_name'])
     *     .$if(returnLastName, (qb) => qb.returning('last_name'))
     *     .executeTakeFirstOrThrow()
     * }
     * ```
     *
     * Any selections added inside the `if` callback will be added as optional fields to the
     * output type since we can't know if the selections were actually made before running
     * the code. In the example above the return type of the `updatePerson` function is:
     *
     * ```ts
     * Promise<{
     *   id: number
     *   first_name: string
     *   last_name?: string
     * }>
     * ```
     */
    $if<O2>(condition: boolean, func: (qb: this) => WheneableMergeQueryBuilder<any, any, any, O2>): O2 extends MergeResult ? WheneableMergeQueryBuilder<DB, TT, ST, MergeResult> : O2 extends O & infer E ? WheneableMergeQueryBuilder<DB, TT, ST, O & Partial<E>> : WheneableMergeQueryBuilder<DB, TT, ST, Partial<O2>>;
    toOperationNode(): MergeQueryNode;
    compile(): CompiledQuery<O>;
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
}
export declare class MatchedThenableMergeQueryBuilder<DB, TT extends keyof DB, ST extends keyof DB, UT extends TT | ST, O> {
    #private;
    constructor(props: MergeQueryBuilderProps);
    /**
     * Performs the `delete` action.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * To perform the `update` action, see {@link thenUpdate} or {@link thenUpdateSet}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    thenDelete(): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Performs the `do nothing` action.
     *
     * This is supported in PostgreSQL.
     *
     * To perform the `delete` action, see {@link thenDelete}.
     *
     * To perform the `update` action, see {@link thenUpdate} or {@link thenUpdateSet}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDoNothing()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   do nothing
     * ```
     */
    thenDoNothing(): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Perform an `update` operation with a full-fledged {@link UpdateQueryBuilder}.
     * This is handy when multiple `set` invocations are needed.
     *
     * For a shorthand version of this method, see {@link thenUpdateSet}.
     *
     * To perform the `delete` action, see {@link thenDelete}.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenUpdate((ub) => ub
     *     .set(sql`metadata['has_pets']`, 'Y')
     *     .set({
     *       updated_at: new Date().toISOString(),
     *     })
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   update set metadata['has_pets'] = $1, "updated_at" = $2
     * ```
     */
    thenUpdate<QB extends UpdateQueryBuilder<DB, TT, UT, never>>(set: (ub: QB) => QB): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Performs an `update set` action, similar to {@link UpdateQueryBuilder.set}.
     *
     * For a full-fledged update query builder, see {@link thenUpdate}.
     *
     * To perform the `delete` action, see {@link thenDelete}.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenUpdateSet({
     *     middle_name: 'dog owner',
     *   })
     *   .execute()
     * ```
     *
     * The generate SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   update set "middle_name" = $1
     * ```
     */
    thenUpdateSet<UO extends UpdateObject<DB, UT, TT>>(update: UO): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    thenUpdateSet<U extends UpdateObjectFactory<DB, UT, TT>>(update: U): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    thenUpdateSet<RE extends ReferenceExpression<DB, TT>, VE extends ValueExpression<DB, UT, ExtractUpdateTypeFromReferenceExpression<DB, TT, RE>>>(key: RE, value: VE): WheneableMergeQueryBuilder<DB, TT, ST, O>;
}
export declare class NotMatchedThenableMergeQueryBuilder<DB, TT extends keyof DB, ST extends keyof DB, O> {
    #private;
    constructor(props: MergeQueryBuilderProps);
    /**
     * Performs the `do nothing` action.
     *
     * This is supported in PostgreSQL.
     *
     * To perform the `insert` action, see {@link thenInsertValues}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatched()
     *   .thenDoNothing()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched then
     *   do nothing
     * ```
     */
    thenDoNothing(): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    /**
     * Performs the `insert (...) values` action.
     *
     * This method is similar to {@link InsertQueryBuilder.values}, so see the documentation
     * for that method for more examples.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatched()
     *   .thenInsertValues({
     *     first_name: 'John',
     *     last_name: 'Doe',
     *   })
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched then
     *   insert ("first_name", "last_name") values ($1, $2)
     * ```
     */
    thenInsertValues<I extends InsertObjectOrList<DB, TT>>(insert: I): WheneableMergeQueryBuilder<DB, TT, ST, O>;
    thenInsertValues<IO extends InsertObjectOrListFactory<DB, TT, ST>>(insert: IO): WheneableMergeQueryBuilder<DB, TT, ST, O>;
}
export type ExtractWheneableMergeQueryBuilder<DB, TT extends keyof DB, TE extends TableExpression<DB, TT>, O> = TE extends `${infer T} as ${infer A}` ? T extends keyof DB ? UsingBuilder<DB, TT, A, DB[T], O> : never : TE extends keyof DB ? WheneableMergeQueryBuilder<DB, TT, TE, O> : TE extends AliasedExpression<infer QO, infer QA> ? UsingBuilder<DB, TT, QA, QO, O> : TE extends (qb: any) => AliasedExpression<infer QO, infer QA> ? UsingBuilder<DB, TT, QA, QO, O> : never;
type UsingBuilder<DB, TT extends keyof DB, A extends string, R, O> = A extends keyof DB ? WheneableMergeQueryBuilder<DB, TT, A, O> : WheneableMergeQueryBuilder<DB & ShallowRecord<A, R>, TT, A, O>;
export {};
