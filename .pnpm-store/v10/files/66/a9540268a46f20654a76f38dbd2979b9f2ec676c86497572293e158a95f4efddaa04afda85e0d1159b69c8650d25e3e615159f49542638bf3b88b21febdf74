import { EventPayload } from "../types.cjs";

//#region src/helpers/types.d.ts

/**
 * Returns the given generic as either itself or an array of itself.
 */
type SingleOrArray<T> = T | T[];
/**
 * Given type `T`, return it as an array if it is not already an array.
 */
type AsArray<T> = T extends any[] ? T : [T];
/**
 * Given type `T`, return a tuple of `T` that contains at least one element,
 * where `T` is not distributed, such that each array element could be any type
 * that satisfies `T`.
 *
 * See also {@link AsDistributedTuple}.
 *
 * @example
 * ```ts
 * // ["foo", ..."foo"[]]
 * type T0 = AsTuple<"foo">;
 *
 * // ["foo" | "bar", ...("foo" | "bar")[]]
 * type T1 = AsTuple<"foo" | "bar">;
 */
type AsTuple<T> = Simplify<[T, ...T[]]>;
/**
 * Returns the given generic as either itself or a promise of itself.
 */
type MaybePromise<T> = T | Promise<T>;
/**
 * Acts like `Partial<T>` but only for the keys in `K`, leaving the rest alone.
 */
type PartialK<T, K extends PropertyKey = PropertyKey> = Partial<Pick<T, Extract<keyof T, K>>> & Omit<T, K> extends infer O ? { [P in keyof O]: O[P] } : never;
/**
 * A payload that could be sent to Inngest, based on the given `Events`.
 */
type SendEventPayload<Events extends Record<string, EventPayload>> = SingleOrArray<{ [K in keyof WithoutInternal<Events>]: PartialK<Omit<WithoutInternal<Events>[K], "v">, "ts"> }[keyof WithoutInternal<Events>]>;
/**
 * @public
 */
type WithoutInternal<T extends Record<string, EventPayload>> = { [K in keyof T as WithoutInternalStr<K & string>]: T[K] };
type WithoutInternalStr<T extends string> = T extends `inngest/${string}` ? never : T;
/**
 * Returns all keys from objects in the union `T`.
 *
 * @public
 */
type UnionKeys<T> = T extends T ? keyof T : never;
/**
 * Enforces strict union comformity by ensuring that all potential keys in a
 * union of objects are accounted for in every object.
 *
 * Requires two generics to be used, so is abstracted by {@link StrictUnion}.
 *
 * @public
 */
type StrictUnionHelper<T, TAll> = T extends any ? T & Partial<Record<Exclude<UnionKeys<TAll>, keyof T>, never>> : never;
/**
 * Enforces strict union comformity by ensuring that all potential keys in a
 * union of objects are accounted for in every object.
 *
 * @public
 */
type StrictUnion<T> = StrictUnionHelper<T, T>;
/**
 * Returns `true` if the given generic `T` is a string literal, e.g. `"foo"`, or
 * `false` if it is a string type, e.g. `string`.
 *
 * Useful for checking whether the keys of an object are known or not.
 *
 * @example
 * ```ts
 * // false
 * type ObjIsGeneric = IsStringLiteral<keyof Record<string, boolean>>;
 *
 * // true
 * type ObjIsKnown = IsStringLiteral<keyof { foo: boolean; }>; // true
 * ```
 *
 * @internal
 */
type IsStringLiteral<T extends string> = string extends T ? false : true;
/**
 * Returns `true` if the given generic `T` is `any`, or `false` if it is not.
 */
type IsAny<T> = 0 extends 1 & T ? true : false;
/**
 * Given a function T, return the awaited return type of that function,
 * ignoring the fact that T may be undefined.
 */
type Await<T extends ((...args: any[]) => any) | undefined> = Awaited<ReturnType<NonNullable<T>>>;
/**
 * Given an object TAcc and an array of objects TArr, return a new object that
 * is the result of merging all of the objects in TArr into TAcc.
 */
