"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var validator_exports = {};
__export(validator_exports, {
  asObjectValidator: () => asObjectValidator,
  isValidator: () => isValidator,
  v: () => v
});
module.exports = __toCommonJS(validator_exports);
var import_validators = require("./validators.js");
function isValidator(v2) {
  return !!v2.isConvexValidator;
}
function asObjectValidator(obj) {
  if (isValidator(obj)) {
    return obj;
  } else {
    return v.object(obj);
  }
}
const v = {
  /**
   * Validates that the value corresponds to an ID of a document in given table.
   * @param tableName The name of the table.
   */
  id: (tableName) => {
    return new import_validators.VId({
      isOptional: "required",
      tableName
    });
  },
  /**
   * Validates that the value is of type Null.
   */
  null: () => {
    return new import_validators.VNull({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   *
   * Alias for `v.float64()`
   */
  number: () => {
    return new import_validators.VFloat64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Float64 (Number in JS).
   */
  float64: () => {
    return new import_validators.VFloat64({ isOptional: "required" });
  },
  /**
   * @deprecated Use `v.int64()` instead
   */
  bigint: () => {
    return new import_validators.VInt64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Int64 (BigInt in JS).
   */
  int64: () => {
    return new import_validators.VInt64({ isOptional: "required" });
  },
  /**
   * Validates that the value is of type Boolean.
   */
  boolean: () => {
    return new import_validators.VBoolean({ isOptional: "required" });
  },
  /**
   * Validates that the value is of type String.
   */
  string: () => {
    return new import_validators.VString({ isOptional: "required" });
  },
  /**
   * Validates that the value is of Convex type Bytes (constructed in JS via `ArrayBuffer`).
   */
  bytes: () => {
    return new import_validators.VBytes({ isOptional: "required" });
  },
  /**
   * Validates that the value is equal to the given literal value.
   * @param literal The literal value to compare against.
   */
  literal: (literal) => {
    return new import_validators.VLiteral({ isOptional: "required", value: literal });
  },
  /**
   * Validates that the value is an Array of the given element type.
   * @param element The validator for the elements of the array.
   */
  array: (element) => {
    return new import_validators.VArray({ isOptional: "required", element });
  },
  /**
   * Validates that the value is an Object with the given properties.
   * @param fields An object specifying the validator for each property.
   */
  object: (fields) => {
    return new import_validators.VObject({ isOptional: "required", fields });
  },
  /**
   * Validates that the value is a Record with keys and values that match the given types.
   * @param keys The validator for the keys of the record. This cannot contain string literals.
   * @param values The validator for the values of the record.
   */
  record: (keys, values) => {
    return new import_validators.VRecord({
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
    return new import_validators.VUnion({
      isOptional: "required",
      members
    });
  },
  /**
   * Does not validate the value.
   */
  any: () => {
    return new import_validators.VAny({ isOptional: "required" });
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
