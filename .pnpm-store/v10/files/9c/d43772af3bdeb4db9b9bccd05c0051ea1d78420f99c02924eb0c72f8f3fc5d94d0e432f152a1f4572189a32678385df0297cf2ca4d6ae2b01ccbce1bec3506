import { z } from "zod";
import { jsonToConvex, Value } from "../../values/index.js";
import {
  ConvexValidator,
  convexValidator,
} from "../lib/deployApi/validator.js";

export function parseValidator(
  validator: string | null,
): ConvexValidator | null {
  if (!validator) {
    return null;
  }
  return z.nullable(convexValidator).parse(JSON.parse(validator));
}

export function validatorToType(
  validator: ConvexValidator,
  useIdType: boolean,
): string {
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
    return validator.value
      .map((v) => validatorToType(v, useIdType))
      .join(" | ");
  } else if (validator.type === "object") {
    return objectValidatorToType(validator.value, useIdType);
  } else {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Unsupported validator type`);
  }
}

function objectValidatorToType(
  fields: Record<string, { fieldType: ConvexValidator; optional: boolean }>,
  useIdType: boolean,
): string {
  const fieldStrings: string[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    const fieldType = validatorToType(field.fieldType, useIdType);
    fieldStrings.push(`${fieldName}${field.optional ? "?" : ""}: ${fieldType}`);
  }
  return `{ ${fieldStrings.join(", ")} }`;
}

function convexValueToLiteral(value: Value): string {
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
  // eslint-disable-next-line no-restricted-syntax
  throw new Error(`Unsupported literal type`);
}
