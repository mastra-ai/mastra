"use strict";
import { z } from "zod";
import { jsonToConvex } from "../../values/index.js";
import {
  convexValidator
} from "../lib/deployApi/validator.js";
export function parseValidator(validator) {
  if (!validator) {
    return null;
  }
  return z.nullable(convexValidator).parse(JSON.parse(validator));
}
export function validatorToType(validator, useIdType) {
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
    const convexValue = jsonToConvex(validator.value);
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