type ObjectAssign<TArr, TAcc = {}> = TArr extends [infer TFirst, ...infer TRest] ? Simplify<ObjectAssign<TRest, Omit<TAcc, keyof TFirst> & TFirst>> : TAcc;
/**
 * Make a type's keys mutually exclusive.
 *
 * @example
 * Make 1 key mutually exclusive with 1 other key.
 *
 * ```ts
 * type MyType = ExclusiveKeys<{a: number, b: number}, "a", "b">
 *
 * const valid1: MyType = { a: 1 }
 * const valid2: MyType = { b: 1 }
 * const invalid1: MyType = { a: 1, b: 1 }
 * ```
 *
 * @example
 * Make 1 key mutually exclusive with 2 other keys.
 *
 * ```ts
 * type MyType = ExclusiveKeys<{a: number, b: number, c: number}, "a", "b" | "c">
 *
 * const valid1: MyType = { a: 1 };
 * const valid2: MyType = { b: 1, c: 1 };
 * const invalid1: MyType = { a: 1, b: 1 };
 * const invalid2: MyType = { a: 1, c: 1 };
 * const invalid3: MyType = { a: 1, b: 1, c: 1 };
 * ```
 */
type ExclusiveKeys<T, Keys1 extends keyof T, Keys2 extends keyof T> = (Omit<T, Keys1> & { [K in Keys1]?: never }) | (Omit<T, Keys2> & { [K in Keys2]?: never });
/**
 * A type that represents either `A` or `B`. Shared properties retain their
 * types and unique properties are marked as optional.
 */
type Either<A, B> = Partial<A> & Partial<B> & (A | B);
/**
 * Given a function `T`, return the parameters of that function, except for the
 * first one.
 */
type ParametersExceptFirst<T> = T extends ((arg0: any, ...rest: infer U) => any) ? U : never;
/**
 * Given an object `T`, return `true` if it contains no keys, or `false` if it
 * contains any keys.
 *
 * Useful for detecting the passing of a `{}` (any non-nullish) type.
 */
type IsEmptyObject<T> = {} extends T ? T extends {} ? true : false : false;
/**
 * Create a tuple that can be of length 1 to `TLength`, where each element is
 * of type `TElement`.
 */
type RecursiveTuple<TElement, TLength extends number, TAccumulator extends TElement[] = [TElement]> = TAccumulator["length"] extends TLength ? TAccumulator : RecursiveTuple<TElement, TLength, [TElement, ...TAccumulator]> | TAccumulator;
type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
type ConditionalSimplifyDeep<Type, ExcludeType = never, IncludeType = unknown> = Type extends ExcludeType ? Type : Type extends IncludeType ? { [TypeKey in keyof Type]: ConditionalSimplifyDeep<Type[TypeKey], ExcludeType, IncludeType> } : Type;
type SimplifyDeep<Type> = ConditionalSimplifyDeep<Type, Function | Iterable<unknown>, object>;
/**
Returns a boolean for whether the given type is `null`.
*/
type IsNull<T> = [T] extends [null] ? true : false;
/**
Returns a boolean for whether the given type is `unknown`.

{@link https://github.com/dsherret/conditional-type-checks/pull/16}

Useful in type utilities, such as when dealing with unknown data from API calls.

@example
```
import type {IsUnknown} from 'type-fest';

// https://github.com/pajecawav/tiny-global-store/blob/master/src/index.ts
type Action<TState, TPayload = void> =
    IsUnknown<TPayload> extends true
        ? (state: TState) => TState,
        : (state: TState, payload: TPayload) => TState;

class Store<TState> {
    constructor(private state: TState) {}

    execute<TPayload = void>(action: Action<TState, TPayload>, payload?: TPayload): TState {
        this.state = action(this.state, payload);
        return this.state;
    }

    // ... other methods
}

const store = new Store({value: 1});
declare const someExternalData: unknown;

store.execute(state => ({value: state.value + 1}));
//=> `TPayload` is `void`

store.execute((state, payload) => ({value: state.value + payload}), 5);
//=> `TPayload` is `5`

store.execute((state, payload) => ({value: state.value + payload}), someExternalData);
//=> Errors: `action` is `(state: TState) => TState`
```
*/
type IsUnknown<T> = unknown extends T ? IsNull<T> extends false ? true : false : false;
/**
Returns a boolean for whether the two given types are equal.

{@link https://github.com/microsoft/TypeScript/issues/27024#issuecomment-421529650}
{@link https://stackoverflow.com/questions/68961864/how-does-the-equals-work-in-typescript/68963796#68963796}

Use-cases:
- If you want to make a conditional branch based on the result of a comparison of two types.

@example
```
import type {IsEqual} from 'type-fest';

// This type returns a boolean for whether the given array includes the given item.
// `IsEqual` is used to compare the given array at position 0 and the given item and then return true if they are equal.
type Includes<Value extends readonly any[], Item> =
    Value extends readonly [Value[0], ...infer rest]
        ? IsEqual<Value[0], Item> extends true
            ? true
            : Includes<rest, Item>
        : false;
```
*/
type IsEqual<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
/**
 * Returns a boolean for whether the given type `T` is `never`.
 */
