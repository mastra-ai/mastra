import { Expand } from "../type_utils.js";
import { GenericId } from "./index.js";
import {
  OptionalProperty,
  VAny,
  VArray,
  VBoolean,
  VBytes,
  VFloat64,
  VId,
  VInt64,
  VLiteral,
  VNull,
  VObject,
  VOptional,
  VRecord,
  VString,
  VUnion,
  Validator,
} from "./validators.js";

/**
 * The type that all validators must extend.
 *
 * @public
 */
export type GenericValidator = Validator<any, any, any>;

export function isValidator(v: any): v is GenericValidator {
  return !!v.isConvexValidator;
}

/**
 * Coerce an object with validators as properties to a validator.
 * If a validator is passed, return it.
 *
 * @public
 */
export function asObjectValidator<
  V extends Validator<any, any, any> | PropertyValidators,
>(
  obj: V,
): V extends Validator<any, any, any>
  ? V
  : V extends PropertyValidators
    ? Validator<ObjectType<V>>
    : never {
  if (isValidator(obj)) {
    return obj as any;
  } else {
    return v.object(obj as PropertyValidators) as any;
  }
}

/**
 * Coerce an object with validators as properties to a validator.
 * If a validator is passed, return it.
 *
 * @public
 */
export type AsObjectValidator<
  V extends Validator<any, any, any> | PropertyValidators,
> =
  V extends Validator<any, any, any>
    ? V
    : V extends PropertyValidators
      ? Validator<ObjectType<V>>
      : never;

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
export const v = {
  /**
   * Validates that the value corresponds to an ID of a document in given table.
   * @param tableName The name of the table.
   */
  id: <TableName extends string>(tableName: TableName) => {
    return new VId<GenericId<TableName>>({
      isOptional: "required",
      tableName,
    });
  },

  /**
   * Validates that the value is of type Null.
   */
  null: () => {
    return new VNull({ isOptional: "required" });
  },

  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   *
   * Alias for `v.float64()`
   */
  number: () => {
    return new VFloat64({ isOptional: "required" });
  },

  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   */
  float64: () => {
    return new VFloat64({ isOptional: "required" });
  },

  /**
   * @deprecated Use `v.int64()` instead
   */
  bigint: () => {
    return new VInt64({ isOptional: "required" });
  },

  /**
   * Validates that the value is of Convex type Int64 (BigInt in JS).
   */
  int64: () => {
    return new VInt64({ isOptional: "required" });
  },

  /**
   * Validates that the value is of type Boolean.
   */
  boolean: () => {
    return new VBoolean({ isOptional: "required" });
  },

  /**
   * Validates that the value is of type String.
   */
  string: () => {
    return new VString({ isOptional: "required" });
  },

  /**
   * Validates that the value is of Convex type Bytes (constructed in JS via `ArrayBuffer`).
   */
  bytes: () => {
    return new VBytes({ isOptional: "required" });
  },

  /**
   * Validates that the value is equal to the given literal value.
   * @param literal The literal value to compare against.
   */
  literal: <T extends string | number | bigint | boolean>(literal: T) => {
    return new VLiteral<T>({ isOptional: "required", value: literal });
  },

  /**
   * Validates that the value is an Array of the given element type.
   * @param element The validator for the elements of the array.
   */
  array: <T extends Validator<any, "required", any>>(element: T) => {
    return new VArray<T["type"][], T>({ isOptional: "required", element });
  },

  /**
   * Validates that the value is an Object with the given properties.
   * @param fields An object specifying the validator for each property.
   */
  object: <T extends PropertyValidators>(fields: T) => {
    return new VObject<ObjectType<T>, T>({ isOptional: "required", fields });
  },

  /**
   * Validates that the value is a Record with keys and values that match the given types.
   * @param keys The validator for the keys of the record. This cannot contain string literals.
   * @param values The validator for the values of the record.
   */
  record: <
    Key extends Validator<string, "required", any>,
    Value extends Validator<any, "required", any>,
  >(
    keys: Key,
    values: Value,
  ) => {
    return new VRecord<Record<Infer<Key>, Value["type"]>, Key, Value>({
      isOptional: "required",
      key: keys,
      value: values,
    });
  },

  /**
   * Validates that the value matches one of the given validators.
   * @param members The validators to match against.
   */
  union: <T extends Validator<any, "required", any>[]>(...members: T) => {
    return new VUnion<T[number]["type"], T>({
      isOptional: "required",
      members,
    });
  },

  /**
   * Does not validate the value.
   */
  any: () => {
    return new VAny({ isOptional: "required" });
  },

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
  optional: <T extends GenericValidator>(value: T) => {
    return value.asOptional() as VOptional<T>;
  },

  /**
   * Allows specifying a value or null.
   */
  nullable: <T extends GenericValidator>(value: T) => {
    return v.union(value, v.null());
  },
};

/**
 * Validators for each property of an object.
 *
 * This is represented as an object mapping the property name to its
 * {@link Validator}.
 *
 * @public
 */
export type PropertyValidators = Record<
  string,
  Validator<any, OptionalProperty, any>
>;

/**
 * Compute the type of an object from {@link PropertyValidators}.
 *
 * @public
 */
export type ObjectType<Fields extends PropertyValidators> = Expand<
  // Map each key to the corresponding property validator's type making
  // the optional ones optional.
  {
    // This `Exclude<..., undefined>` does nothing unless
    // the tsconfig.json option `"exactOptionalPropertyTypes": true,`
    // is used. When it is it results in a more accurate type.
    // When it is not the `Exclude` removes `undefined` but it is
    // added again by the optional property.
    [Property in OptionalKeys<Fields>]?: Exclude<
      Infer<Fields[Property]>,
      undefined
    >;
  } & {
    [Property in RequiredKeys<Fields>]: Infer<Fields[Property]>;
  }
>;

type OptionalKeys<PropertyValidators extends Record<string, GenericValidator>> =
  {
    [Property in keyof PropertyValidators]: PropertyValidators[Property]["isOptional"] extends "optional"
      ? Property
      : never;
  }[keyof PropertyValidators];

type RequiredKeys<PropertyValidators extends Record<string, GenericValidator>> =
  Exclude<keyof PropertyValidators, OptionalKeys<PropertyValidators>>;

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
