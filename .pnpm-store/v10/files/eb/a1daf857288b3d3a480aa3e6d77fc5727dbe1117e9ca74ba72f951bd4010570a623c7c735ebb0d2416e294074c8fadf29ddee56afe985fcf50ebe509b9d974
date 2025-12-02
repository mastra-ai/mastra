/// <reference types="./dynamic.d.ts" />
import { DynamicReferenceBuilder } from './dynamic-reference-builder.js';
import { DynamicTableBuilder } from './dynamic-table-builder.js';
export class DynamicModule {
    /**
     * Creates a dynamic reference to a column that is not know at compile time.
     *
     * Kysely is built in a way that by default you can't refer to tables or columns
     * that are not actually visible in the current query and context. This is all
     * done by TypeScript at compile time, which means that you need to know the
     * columns and tables at compile time. This is not always the case of course.
     *
     * This method is meant to be used in those cases where the column names
     * come from the user input or are not otherwise known at compile time.
     *
     * WARNING! Unlike values, column names are not escaped by the database engine
     * or Kysely and if you pass in unchecked column names using this method, you
     * create an SQL injection vulnerability. Always __always__ validate the user
     * input before passing it to this method.
     *
     * There are couple of examples below for some use cases, but you can pass
     * `ref` to other methods as well. If the types allow you to pass a `ref`
     * value to some place, it should work.
     *
     * ### Examples
     *
     * Filter by a column not know at compile time:
     *
     * ```ts
     * async function someQuery(filterColumn: string, filterValue: string) {
     *   const { ref } = db.dynamic
     *
     *   return await db
     *     .selectFrom('person')
     *     .selectAll()
     *     .where(ref(filterColumn), '=', filterValue)
     *     .execute()
     * }
     *
     * someQuery('first_name', 'Arnold')
     * someQuery('person.last_name', 'Aniston')
     * ```
     *
     * Order by a column not know at compile time:
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
     * In this example we add selections dynamically:
     *
     * ```ts
     * const { ref } = db.dynamic
     *
     * // Some column name provided by the user. Value not known at compile time.
     * const columnFromUserInput: PossibleColumns = 'birthdate';
     *
     * // A type that lists all possible values `columnFromUserInput` can have.
     * // You can use `keyof Person` if any column of an interface is allowed.
     * type PossibleColumns = 'last_name' | 'first_name' | 'birthdate'
     *
     * const [person] = await db.selectFrom('person')
     *   .select([
     *     ref<PossibleColumns>(columnFromUserInput),
     *     'id'
     *   ])
     *   .execute()
     *
     * // The resulting type contains all `PossibleColumns` as optional fields
     * // because we cannot know which field was actually selected before
     * // running the code.
     * const lastName: string | null | undefined = person?.last_name
     * const firstName: string | undefined = person?.first_name
     * const birthDate: Date | null | undefined = person?.birthdate
     *
     * // The result type also contains the compile time selection `id`.
     * person?.id
     * ```
     */
    ref(reference) {
        return new DynamicReferenceBuilder(reference);
    }
    /**
     * Creates a table reference to a table that's not fully known at compile time.
     *
     * The type `T` is allowed to be a union of multiple tables.
     *
     * <!-- siteExample("select", "Generic find query", 130) -->
     *
     * A generic type-safe helper function for finding a row by a column value:
     *
     * ```ts
     * import { SelectType } from 'kysely'
     * import { Database } from 'type-editor'
     *
     * async function getRowByColumn<
     *   T extends keyof Database,
     *   C extends keyof Database[T] & string,
     *   V extends SelectType<Database[T][C]>,
     * >(t: T, c: C, v: V) {
     *   // We need to use the dynamic module since the table name
     *   // is not known at compile time.
     *   const { table, ref } = db.dynamic
     *
     *   return await db
     *     .selectFrom(table(t).as('t'))
     *     .selectAll()
     *     .where(ref(c), '=', v)
     *     .orderBy('t.id')
     *     .executeTakeFirstOrThrow()
     * }
     *
     * const person = await getRowByColumn('person', 'first_name', 'Arnold')
     * ```
     */
    table(table) {
        return new DynamicTableBuilder(table);
    }
}
