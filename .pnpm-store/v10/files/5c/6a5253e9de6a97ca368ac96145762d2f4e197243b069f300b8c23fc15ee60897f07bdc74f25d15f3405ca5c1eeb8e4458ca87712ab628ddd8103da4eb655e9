import { Expand } from "../type_utils.js";
import { GenericId } from "./index.js";
import { OptionalProperty, VAny, VArray, VBoolean, VBytes, VFloat64, VId, VInt64, VLiteral, VNull, VObject, VOptional, VRecord, VString, VUnion, Validator } from "./validators.js";
/**
 * The type that all validators must extend.
 *
 * @public
 */
export type GenericValidator = Validator<any, any, any>;
export declare function isValidator(v: any): v is GenericValidator;
/**
 * Coerce an object with validators as properties to a validator.
 * If a validator is passed, return it.
 *
 * @public
 */
export declare function asObjectValidator<V extends Validator<any, any, any> | PropertyValidators>(obj: V): V extends Validator<any, any, any> ? V : V extends PropertyValidators ? Validator<ObjectType<V>> : never;
/**
 * Coerce an object with validators as properties to a validator.
 * If a validator is passed, return it.
 *
 * @public
 */
export type AsObjectValidator<V extends Validator<any, any, any> | PropertyValidators> = V extends Validator<any, any, any> ? V : V extends PropertyValidators ? Validator<ObjectType<V>> : never;
/**
 * The validator builder.
 *
 * This builder allows you to build validators for Convex values.
 *
 * Validators can be used in [schema definitions](https://docs.convex.dev/database/schemas)
 * and as input validators for Convex functions.
 *
 * @public
 */
export declare const v: {
    /**
     * Validates that the value corresponds to an ID of a document in given table.
     * @param tableName The name of the table.
     */
    id: <TableName extends string>(tableName: TableName) => VId<GenericId<TableName>, "required">;
    /**
     * Validates that the value is of type Null.
     */
    null: () => VNull<null, "required">;
    /**
     * Validates that the value is of Convex type Float64 (Number in JS).
     *
     * Alias for `v.float64()`
     */
    number: () => VFloat64<number, "required">;
    /**
     * Validates that the value is of Convex type Float64 (Number in JS).
     */
    float64: () => VFloat64<number, "required">;
    /**
     * @deprecated Use `v.int64()` instead
     */
    bigint: () => VInt64<bigint, "required">;
    /**
     * Validates that the value is of Convex type Int64 (BigInt in JS).
     */
    int64: () => VInt64<bigint, "required">;
    /**
     * Validates that the value is of type Boolean.
     */
    boolean: () => VBoolean<boolean, "required">;
    /**
     * Validates that the value is of type String.
     */
    string: () => VString<string, "required">;
    /**
     * Validates that the value is of Convex type Bytes (constructed in JS via `ArrayBuffer`).
     */
    bytes: () => VBytes<ArrayBuffer, "required">;
    /**
     * Validates that the value is equal to the given literal value.
     * @param literal The literal value to compare against.
     */
    literal: <T extends string | number | bigint | boolean>(literal: T) => VLiteral<T, "required">;
    /**
     * Validates that the value is an Array of the given element type.
     * @param element The validator for the elements of the array.
     */
    array: <T_1 extends Validator<any, "required", any>>(element: T_1) => VArray<T_1["type"][], T_1, "required">;
    /**
     * Validates that the value is an Object with the given properties.
     * @param fields An object specifying the validator for each property.
     */
    object: <T_2 extends PropertyValidators>(fields: T_2) => VObject<Expand<{ [Property in OptionalKeys<T_2>]?: Exclude<Infer<T_2[Property]>, undefined>; } & { [Property_1 in Exclude<keyof T_2, OptionalKeys<T_2>>]: Infer<T_2[Property_1]>; }>, T_2, "required", { [Property_2 in keyof T_2]: Property_2 | `${Property_2 & string}.${T_2[Property_2]["fieldPaths"]}`; }[keyof T_2] & string>;
    /**
     * Validates that the value is a Record with keys and values that match the given types.
     * @param keys The validator for the keys of the record. This cannot contain string literals.
     * @param values The validator for the values of the record.
     */
    record: <Key extends Validator<string, "required", any>, Value extends Validator<any, "required", any>>(keys: Key, values: Value) => VRecord<Record<Infer<Key>, Value["type"]>, Key, Value, "required", string>;
    /**
     * Validates that the value matches one of the given validators.
     * @param members The validators to match against.
     */
    union: <T_3 extends Validator<any, "required", any>[]>(...members: T_3) => VUnion<T_3[number]["type"], T_3, "required", T_3[number]["fieldPaths"]>;
    /**
     * Does not validate the value.
     */
    any: () => VAny<any, "required", string>;
    /**
     * Allows not specifying a value for a property in an Object.
     * @param value The property value validator to make optional.
     *
     * ```typescript
     * const objectWithOptionalFields = v.object({
     *   requiredField: v.string(),
     *   optionalField: v.optional(v.string()),
     * });
     * ```
     */
    optional: <T_4 extends GenericValidator>(value: T_4) => VOptional<T_4>;
    /**
     * Allows specifying a value or null.
     */
    nullable: <T_5 extends GenericValidator>(value: T_5) => VUnion<(T_5 | VNull<null, "required">)["type"], [T_5, VNull<null, "required">], "required", (T_5 | VNull<null, "required">)["fieldPaths"]>;
};
/**
 * Validators for each property of an object.
 *
 * This is represented as an object mapping the property name to its
 * {@link Validator}.
 *
 * @public
 */
export type PropertyValidators = Record<string, Validator<any, OptionalProperty, any>>;
/**
 * Compute the type of an object from {@link PropertyValidators}.
 *
 * @public
 */
export type ObjectType<Fields extends PropertyValidators> = Expand<{
    [Property in OptionalKeys<Fields>]?: Exclude<Infer<Fields[Property]>, undefined>;
} & {
    [Property in RequiredKeys<Fields>]: Infer<Fields[Property]>;
}>;
type OptionalKeys<PropertyValidators extends Record<string, GenericValidator>> = {
    [Property in keyof PropertyValidators]: PropertyValidators[Property]["isOptional"] extends "optional" ? Property : never;
}[keyof PropertyValidators];
type RequiredKeys<PropertyValidators extends Record<string, GenericValidator>> = Exclude<keyof PropertyValidators, OptionalKeys<PropertyValidators>>;
/**
 * Extract a TypeScript type from a validator.
 *
 * Example usage:
 * ```ts
 * const objectSchema = v.object({
 *   property: v.string(),
 * });
 * type MyObject = Infer<typeof objectSchema>; // { property: string }
 * ```
 * @typeParam V - The type of a {@link Validator} constructed with {@link v}.
 *
 * @public
 */
export type Infer<T extends Validator<any, OptionalProperty, any>> = T["type"];
export {};
//# sourceMappingURL=validator.d.ts.map