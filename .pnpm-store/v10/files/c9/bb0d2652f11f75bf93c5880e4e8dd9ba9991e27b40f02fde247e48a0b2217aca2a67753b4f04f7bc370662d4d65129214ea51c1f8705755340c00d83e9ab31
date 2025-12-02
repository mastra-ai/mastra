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
var validator_helpers_exports = {};
__export(validator_helpers_exports, {
  parseValidator: () => parseValidator,
  validatorToType: () => validatorToType
});
module.exports = __toCommonJS(validator_helpers_exports);
var import_zod = require("zod");
var import_values = require("../../values/index.js");
var import_validator = require("../lib/deployApi/validator.js");
function parseValidator(validator) {
  if (!validator) {
    return null;
  }
  return import_zod.z.nullable(import_validator.convexValidator).parse(JSON.parse(validator));
}
function validatorToType(validator, useIdType) {
  if (validator.type === "null") {
    return "null";
  } else if (validator.type === "number") {
    return "number";
  } else if (validator.type === "bigint") {
    return "bigint";
  } else if (validator.type === "boolean") {
    return "boolean";
  } else if (validator.type === "string") {
    return "string";
  } else if (validator.type === "bytes") {
    return "ArrayBuffer";
  } else if (validator.type === "any") {
    return "any";
  } else if (validator.type === "literal") {
    const convexValue = (0, import_values.jsonToConvex)(validator.value);
    return convexValueToLiteral(convexValue);
  } else if (validator.type === "id") {
    return useIdType ? `Id<"${validator.tableName}">` : "string";
  } else if (validator.type === "array") {
    return `Array<${validatorToType(validator.value, useIdType)}>`;
  } else if (validator.type === "record") {
    return `Record<${validatorToType(validator.keys, useIdType)}, ${validatorToType(validator.values.fieldType, useIdType)}>`;
  } else if (validator.type === "union") {
    return validator.value.map((v) => validatorToType(v, useIdType)).join(" | ");
  } else if (validator.type === "object") {
    return objectValidatorToType(validator.value, useIdType);
  } else {
    throw new Error(`Unsupported validator type`);
  }
}
function objectValidatorToType(fields, useIdType) {
  const fieldStrings = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldType = validatorToType(field.fieldType, useIdType);
    fieldStrings.push(`${fieldName}${field.optional ? "?" : ""}: ${fieldType}`);
  }
  return `{ ${fieldStrings.join(", ")} }`;
}
function convexValueToLiteral(value) {
  if (value === null) {
    return "null";
  }
  if (typeof value === "bigint") {
    return `${value}n`;
  }
  if (typeof value === "number") {
    return `${value}`;
  }
  if (typeof value === "boolean") {
    return `${value}`;
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  throw new Error(`Unsupported literal type`);
}
//# sourceMappingURL=validator_helpers.js.map
