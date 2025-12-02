import { DrainOuterGeneric } from './type-utils.js';
/**
 * This type can be used to specify a different type for
 * select, insert and update operations.
 *
 * Also see the {@link Generated} type.
 *
 * ### Examples
 *
 * The next example defines a number column that is optional
 * in inserts and updates. All columns are always optional
 * in updates so therefore we don't need to specify `undefined`
 * for the update type. The type below is useful for all kinds of
 * database generated columns like identifiers. The `Generated`
 * type is actually just a shortcut for the type in this example:
 *
 * ```ts
 * type GeneratedNumber = ColumnType<number, number | undefined, number>
 * ```
 *
 * The above example makes the column optional in inserts
 * and updates, but you can still choose to provide the
 * column. If you want to prevent insertion/update you
 * can se the type as `never`:
 *
 * ```ts
 * type ReadonlyNumber = ColumnType<number, never, never>
 * ```
 *
 * Here's one more example where the type is different
 * for each different operation:
 *
 * ```ts
 * type UnupdateableDate = ColumnType<Date, string, never>
 * ```
 */
export type ColumnType<SelectType, InsertType = SelectType, UpdateType = SelectType> = {
    readonly __select__: SelectType;
    readonly __insert__: InsertType;
    readonly __update__: UpdateType;
};
/**
 * A shortcut for defining database-generated columns. The type
 * is the same for all selects, inserts and updates but the
 * column is optional for inserts and updates.
 *
 * The update type is `S` instead of `S | undefined` because updates are always
 * optional --> no need to specify optionality.
 * ```
 */
export type Generated<S> = ColumnType<S, S | undefined, S>;
/**
 * A shortcut for defining columns that are only database-generated
 * (like postgres GENERATED ALWAYS AS IDENTITY). No insert/update
 * is allowed.
 */
export type GeneratedAlways<S> = ColumnType<S, never, never>;
/**
 * A shortcut for defining JSON columns, which are by default inserted/updated
 * as stringified JSON strings.
 */
export type JSONColumnType<SelectType extends object | null, InsertType = string, UpdateType = string> = ColumnType<SelectType, InsertType, UpdateType>;
/**
 * Evaluates to `K` if `T` can be `null` or `undefined`.
 */
type IfNullable<T, K> = undefined extends T ? K : null extends T ? K : never;
/**
 * Evaluates to `K` if `T` can't be `null` or `undefined`.
 */
type IfNotNullable<T, K> = undefined extends T ? never : null extends T ? never : T extends never ? never : K;
/**
 * Evaluates to `K` if `T` isn't `never`.
 */
type IfNotNever<T, K> = T extends never ? never : K;
export type SelectType<T> = T extends ColumnType<infer S, any, any> ? S : T;
export type InsertType<T> = T extends ColumnType<any, infer I, any> ? I : T;
export type UpdateType<T> = T extends ColumnType<any, any, infer U> ? U : T;
/**
 * Keys of `R` whose `InsertType` values can be `null` or `undefined`.
 */
export type NullableInsertKeys<R> = {
    [K in keyof R]: IfNullable<InsertType<R[K]>, K>;
}[keyof R];
/**
 * Keys of `R` whose `InsertType` values can't be `null` or `undefined`.
 */
export type NonNullableInsertKeys<R> = {
    [K in keyof R]: IfNotNullable<InsertType<R[K]>, K>;
}[keyof R];
/**
 * Keys of `R` whose `SelectType` values are not `never`
 */
type NonNeverSelectKeys<R> = {
    [K in keyof R]: IfNotNever<SelectType<R[K]>, K>;
}[keyof R];
/**
 * Keys of `R` whose `UpdateType` values are not `never`
 */
export type UpdateKeys<R> = {
    [K in keyof R]: IfNotNever<UpdateType<R[K]>, K>;
}[keyof R];
/**
 * Given a table interface, extracts the select type from all
 * {@link ColumnType} types.
 *
 * ### Examples
 *
 * ```ts
 * interface PersonTable {
 *   id: Generated<number>
 *   first_name: string
 *   modified_at: ColumnType<Date, string, never>
 * }
 *
 * type Person = Selectable<PersonTable>
 * // {
 * //   id: number,
 * //   first_name: string
 * //   modified_at: Date
 * // }
 * ```
 */
export type Selectable<R> = DrainOuterGeneric<{
    [K in NonNeverSelectKeys<R>]: SelectType<R[K]>;
}>;
/**
 * Given a table interface, extracts the insert type from all
 * {@link ColumnType} types.
 *
 * ### Examples
 *
 * ```ts
 * interface PersonTable {
 *   id: Generated<number>
 *   first_name: string
 *   modified_at: ColumnType<Date, string, never>
 * }
 *
 * type InsertablePerson = Insertable<PersonTable>
 * // {
 * //   id?: number,
 * //   first_name: string
 * //   modified_at: string
 * // }
 * ```
 */
export type Insertable<R> = DrainOuterGeneric<{
    [K in NonNullableInsertKeys<R>]: InsertType<R[K]>;
} & {
    [K in NullableInsertKeys<R>]?: InsertType<R[K]>;
}>;
/**
 * Given a table interface, extracts the update type from all
 * {@link ColumnType} types.
 *
 * ### Examples
 *
 * ```ts
 * interface PersonTable {
 *   id: Generated<number>
 *   first_name: string
 *   modified_at: ColumnType<Date, string, never>
 * }
 *
 * type UpdateablePerson = Updateable<PersonTable>
 * // {
 * //   id?: number,
 * //   first_name?: string
 * // }
 * ```
 */
export type Updateable<R> = DrainOuterGeneric<{
    [K in UpdateKeys<R>]?: UpdateType<R[K]>;
}>;
export {};
