import { ReturningAllRow, ReturningCallbackRow, ReturningRow } from '../parser/returning-parser.js';
import { SelectCallback, SelectExpression } from '../parser/select-parser.js';
import { Selectable } from '../util/column-type.js';
export interface ReturningInterface<DB, TB extends keyof DB, O> {
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
    returning<SE extends SelectExpression<DB, TB>>(selections: ReadonlyArray<SE>): ReturningInterface<DB, TB, ReturningRow<DB, TB, O, SE>>;
    returning<CB extends SelectCallback<DB, TB>>(callback: CB): ReturningInterface<DB, TB, ReturningCallbackRow<DB, TB, O, CB>>;
    returning<SE extends SelectExpression<DB, TB>>(selection: SE): ReturningInterface<DB, TB, ReturningRow<DB, TB, O, SE>>;
    /**
     * Adds a `returning *` to an insert/update/delete/merge query on databases
     * that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll(): ReturningInterface<DB, TB, Selectable<DB[TB]>>;
}
export interface MultiTableReturningInterface<DB, TB extends keyof DB, O> extends ReturningInterface<DB, TB, O> {
    /**
     * Adds a `returning *` or `returning table.*` to an insert/update/delete/merge
     * query on databases that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll<T extends TB>(tables: ReadonlyArray<T>): MultiTableReturningInterface<DB, TB, ReturningAllRow<DB, T, O>>;
    /**
     * Adds a `returning *` to an insert/update/delete/merge query on databases
     * that support `returning` such as PostgreSQL.
     *
     * Also see the {@link returning} method.
     */
    returningAll<T extends TB>(table: T): MultiTableReturningInterface<DB, TB, ReturningAllRow<DB, T, O>>;
    returningAll(): ReturningInterface<DB, TB, Selectable<DB[TB]>>;
}
