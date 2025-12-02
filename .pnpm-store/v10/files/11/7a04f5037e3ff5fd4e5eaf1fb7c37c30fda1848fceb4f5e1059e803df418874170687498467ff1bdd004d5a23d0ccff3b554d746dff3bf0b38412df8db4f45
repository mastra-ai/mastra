/**
 * Common utilities for manipulating TypeScript types.
 * @module
 */
/**
 * Hack! This type causes TypeScript to simplify how it renders object types.
 *
 * It is functionally the identity for object types, but in practice it can
 * simplify expressions like `A & B`.
 */
export type Expand<ObjectType extends Record<any, any>> = ObjectType extends Record<any, any> ? {
    [Key in keyof ObjectType]: ObjectType[Key];
} : never;
/**
 * An `Omit<>` type that:
 * 1. Applies to each element of a union.
 * 2. Preserves the index signature of the underlying type.
 */
export type BetterOmit<T, K extends keyof T> = {
    [Property in keyof T as Property extends K ? never : Property]: T[Property];
};
/**
 * Convert a union type like `A | B | C` into an intersection type like
 * `A & B & C`.
 */
export type UnionToIntersection<UnionType> = (UnionType extends any ? (k: UnionType) => void : never) extends (k: infer I) => void ? I : never;
//# sourceMappingURL=type_utils.d.ts.map