import { IsAny, IsLiteral, IsNever, IsUnknown, KnownKeys, Simplify } from "./types.cjs";

//#region src/helpers/jsonify.d.ts

type NotJsonable = ((...arguments_: any[]) => any) | undefined | symbol;
type NeverToNull<T> = IsNever<T> extends true ? null : T;
type UnknownArray = readonly unknown[];
type JsonifyList<T extends UnknownArray> = T extends readonly [] ? [] : T extends readonly [infer F, ...infer R] ? [NeverToNull<Jsonify<F>>, ...JsonifyList<R>] : IsUnknown<T[number]> extends true ? [] : Array<T[number] extends NotJsonable ? null : Jsonify<T[number]>>;
type FilterJsonableKeys<T extends object> = { [Key in keyof T]: T[Key] extends NotJsonable ? never : Key }[keyof T];
/**
JSON serialize objects (not including arrays) and classes.
*/
type JsonifyObject<T extends object> = { [Key in keyof Pick<T, FilterJsonableKeys<T>>]: Jsonify<T[Key]> };
/**
Matches the hidden `Infinity` type.

Please upvote [this issue](https://github.com/microsoft/TypeScript/issues/32277) if you want to have this type as a built-in in TypeScript.

@see NegativeInfinity
*/
type PositiveInfinity = 1e999;
/**
Matches the hidden `-Infinity` type.

Please upvote [this issue](https://github.com/microsoft/TypeScript/issues/32277) if you want to have this type as a built-in in TypeScript.

@see PositiveInfinity
*/
type NegativeInfinity = -1e999;
/**
Matches a JSON object.

This type can be useful to enforce some input to be JSON-compatible or as a super-type to be extended from. Don't use this as a direct return type as the user would have to double-cast it: `jsonObject as unknown as CustomResponse`. Instead, you could extend your CustomResponse type from it to ensure your type only uses JSON-compatible types: `interface CustomResponse extends JsonObject { … }`.
*/
type JsonObject = { [Key in string]: JsonValue } & { [Key in string]?: JsonValue | undefined };
/**
Matches a JSON array.
*/
type JsonArray = JsonValue[] | readonly JsonValue[];
/**
Matches any valid JSON primitive value.
*/
type JsonPrimitive = string | number | boolean | null;
/**
Matches any valid JSON value.

@see `Jsonify` if you need to transform a type to one that is assignable to `JsonValue`.
*/
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
declare const emptyObjectSymbol: unique symbol;
/**
Represents a strictly empty plain object, the `{}` value.

When you annotate something as the type `{}`, it can be anything except `null` and `undefined`. This means that you cannot use `{}` to represent an empty plain object ([read more](https://stackoverflow.com/questions/47339869/typescript-empty-object-and-any-difference/52193484#52193484)).

@example
```
import type {EmptyObject} from 'type-fest';

// The following illustrates the problem with `{}`.
const foo1: {} = {}; // Pass
const foo2: {} = []; // Pass
const foo3: {} = 42; // Pass
const foo4: {} = {a: 1}; // Pass

// With `EmptyObject` only the first case is valid.
const bar1: EmptyObject = {}; // Pass
const bar2: EmptyObject = 42; // Fail
const bar3: EmptyObject = []; // Fail
const bar4: EmptyObject = {a: 1}; // Fail
```

Unfortunately, `Record<string, never>`, `Record<keyof any, never>` and `Record<never, never>` do not work. See {@link https://github.com/sindresorhus/type-fest/issues/395}.
*/
type EmptyObject = {
  [emptyObjectSymbol]?: never;
};
/**
Matches any [typed array](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray), like `Uint8Array` or `Float64Array`.
*/
type TypedArray = Int8Array | Uint8Array | Uint8ClampedArray | Int16Array | Uint16Array | Int32Array | Uint32Array | Float32Array | Float64Array | BigInt64Array | BigUint64Array;
type BaseKeyFilter<Type, Key extends keyof Type> = Key extends symbol ? never : Type[Key] extends symbol ? never : {
  name: string;
} extends Type[Key] ? Key : [(...arguments_: any[]) => any] extends [Type[Key]] ? never : Key;
/**
Returns the required keys.
*/
type FilterDefinedKeys<T extends object> = Exclude<{ [Key in keyof T]: IsAny<T[Key]> extends true ? Key : IsUnknown<T[Key]> extends true ? Key : undefined extends T[Key] ? never : T[Key] extends undefined ? never : BaseKeyFilter<T, Key> }[keyof T], undefined>;
/**
Returns the optional keys.
*/
type FilterOptionalKeys<T extends object> = Exclude<{ [Key in keyof T]: IsAny<T[Key]> extends true ? never : undefined extends T[Key] ? T[Key] extends undefined ? never : BaseKeyFilter<T, Key> : never }[keyof T], undefined>;
/**
For an object T, if it has any properties that are a union with `undefined`, make those into optional properties instead.

@example
```
type User = {
    firstName: string;
    lastName: string | undefined;
};

type OptionalizedUser = UndefinedToOptional<User>;
//=> {
// 	firstName: string;
// 	lastName?: string;
// }
```
*/
type UndefinedToOptional<T extends object> = Simplify<{ [Key in keyof Pick<T, FilterDefinedKeys<T>>]: T[Key] } & { [Key in keyof Pick<T, FilterOptionalKeys<T>>]?: Exclude<T[Key], undefined> }>;
/**
Transform a type to one that is assignable to the `JsonValue` type.

This includes:
1. Transforming JSON `interface` to a `type` that is assignable to `JsonValue`.
2. Transforming non-JSON value that is *jsonable* to a type that is assignable to `JsonValue`, where *jsonable* means the non-JSON value implements the `.toJSON()` method that returns a value that is assignable to `JsonValue`.

@remarks

An interface cannot be structurally compared to `JsonValue` because an interface can be re-opened to add properties that may not be satisfy `JsonValue`.

@example
```
import type {Jsonify, JsonValue} from 'type-fest';

interface Geometry {
    type: 'Point' | 'Polygon';
    coordinates: [number, number];
}

const point: Geometry = {
    type: 'Point',
    coordinates: [1, 1]
};

const problemFn = (data: JsonValue) => {
    // Does something with data
};

problemFn(point); // Error: type Geometry is not assignable to parameter of type JsonValue because it is an interface

const fixedFn = <T>(data: Jsonify<T>) => {
    // Does something with data
};

fixedFn(point); // Good: point is assignable. Jsonify<T> transforms Geometry into value assignable to JsonValue
fixedFn(new Date()); // Error: As expected, Date is not assignable. Jsonify<T> cannot transforms Date into value assignable to JsonValue
```

Non-JSON values such as `Date` implement `.toJSON()`, so they can be transformed to a value assignable to `JsonValue`:

@example
```
import type {Jsonify} from 'type-fest';

const time = {
    timeValue: new Date()
};

// `Jsonify<typeof time>` is equivalent to `{timeValue: string}`
const timeJson = JSON.parse(JSON.stringify(time)) as Jsonify<typeof time>;
```

{@link https://github.com/Microsoft/TypeScript/issues/1897#issuecomment-710744173}
*/
type Jsonify<T> = IsAny<T> extends true ? any : IsUnknown<T> extends true ? unknown : T extends PositiveInfinity | NegativeInfinity ? null : T extends JsonPrimitive ? T : T extends {
  toJSON(): infer J;
} ? (() => J) extends (() => JsonValue) ? J : Jsonify<J> : T extends number ? number : T extends string ? string : T extends boolean ? boolean : T extends Map<any, any> | Set<any> ? EmptyObject : T extends TypedArray ? Record<string, number> : T extends NotJsonable ? never : T extends UnknownArray ? JsonifyList<T> : T extends object ? IsLiteral<keyof T> extends true ? JsonifyObject<UndefinedToOptional<T>> : Simplify<JsonifyObject<UndefinedToOptional<T>> & JsonifyObject<UndefinedToOptional<Pick<T, KnownKeys<T>>>>> : never;
//#endregion
export { Jsonify };
//# sourceMappingURL=jsonify.d.cts.map