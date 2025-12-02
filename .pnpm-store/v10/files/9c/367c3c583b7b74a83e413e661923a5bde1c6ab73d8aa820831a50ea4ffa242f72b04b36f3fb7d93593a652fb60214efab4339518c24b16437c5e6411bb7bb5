// src/index.ts
import { z } from "zod";
function convertJsonSchemaToZod(schema) {
  function addMetadata(zodSchema, jsonSchema) {
    if (jsonSchema.description) {
      zodSchema = zodSchema.describe(jsonSchema.description);
    }
    return zodSchema;
  }
  if (schema.const !== void 0) {
    if (typeof schema.const === "string") {
      return addMetadata(z.literal(schema.const), schema);
    } else if (typeof schema.const === "number") {
      return addMetadata(z.literal(schema.const), schema);
    } else if (typeof schema.const === "boolean") {
      return addMetadata(z.literal(schema.const), schema);
    } else if (schema.const === null) {
      return addMetadata(z.null(), schema);
    }
    return addMetadata(z.literal(schema.const), schema);
  }
  if (schema.type) {
    switch (schema.type) {
      case "string": {
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(z.string(), schema);
          }
          return addMetadata(z.enum(schema.enum), schema);
        }
        let stringSchema = z.string();
        if (schema.minLength !== void 0) {
          stringSchema = stringSchema.min(schema.minLength);
        }
        if (schema.maxLength !== void 0) {
          stringSchema = stringSchema.max(schema.maxLength);
        }
        if (schema.pattern !== void 0) {
          const regex = new RegExp(schema.pattern);
          stringSchema = stringSchema.regex(regex);
        }
        return addMetadata(stringSchema, schema);
      }
      case "number":
      case "integer": {
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(z.number(), schema);
          }
          const options = schema.enum.map((val) => z.literal(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        let numberSchema = schema.type === "integer" ? z.number().int() : z.number();
        if (schema.minimum !== void 0) {
          numberSchema = numberSchema.min(schema.minimum);
        }
        if (schema.maximum !== void 0) {
          numberSchema = numberSchema.max(schema.maximum);
        }
        if (schema.exclusiveMinimum !== void 0) {
          numberSchema = numberSchema.gt(schema.exclusiveMinimum);
        }
        if (schema.exclusiveMaximum !== void 0) {
          numberSchema = numberSchema.lt(schema.exclusiveMaximum);
        }
        if (schema.multipleOf !== void 0) {
          numberSchema = numberSchema.multipleOf(schema.multipleOf);
        }
        return addMetadata(numberSchema, schema);
      }
      case "boolean":
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(z.boolean(), schema);
          }
          const options = schema.enum.map((val) => z.literal(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        return addMetadata(z.boolean(), schema);
      case "null":
        return addMetadata(z.null(), schema);
      case "object":
        if (schema.properties) {
          const shape = {};
          for (const [key, propSchema] of Object.entries(
            schema.properties
          )) {
            shape[key] = convertJsonSchemaToZod(propSchema);
          }
          if (schema.required && Array.isArray(schema.required)) {
            const required = new Set(schema.required);
            for (const key of Object.keys(shape)) {
              if (!required.has(key)) {
                shape[key] = shape[key].optional();
              }
            }
          } else {
            for (const key of Object.keys(shape)) {
              shape[key] = shape[key].optional();
            }
          }
          let zodSchema;
          if (schema.additionalProperties !== false) {
            zodSchema = z.object(shape).passthrough();
          } else {
            zodSchema = z.object(shape);
          }
          return addMetadata(zodSchema, schema);
        }
        return addMetadata(z.object({}), schema);
      case "array": {
        let arraySchema;
        if (schema.items) {
          arraySchema = z.array(convertJsonSchemaToZod(schema.items));
        } else {
          arraySchema = z.array(z.any());
        }
        if (schema.minItems !== void 0) {
          arraySchema = arraySchema.min(schema.minItems);
        }
        if (schema.maxItems !== void 0) {
          arraySchema = arraySchema.max(schema.maxItems);
        }
        if (schema.uniqueItems === true) {
          arraySchema = arraySchema.refine(
            (items) => {
              const seen = /* @__PURE__ */ new Set();
              return items.every((item) => {
                if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
                  if (seen.has(item)) return false;
                  seen.add(item);
                  return true;
                }
                const serialized = JSON.stringify(item);
                if (seen.has(serialized)) return false;
                seen.add(serialized);
                return true;
              });
            },
            { message: "Array items must be unique" }
          );
        }
        return addMetadata(arraySchema, schema);
      }
    }
  }
  if (schema.enum) {
    if (schema.enum.length === 0) {
      return addMetadata(z.never(), schema);
    }
    const allStrings = schema.enum.every((val) => typeof val === "string");
    if (allStrings) {
      return addMetadata(z.enum(schema.enum), schema);
    } else {
      const options = schema.enum.map((val) => z.literal(val));
      if (options.length === 1) {
        return addMetadata(options[0], schema);
      }
      if (options.length >= 2) {
        const unionSchema = z.union([options[0], options[1], ...options.slice(2)]);
        return addMetadata(unionSchema, schema);
      }
    }
  }
  if (schema.anyOf && schema.anyOf.length >= 2) {
    const schemas = schema.anyOf.map(convertJsonSchemaToZod);
    return addMetadata(
      z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  if (schema.allOf) {
    return addMetadata(
      schema.allOf.reduce(
        (acc, s) => z.intersection(acc, convertJsonSchemaToZod(s)),
        z.object({})
      ),
      schema
    );
  }
  if (schema.oneOf && schema.oneOf.length >= 2) {
    const schemas = schema.oneOf.map(convertJsonSchemaToZod);
    return addMetadata(
      z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  return addMetadata(z.any(), schema);
}
function jsonSchemaObjectToZodRawShape(schema) {
  var _a;
  let raw = {};
  for (const [key, value] of Object.entries((_a = schema.properties) != null ? _a : {})) {
    raw[key] = convertJsonSchemaToZod(value);
  }
  return raw;
}
export {
  convertJsonSchemaToZod,
  jsonSchemaObjectToZodRawShape
};
