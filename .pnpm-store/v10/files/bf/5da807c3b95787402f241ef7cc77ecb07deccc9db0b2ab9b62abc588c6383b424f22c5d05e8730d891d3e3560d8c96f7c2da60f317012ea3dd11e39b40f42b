import { ExpressionBuilder } from '../expression/expression-builder.js';
import { AliasedExpressionOrFactory } from '../parser/expression-parser.js';
import { ReturningAllRow, ReturningRow } from '../parser/returning-parser.js';
import { AnyAliasedColumnWithTable, AnyColumnWithTable } from '../util/type-utils.js';
export interface OutputInterface<DB, TB extends keyof DB, O, OP extends OutputPrefix = OutputPrefix> {
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
    output<OE extends OutputExpression<DB, TB, OP>>(selections: ReadonlyArray<OE>): OutputInterface<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputExpression<OE>>, OP>;
    output<CB extends OutputCallback<DB, TB, OP>>(callback: CB): OutputInterface<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputCallback<CB>>, OP>;
    output<OE extends OutputExpression<DB, TB, OP>>(selection: OE): OutputInterface<DB, TB, ReturningRow<DB, TB, O, SelectExpressionFromOutputExpression<OE>>, OP>;
    /**
     * Adds an `output {prefix}.*` to an `insert`/`update`/`delete`/`merge` query on databases
     * that support `output` such as MS SQL Server (MSSQL).
     *
     * Also see the {@link output} method.
     */
    outputAll(table: OP): OutputInterface<DB, TB, ReturningAllRow<DB, TB, O>, OP>;
}
export type OutputPrefix = 'deleted' | 'inserted';
export type OutputDatabase<DB, TB extends keyof DB, OP extends OutputPrefix = OutputPrefix> = {
    [K in OP]: DB[TB];
};
export type OutputExpression<DB, TB extends keyof DB, OP extends OutputPrefix = OutputPrefix, ODB = OutputDatabase<DB, TB, OP>, OTB extends keyof ODB = keyof ODB> = AnyAliasedColumnWithTable<ODB, OTB> | AnyColumnWithTable<ODB, OTB> | AliasedExpressionOrFactory<ODB, OTB>;
export type OutputCallback<DB, TB extends keyof DB, OP extends OutputPrefix = OutputPrefix> = (eb: ExpressionBuilder<OutputDatabase<DB, TB, OP>, OP>) => ReadonlyArray<OutputExpression<DB, TB, OP>>;
export type SelectExpressionFromOutputExpression<OE> = OE extends `${OutputPrefix}.${infer C}` ? C : OE;
export type SelectExpressionFromOutputCallback<CB> = CB extends (eb: ExpressionBuilder<any, any>) => ReadonlyArray<infer OE> ? SelectExpressionFromOutputExpression<OE> : never;
