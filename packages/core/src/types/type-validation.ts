/**
 * Compile-time type validation utilities.
 *
 * Used to ensure explicit interface definitions stay in sync with
 * Zod schema inferences. When a schema changes and the corresponding
 * explicit interface doesn't match, TypeScript will produce a compile error.
 *
 * @example
 * ```ts
 * import { AssertAssignable } from '../../types/type-validation';
 *
 * export const mySchema = z.object({ name: z.string() });
 * export interface MyType { name: string; }
 *
 * // Compile-time check: errors if MyType and z.infer<typeof mySchema> diverge
 * type _Inferred = z.infer<typeof mySchema>;
 * type _ToInferred = AssertAssignable<MyType, _Inferred>;
 * type _FromInferred = AssertAssignable<_Inferred, MyType>;
 * const _check: [_ToInferred, _FromInferred] = [true, true];
 * ```
 */

/**
 * Resolves to `true` if `T` is assignable to `U`, otherwise resolves to `never`.
 * Used for compile-time assertions that two types are structurally compatible.
 */
export type AssertAssignable<T, U> = T extends U ? true : never;
