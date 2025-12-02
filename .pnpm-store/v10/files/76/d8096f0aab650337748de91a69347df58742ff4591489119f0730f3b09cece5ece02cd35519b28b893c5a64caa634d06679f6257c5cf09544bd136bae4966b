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

// src/index.ts
var index_exports = {};
__export(index_exports, {
  convertJsonSchemaToZod: () => convertJsonSchemaToZod,
  jsonSchemaObjectToZodRawShape: () => jsonSchemaObjectToZodRawShape
});
module.exports = __toCommonJS(index_exports);
var import_zod = require("zod");
function convertJsonSchemaToZod(schema) {
  function addMetadata(zodSchema, jsonSchema) {
    if (jsonSchema.description) {
      zodSchema = zodSchema.describe(jsonSchema.description);
    }
    return zodSchema;
  }
  if (schema.const !== void 0) {
    if (typeof schema.const === "string") {
      return addMetadata(import_zod.z.literal(schema.const), schema);
    } else if (typeof schema.const === "number") {
      return addMetadata(import_zod.z.literal(schema.const), schema);
    } else if (typeof schema.const === "boolean") {
      return addMetadata(import_zod.z.literal(schema.const), schema);
    } else if (schema.const === null) {
      return addMetadata(import_zod.z.null(), schema);
    }
    return addMetadata(import_zod.z.literal(schema.const), schema);
  }
  if (schema.type) {
    switch (schema.type) {
      case "string": {
        if (schema.enum) {
          if (schema.enum.length === 0) {
            return addMetadata(import_zod.z.string(), schema);
          }
          return addMetadata(import_zod.z.enum(schema.enum), schema);
        }
        let stringSchema = import_zod.z.string();
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
            return addMetadata(import_zod.z.number(), schema);
          }
          const options = schema.enum.map((val) => import_zod.z.literal(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = import_zod.z.union([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        let numberSchema = schema.type === "integer" ? import_zod.z.number().int() : import_zod.z.number();
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
            return addMetadata(import_zod.z.boolean(), schema);
          }
          const options = schema.enum.map((val) => import_zod.z.literal(val));
          if (options.length === 1) {
            return addMetadata(options[0], schema);
          }
          if (options.length >= 2) {
            const unionSchema = import_zod.z.union([options[0], options[1], ...options.slice(2)]);
            return addMetadata(unionSchema, schema);
          }
        }
        return addMetadata(import_zod.z.boolean(), schema);
      case "null":
        return addMetadata(import_zod.z.null(), schema);
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
            zodSchema = import_zod.z.object(shape).passthrough();
          } else {
            zodSchema = import_zod.z.object(shape);
          }
          return addMetadata(zodSchema, schema);
        }
        return addMetadata(import_zod.z.object({}), schema);
      case "array": {
        let arraySchema;
        if (schema.items) {
          arraySchema = import_zod.z.array(convertJsonSchemaToZod(schema.items));
        } else {
          arraySchema = import_zod.z.array(import_zod.z.any());
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
      return addMetadata(import_zod.z.never(), schema);
    }
    const allStrings = schema.enum.every((val) => typeof val === "string");
    if (allStrings) {
      return addMetadata(import_zod.z.enum(schema.enum), schema);
    } else {
      const options = schema.enum.map((val) => import_zod.z.literal(val));
      if (options.length === 1) {
        return addMetadata(options[0], schema);
      }
      if (options.length >= 2) {
        const unionSchema = import_zod.z.union([options[0], options[1], ...options.slice(2)]);
        return addMetadata(unionSchema, schema);
      }
    }
  }
  if (schema.anyOf && schema.anyOf.length >= 2) {
    const schemas = schema.anyOf.map(convertJsonSchemaToZod);
    return addMetadata(
      import_zod.z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  if (schema.allOf) {
    return addMetadata(
      schema.allOf.reduce(
        (acc, s) => import_zod.z.intersection(acc, convertJsonSchemaToZod(s)),
        import_zod.z.object({})
      ),
      schema
    );
  }
  if (schema.oneOf && schema.oneOf.length >= 2) {
    const schemas = schema.oneOf.map(convertJsonSchemaToZod);
    return addMetadata(
      import_zod.z.union([schemas[0], schemas[1], ...schemas.slice(2)]),
      schema
    );
  }
  return addMetadata(import_zod.z.any(), schema);
}
function jsonSchemaObjectToZodRawShape(schema) {
  var _a;
  let raw = {};
  for (const [key, value] of Object.entries((_a = schema.properties) != null ? _a : {})) {
    raw[key] = convertJsonSchemaToZod(value);
  }
  return raw;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convertJsonSchemaToZod,
  jsonSchemaObjectToZodRawShape
});
