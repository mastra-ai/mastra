/**
 * Useful to flatten the type output to improve type hints shown in editors. And also to transform an interface into a type to aide with assignability.
 * https://github.com/sindresorhus/type-fest/blob/main/source/simplify.d.ts
 */
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};

export type { Simplify };
