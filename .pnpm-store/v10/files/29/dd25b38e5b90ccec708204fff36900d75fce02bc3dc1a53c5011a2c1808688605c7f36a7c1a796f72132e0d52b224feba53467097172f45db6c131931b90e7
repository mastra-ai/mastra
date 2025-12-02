"use strict";
import {
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
  VRecord,
  VString,
  VUnion
} from "./validators.js";
export function isValidator(v2) {
  return !!v2.isConvexValidator;
}
export function asObjectValidator(obj) {
  if (isValidator(obj)) {
    return obj;
  } else {
    return v.object(obj);
  }
}
export const v = {
  /**
   * Validates that the value corresponds to an ID of a document in given table.
   * @param tableName The name of the table.
   */
  id: (tableName) => {
    return new VId({
      isOptional: "required",
      tableName
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
  literal: (literal) => {
    return new VLiteral({ isOptional: "required", value: literal });
  },
  /**
   * Validates that the value is an Array of the given element type.
   * @param element The validator for the elements of the array.
   */
  array: (element) => {
    return new VArray({ isOptional: "required", element });
  },
  /**
   * Validates that the value is an Object with the given properties.
   * @param fields An object specifying the validator for each property.
   */
  object: (fields) => {
    return new VObject({ isOptional: "required", fields });
  },
  /**
   * Validates that the value is a Record with keys and values that match the given types.
   * @param keys The validator for the keys of the record. This cannot contain string literals.
   * @param values The validator for the values of the record.
   */
  record: (keys, values) => {
    return new VRecord({
      isOptional: "required",
      key: keys,
      value: values
    });
  },
  /**
   * Validates that the value matches one of the given validators.
   * @param members The validators to match against.
   */
  union: (...members) => {
    return new VUnion({
      isOptional: "required",
      members
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
  optional: (value) => {
    return value.asOptional();
  },
  /**
   * Allows specifying a value or null.
   */
  nullable: (value) => {
    return v.union(value, v.null());
  }
};
//# sourceMappingURL=validator.js.map
