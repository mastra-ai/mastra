import { InsertResult } from '../query-builder/insert-result.js';
import { DeleteResult } from '../query-builder/delete-result.js';
import { UpdateResult } from '../query-builder/update-result.js';
import { KyselyTypeError } from './type-error.js';
import { MergeResult } from '../query-builder/merge-result.js';
/**
 * Given a database type and a union of table names in that db, returns
 * a union type with all possible column names.
 *
 * Example:
 *
 * ```ts
 * interface Person {
 *   id: number
 * }
 *
 * interface Pet {
 *   name: string
 *   species: 'cat' | 'dog'
 * }
 *
 * interface Movie {
 *   stars: number
 * }
 *
 * interface Database {
 *   person: Person
 *   pet: Pet
 *   movie: Movie
 * }
 *
 * type Columns = AnyColumn<Database, 'person' | 'pet'>
 *
 * // Columns == 'id' | 'name' | 'species'
 * ```
 */
export type AnyColumn<DB, TB extends keyof DB> = {
    [T in TB]: keyof DB[T];
}[TB] & string;
/**
 * Extracts a column type.
 */
export type ExtractColumnType<DB, TB extends keyof DB, C> = {
    [T in TB]: C extends keyof DB[T] ? DB[T][C] : never;
}[TB];
/**
 * Given a database type and a union of table names in that db, returns
 * a union type with all possible `table`.`column` combinations.
 *
 * Example:
 *
 * ```ts
 * interface Person {
 *   id: number
 * }
 *
 * interface Pet {
 *   name: string
 *   species: 'cat' | 'dog'
 * }
 *
 * interface Movie {
 *   stars: number
 * }
 *
 * interface Database {
 *   person: Person
 *   pet: Pet
 *   movie: Movie
 * }
 *
 * type Columns = AnyColumnWithTable<Database, 'person' | 'pet'>
 *
 * // Columns == 'person.id' | 'pet.name' | 'pet.species'
 * ```
 */
export type AnyColumnWithTable<DB, TB extends keyof DB> = {
    [T in TB]: `${T & string}.${keyof DB[T] & string}`;
}[TB];
/**
 * Just like {@link AnyColumn} but with a ` as <string>` suffix.
 */
export type AnyAliasedColumn<DB, TB extends keyof DB> = `${AnyColumn<DB, TB>} as ${string}`;
/**
 * Just like {@link AnyColumnWithTable} but with a ` as <string>` suffix.
 */
export type AnyAliasedColumnWithTable<DB, TB extends keyof DB> = `${AnyColumnWithTable<DB, TB>} as ${string}`;
/**
 * Extracts the item type of an array.
 */
export type ArrayItemType<T> = T extends ReadonlyArray<infer I> ? I : never;
export type SimplifySingleResult<O> = O extends InsertResult ? O : O extends DeleteResult ? O : O extends UpdateResult ? O : O extends MergeResult ? O : Simplify<O> | undefined;
export type SimplifyResult<O> = O extends InsertResult ? O : O extends DeleteResult ? O : O extends UpdateResult ? O : O extends MergeResult ? O : Simplify<O>;
export type Simplify<T> = DrainOuterGeneric<{
    [K in keyof T]: T[K];
} & {}>;
/**
 * Represents a database row whose column names and their types are unknown.
 */
export type UnknownRow = Record<string, unknown>;
/**
 * Makes all properties of object type `T` nullable.
 */
export type Nullable<T> = {
    [P in keyof T]: T[P] | null;
};
/**
 * Evaluates to `true` if `T` is `never`.
 */
export type IsNever<T> = [T] extends [never] ? true : false;
/**
 * Evaluates to `true` if `T` is `any`.
 */
export type IsAny<T> = 0 extends T & 1 ? true : false;
/**
 * Evaluates to `true` if the types `T` and `U` are equal.
 */
export type Equals<T, U> = (<G>() => G extends T ? 1 : 2) extends <G>() => G extends U ? 1 : 2 ? true : false;
export type NarrowPartial<O, T> = DrainOuterGeneric<T extends object ? {
    [K in keyof O & string]: K extends keyof T ? T[K] extends NotNull ? Exclude<O[K], null> : T[K] extends O[K] ? T[K] : KyselyTypeError<`$narrowType() call failed: passed type does not exist in '${K}'s type union`> : O[K];
} : never>;
/**
 * A type constant for marking a column as not null. Can be used with `$narrowPartial`.
 *
 * Example:
 *
 * ```ts
 * import type { NotNull } from 'kysely'
 *
 * await db.selectFrom('person')
 *   .where('nullable_column', 'is not', null)
 *   .selectAll()
 *   .$narrowType<{ nullable_column: NotNull }>()
 *   .executeTakeFirstOrThrow()
 * ```
 */
export type NotNull = {
    readonly __notNull__: unique symbol;
};
export type SqlBool = boolean | 0 | 1;
/**
 * Utility to reduce depth of TypeScript's internal type instantiation stack.
 *
 * Example:
 *
 * ```ts
 * type A<T> = { item: T }
 *
 * type Test<T> = A<
 *   A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<T>>>>>>>>>>>>>>>>>>>>>>>>
 * >
 *
 * // type Error = Test<number> // Type instantiation is excessively deep and possibly infinite.ts (2589)
 * ```
 *
 * To fix this, we can use `DrainOuterGeneric`:
 *
 * ```ts
 * type A<T> = DrainOuterGeneric<{ item: T }>
 *
 * type Test<T> = A<
 *  A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<A<T>>>>>>>>>>>>>>>>>>>>>>>>
 * >
 *
 * type Ok = Test<number> // Ok
 * ```
 */
export type DrainOuterGeneric<T> = [T] extends [unknown] ? T : never;
export type ShallowRecord<K extends keyof any, T> = DrainOuterGeneric<{
    [P in K]: T;
}>;
/**
 * Dehydrates any root properties of an object that are not valid JSON types.
 *
 * For now, we catch anything in {@link StringsWhenDataTypeNotAvailable} and convert it to `string`.
 */
export type ShallowDehydrateObject<O> = {
    [K in keyof O]: ShallowDehydrateValue<O[K]>;
};
/**
 * Dehydrates a value when it is not a valid JSON type.
 *
 * For now, we catch anything in {@link StringsWhenDataTypeNotAvailable} and convert it to `string`,
 * and anything in {@link NumbersWhenDataTypeNotAvailable} and convert it to `number`.
 */
export type ShallowDehydrateValue<T> = T extends null | undefined ? T : T extends (infer U)[] | null | undefined ? Array<ShallowDehydrateValue<U>> | Extract<T, null | undefined> : Exclude<T, StringsWhenDataTypeNotAvailable | NumbersWhenDataTypeNotAvailable> | ([Extract<T, NumbersWhenDataTypeNotAvailable>] extends [never] ? never : number) | ([Extract<T, StringsWhenDataTypeNotAvailable>] extends [never] ? never : string);
export type StringsWhenDataTypeNotAvailable = Date | Uint8Array;
export type NumbersWhenDataTypeNotAvailable = bigint | NumericString;
export type NumericString = `${number}`;