type IsNever<T> = [T] extends [never] ? true : false;
/**
 * Given a type `T`, return `Then` if `T` is a string, number, or symbol
 * literal, else `Else`.
 *
 * `Then` defaults to `true` and `Else` defaults to `false`.
 *
 * Useful for determining if an object is a generic type or has known keys.
 *
 * @example
 * ```ts
 * type IsLiteralType = IsLiteral<"foo">; // true
 * type IsLiteralType = IsLiteral<string>; // false
 *
 * type IsLiteralType = IsLiteral<1>; // true
 * type IsLiteralType = IsLiteral<number>; // false
 *
 * type IsLiteralType = IsLiteral<symbol>; // true
 * type IsLiteralType = IsLiteral<typeof Symbol.iterator>; // false
 *
 * type T0 = { foo: string };
 * type HasAllKnownKeys = IsLiteral<keyof T0>; // true
 *
 * type T1 = { [x: string]: any; foo: boolean };
 * type HasAllKnownKeys = IsLiteral<keyof T1>; // false
 * ```
 */
type IsLiteral<T, Then = true, Else = false> = string extends T ? Else : number extends T ? Else : symbol extends T ? Else : Then;
/**
 * Given an object `T`, return the keys of that object that are known literals.
 *
 * Useful for filtering out generic mapped types from objects.
 *
 * @example
 * ```ts
 * type T0 = { foo: string };
 * type RegularKeys = keyof T0; // "foo"
 * type KnownKeys = KnownLiteralKeys<T0>; // "foo"
 *
 * type T1 = { [x: string]: any; foo: boolean };
 * type RegularKeys = keyof T1; // string | number
 * type KnownKeys = KnownLiteralKeys<T1>; // "foo"
 * ```
 */
type KnownKeys<T> = keyof { [K in keyof T as IsLiteral<K, K, never>]: T[K] };
/**
 * Given an object `T`, return the keys of that object that are public, ignoring
 * `private` and `protected` keys.
 *
 * This shouldn't commonly be used or exposed in user-facing types, as it can
 * skew extension checks.
 */
type Public<T> = { [K in keyof T]: T[K] };
//#endregion
export { AsArray, AsTuple, Await, Either, ExclusiveKeys, IsAny, IsEmptyObject, IsEqual, IsLiteral, IsNever, IsStringLiteral, IsUnknown, KnownKeys, MaybePromise, ObjectAssign, ParametersExceptFirst, Public, RecursiveTuple, SendEventPayload, Simplify, SimplifyDeep, SingleOrArray, StrictUnion, StrictUnionHelper, UnionKeys, WithoutInternal, WithoutInternalStr };
//# sourceMappingURL=types.d.cts.map