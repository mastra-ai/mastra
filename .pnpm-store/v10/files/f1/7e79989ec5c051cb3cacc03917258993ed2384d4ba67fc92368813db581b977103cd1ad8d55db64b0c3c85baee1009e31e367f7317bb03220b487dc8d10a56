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
  createUniqueItemsValidator: () => createUniqueItemsValidator,
  isValidWithSchema: () => isValidWithSchema,
  jsonSchemaObjectToZodRawShape: () => jsonSchemaObjectToZodRawShape
});
module.exports = __toCommonJS(index_exports);

// src/core/converter.ts
var import_v413 = require("zod/v4");

// src/handlers/primitive/type.ts
var import_v4 = require("zod/v4");
var TypeHandler = class {
  apply(types, schema) {
    if (!schema.type) return;
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const typeSet = new Set(allowedTypes);
    if (!typeSet.has("string")) {
      types.string = false;
    }
    if (!typeSet.has("number") && !typeSet.has("integer")) {
      types.number = false;
    }
    if (!typeSet.has("boolean")) {
      types.boolean = false;
    }
    if (!typeSet.has("null")) {
      types.null = false;
    }
    if (!typeSet.has("array")) {
      types.array = false;
    }
    if (!typeSet.has("object")) {
      types.object = false;
    }
    if (typeSet.has("integer") && types.number !== false) {
      const currentNumber = types.number || import_v4.z.number();
      if (currentNumber instanceof import_v4.z.ZodNumber) {
        types.number = currentNumber.int();
      }
    }
  }
};

// src/handlers/primitive/const.ts
var import_v42 = require("zod/v4");
var ConstHandler = class {
  apply(types, schema) {
    if (schema.const === void 0) return;
    const constValue = schema.const;
    types.string = false;
    types.number = false;
    types.boolean = false;
    types.null = false;
    types.array = false;
    types.object = false;
    if (typeof constValue === "string") {
      types.string = import_v42.z.literal(constValue);
    } else if (typeof constValue === "number") {
      types.number = import_v42.z.literal(constValue);
    } else if (typeof constValue === "boolean") {
      types.boolean = import_v42.z.literal(constValue);
    } else if (constValue === null) {
      types.null = import_v42.z.null();
    } else if (Array.isArray(constValue)) {
      types.array = void 0;
    } else if (typeof constValue === "object") {
      types.object = void 0;
    }
  }
};

// src/handlers/primitive/enum.ts
var import_v43 = require("zod/v4");
var EnumHandler = class {
  apply(types, schema) {
    if (!schema.enum) return;
    if (schema.enum.length === 0) {
      if (!schema.type) {
        types.string = false;
        types.number = false;
        types.boolean = false;
        types.null = false;
        types.array = false;
        types.object = false;
      }
      return;
    }
    const valuesByType = {
      string: schema.enum.filter((v) => typeof v === "string"),
      number: schema.enum.filter((v) => typeof v === "number"),
      boolean: schema.enum.filter((v) => typeof v === "boolean"),
      null: schema.enum.filter((v) => v === null),
      array: schema.enum.filter((v) => Array.isArray(v)),
      object: schema.enum.filter((v) => typeof v === "object" && v !== null && !Array.isArray(v))
    };
    types.string = this.createTypeSchema(valuesByType.string, "string");
    types.number = this.createTypeSchema(valuesByType.number, "number");
    types.boolean = this.createTypeSchema(valuesByType.boolean, "boolean");
    types.null = valuesByType.null.length > 0 ? import_v43.z.null() : false;
    types.array = valuesByType.array.length > 0 ? void 0 : false;
    types.object = valuesByType.object.length > 0 ? void 0 : false;
  }
  createTypeSchema(values, type) {
    if (values.length === 0) return false;
    if (values.length === 1) {
      return import_v43.z.literal(values[0]);
    }
    if (type === "string") {
      return import_v43.z.enum(values);
    }
    if (type === "number") {
      const [first, second, ...rest] = values;
      return import_v43.z.union([import_v43.z.literal(first), import_v43.z.literal(second), ...rest.map((v) => import_v43.z.literal(v))]);
    }
    if (type === "boolean") {
      return import_v43.z.union([import_v43.z.literal(true), import_v43.z.literal(false)]);
    }
    return false;
  }
};

// src/handlers/primitive/string.ts
var import_v44 = require("zod/v4");
var ImplicitStringHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (schema.type === void 0 && (stringSchema.minLength !== void 0 || stringSchema.maxLength !== void 0 || stringSchema.pattern !== void 0)) {
      if (types.string === void 0) {
        types.string = import_v44.z.string();
      }
    }
  }
};
var MinLengthHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (stringSchema.minLength === void 0) return;
    if (types.string !== false) {
      const currentString = types.string || import_v44.z.string();
      if (currentString instanceof import_v44.z.ZodString) {
        types.string = currentString.refine(
          (value) => {
            const graphemeLength = Array.from(value).length;
            return graphemeLength >= stringSchema.minLength;
          },
          { message: `String must be at least ${stringSchema.minLength} characters long` }
        );
      }
    }
  }
};
var MaxLengthHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (stringSchema.maxLength === void 0) return;
    if (types.string !== false) {
      const currentString = types.string || import_v44.z.string();
      if (currentString instanceof import_v44.z.ZodString) {
        types.string = currentString.refine(
          (value) => {
            const graphemeLength = Array.from(value).length;
            return graphemeLength <= stringSchema.maxLength;
          },
          { message: `String must be at most ${stringSchema.maxLength} characters long` }
        );
      }
    }
  }
};
var PatternHandler = class {
  apply(types, schema) {
    const stringSchema = schema;
    if (!stringSchema.pattern) return;
    if (types.string !== false) {
      const currentString = types.string || import_v44.z.string();
      if (currentString instanceof import_v44.z.ZodString) {
        const regex = new RegExp(stringSchema.pattern);
        types.string = currentString.regex(regex);
      }
    }
  }
};

// src/handlers/primitive/number.ts
var import_v45 = require("zod/v4");
var MinimumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.minimum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || import_v45.z.number();
      if (currentNumber instanceof import_v45.z.ZodNumber) {
        types.number = currentNumber.min(numberSchema.minimum);
      }
    }
  }
};
var MaximumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.maximum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || import_v45.z.number();
      if (currentNumber instanceof import_v45.z.ZodNumber) {
        types.number = currentNumber.max(numberSchema.maximum);
      }
    }
  }
};
var ExclusiveMinimumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.exclusiveMinimum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || import_v45.z.number();
      if (currentNumber instanceof import_v45.z.ZodNumber) {
        if (typeof numberSchema.exclusiveMinimum === "number") {
          types.number = currentNumber.gt(numberSchema.exclusiveMinimum);
        } else {
          types.number = false;
        }
      }
    }
  }
};
var ExclusiveMaximumHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.exclusiveMaximum === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || import_v45.z.number();
      if (currentNumber instanceof import_v45.z.ZodNumber) {
        if (typeof numberSchema.exclusiveMaximum === "number") {
          types.number = currentNumber.lt(numberSchema.exclusiveMaximum);
        } else {
          types.number = false;
        }
      }
    }
  }
};
var MultipleOfHandler = class {
  apply(types, schema) {
    const numberSchema = schema;
    if (numberSchema.multipleOf === void 0) return;
    if (types.number !== false) {
      const currentNumber = types.number || import_v45.z.number();
      if (currentNumber instanceof import_v45.z.ZodNumber) {
        types.number = currentNumber.refine(
          (value) => {
            if (numberSchema.multipleOf === 0) return false;
            const quotient = value / numberSchema.multipleOf;
            const rounded = Math.round(quotient);
            const tolerance = Math.min(
              Math.abs(value) * Number.EPSILON * 10,
              Math.abs(numberSchema.multipleOf) * Number.EPSILON * 10
            );
            return Math.abs(quotient - rounded) <= tolerance / Math.abs(numberSchema.multipleOf);
          },
          { message: `Must be a multiple of ${numberSchema.multipleOf}` }
        );
      }
    }
  }
};

// src/handlers/primitive/array.ts
var import_v46 = require("zod/v4");
var ImplicitArrayHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (schema.type === void 0 && (arraySchema.minItems !== void 0 || arraySchema.maxItems !== void 0 || arraySchema.items !== void 0 || arraySchema.prefixItems !== void 0)) {
      if (types.array === void 0) {
        types.array = import_v46.z.array(import_v46.z.any());
      }
    }
  }
};
var MinItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (arraySchema.minItems === void 0) return;
    if (types.array !== false) {
      types.array = (types.array || import_v46.z.array(import_v46.z.any())).min(arraySchema.minItems);
    }
  }
};
var MaxItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (arraySchema.maxItems === void 0) return;
    if (types.array !== false) {
      types.array = (types.array || import_v46.z.array(import_v46.z.any())).max(arraySchema.maxItems);
    }
  }
};
var ItemsHandler = class {
  apply(types, schema) {
    const arraySchema = schema;
    if (types.array === false) return;
    if (Array.isArray(arraySchema.items)) {
      types.array = types.array || import_v46.z.array(import_v46.z.any());
    } else if (arraySchema.items && typeof arraySchema.items !== "boolean" && !arraySchema.prefixItems) {
      const itemSchema = convertJsonSchemaToZod(arraySchema.items);
      let newArray = import_v46.z.array(itemSchema);
      if (types.array && types.array instanceof import_v46.z.ZodArray) {
        const existingDef = types.array._def;
        if (existingDef.checks) {
          existingDef.checks.forEach((check) => {
            if (check._zod && check._zod.def) {
              const def = check._zod.def;
              if (def.check === "min_length" && def.minimum !== void 0) {
                newArray = newArray.min(def.minimum);
              } else if (def.check === "max_length" && def.maximum !== void 0) {
                newArray = newArray.max(def.maximum);
              }
            }
          });
        }
      }
      types.array = newArray;
    } else if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
      if (!arraySchema.prefixItems) {
        types.array = import_v46.z.array(import_v46.z.any()).max(0);
      } else {
        types.array = types.array || import_v46.z.array(import_v46.z.any());
      }
    } else if (typeof arraySchema.items === "boolean" && arraySchema.items === true) {
      types.array = types.array || import_v46.z.array(import_v46.z.any());
    } else if (arraySchema.prefixItems) {
      types.array = types.array || import_v46.z.array(import_v46.z.any());
    }
  }
};

// src/handlers/primitive/tuple.ts
var import_v47 = require("zod/v4");
var TupleHandler = class {
  apply(types, schema) {
    if (schema.type !== "array") return;
    const arraySchema = schema;
    if (!Array.isArray(arraySchema.items)) return;
    if (types.array === false) return;
    const itemSchemas = arraySchema.items.map((itemSchema) => convertJsonSchemaToZod(itemSchema));
    let tuple;
    if (itemSchemas.length === 0) {
      tuple = import_v47.z.tuple([]);
    } else {
      tuple = import_v47.z.tuple(itemSchemas);
    }
    if (arraySchema.minItems !== void 0 && arraySchema.minItems > itemSchemas.length) {
      tuple = false;
    }
    if (arraySchema.maxItems !== void 0 && arraySchema.maxItems < itemSchemas.length) {
      tuple = false;
    }
    types.tuple = tuple;
    types.array = false;
  }
};

// src/handlers/primitive/object.ts
var import_v48 = require("zod/v4");
var PropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (types.object === false) return;
    if (objectSchema.properties || objectSchema.required || objectSchema.additionalProperties !== void 0) {
      types.object = types.object || import_v48.z.object({}).passthrough();
    }
  }
};
var ImplicitObjectHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (schema.type === void 0 && (objectSchema.maxProperties !== void 0 || objectSchema.minProperties !== void 0)) {
      if (types.object === void 0) {
        types.object = import_v48.z.object({}).passthrough();
      }
    }
  }
};
var MaxPropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (objectSchema.maxProperties === void 0) return;
    if (types.object !== false) {
      const baseObject = types.object || import_v48.z.object({}).passthrough();
      types.object = baseObject.refine(
        (obj) => Object.keys(obj).length <= objectSchema.maxProperties,
        { message: `Object must have at most ${objectSchema.maxProperties} properties` }
      );
    }
  }
};
var MinPropertiesHandler = class {
  apply(types, schema) {
    const objectSchema = schema;
    if (objectSchema.minProperties === void 0) return;
    if (types.object !== false) {
      const baseObject = types.object || import_v48.z.object({}).passthrough();
      types.object = baseObject.refine(
        (obj) => Object.keys(obj).length >= objectSchema.minProperties,
        { message: `Object must have at least ${objectSchema.minProperties} properties` }
      );
    }
  }
};

// src/core/utils.ts
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => keysB.includes(key) && deepEqual(a[key], b[key]));
  }
  return false;
}
function createUniqueItemsValidator() {
  return (value) => {
    if (!Array.isArray(value)) {
      return true;
    }
    const seen = [];
    return value.every((item) => {
      const isDuplicate = seen.some((seenItem) => deepEqual(item, seenItem));
      if (isDuplicate) {
        return false;
      }
      seen.push(item);
      return true;
    });
  };
}
function isValidWithSchema(schema, value) {
  return schema.safeParse(value).success;
}

// src/handlers/refinement/not.ts
var NotHandler = class {
  apply(zodSchema, schema) {
    if (!schema.not) return zodSchema;
    const notSchema = convertJsonSchemaToZod(schema.not);
    return zodSchema.refine(
      (value) => !isValidWithSchema(notSchema, value),
      { message: "Value must not match the 'not' schema" }
    );
  }
};

// src/handlers/refinement/uniqueItems.ts
var UniqueItemsHandler = class {
  apply(zodSchema, schema) {
    const arraySchema = schema;
    if (arraySchema.uniqueItems !== true) return zodSchema;
    return zodSchema.refine(createUniqueItemsValidator(), {
      message: "Array items must be unique"
    });
  }
};

// src/handlers/refinement/allOf.ts
var import_v49 = require("zod/v4");
var AllOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.allOf || schema.allOf.length === 0) return zodSchema;
    const allOfSchemas = schema.allOf.map((s) => convertJsonSchemaToZod(s));
    return allOfSchemas.reduce(
      (acc, s) => import_v49.z.intersection(acc, s),
      zodSchema
    );
  }
};

// src/handlers/refinement/anyOf.ts
var import_v410 = require("zod/v4");
var AnyOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.anyOf || schema.anyOf.length === 0) return zodSchema;
    const anyOfSchema = schema.anyOf.length === 1 ? convertJsonSchemaToZod(schema.anyOf[0]) : import_v410.z.union([
      convertJsonSchemaToZod(schema.anyOf[0]),
      convertJsonSchemaToZod(schema.anyOf[1]),
      ...schema.anyOf.slice(2).map((s) => convertJsonSchemaToZod(s))
    ]);
    return import_v410.z.intersection(zodSchema, anyOfSchema);
  }
};

// src/handlers/refinement/oneOf.ts
var OneOfHandler = class {
  apply(zodSchema, schema) {
    if (!schema.oneOf || schema.oneOf.length === 0) return zodSchema;
    const oneOfSchemas = schema.oneOf.map((s) => convertJsonSchemaToZod(s));
    return zodSchema.refine(
      (value) => {
        let validCount = 0;
        for (const oneOfSchema of oneOfSchemas) {
          const result = oneOfSchema.safeParse(value);
          if (result.success) {
            validCount++;
            if (validCount > 1) return false;
          }
        }
        return validCount === 1;
      },
      { message: "Value must match exactly one of the oneOf schemas" }
    );
  }
};

// src/handlers/refinement/arrayItems.ts
var PrefixItemsHandler = class {
  apply(zodSchema, schema) {
    const arraySchema = schema;
    if (arraySchema.prefixItems && Array.isArray(arraySchema.prefixItems)) {
      const prefixItems = arraySchema.prefixItems;
      const prefixSchemas = prefixItems.map((itemSchema) => convertJsonSchemaToZod(itemSchema));
      return zodSchema.refine(
        (value) => {
          if (!Array.isArray(value)) return true;
          for (let i = 0; i < Math.min(value.length, prefixSchemas.length); i++) {
            if (!isValidWithSchema(prefixSchemas[i], value[i])) {
              return false;
            }
          }
          if (value.length > prefixSchemas.length) {
            if (typeof arraySchema.items === "boolean" && arraySchema.items === false) {
              return false;
            } else if (arraySchema.items && typeof arraySchema.items === "object" && !Array.isArray(arraySchema.items)) {
              const additionalItemSchema = convertJsonSchemaToZod(arraySchema.items);
              for (let i = prefixSchemas.length; i < value.length; i++) {
                if (!isValidWithSchema(additionalItemSchema, value[i])) {
                  return false;
                }
              }
            }
          }
          return true;
        },
        { message: "Array does not match prefixItems schema" }
      );
    }
    return zodSchema;
  }
};

// src/handlers/refinement/objectProperties.ts
var import_v411 = require("zod/v4");
var ObjectPropertiesHandler = class {
  apply(zodSchema, schema) {
    const objectSchema = schema;
    if (!objectSchema.properties && !objectSchema.required && objectSchema.additionalProperties !== false) {
      return zodSchema;
    }
    if (zodSchema instanceof import_v411.z.ZodObject || zodSchema instanceof import_v411.z.ZodRecord) {
      const shape = {};
      if (objectSchema.properties) {
        for (const [key, propSchema] of Object.entries(objectSchema.properties)) {
          if (propSchema !== void 0) {
            shape[key] = convertJsonSchemaToZod(propSchema);
          }
        }
      }
      if (objectSchema.required && Array.isArray(objectSchema.required)) {
        const required = new Set(objectSchema.required);
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
      if (objectSchema.additionalProperties === false) {
        return import_v411.z.object(shape);
      } else {
        return import_v411.z.object(shape).passthrough();
      }
    }
    return zodSchema.refine(
      (value) => {
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return true;
        }
        if (objectSchema.properties) {
          for (const [propName, propSchema] of Object.entries(objectSchema.properties)) {
            if (propSchema !== void 0) {
              const propExists = Object.getOwnPropertyDescriptor(value, propName) !== void 0;
              if (propExists) {
                const zodPropSchema = convertJsonSchemaToZod(propSchema);
                const propResult = zodPropSchema.safeParse(value[propName]);
                if (!propResult.success) {
                  return false;
                }
              }
            }
          }
        }
        if (objectSchema.required && Array.isArray(objectSchema.required)) {
          for (const requiredProp of objectSchema.required) {
            const propExists = Object.getOwnPropertyDescriptor(value, requiredProp) !== void 0;
            if (!propExists) {
              return false;
            }
          }
        }
        if (objectSchema.additionalProperties === false && objectSchema.properties) {
          const allowedProps = new Set(Object.keys(objectSchema.properties));
          for (const prop in value) {
            if (!allowedProps.has(prop)) {
              return false;
            }
          }
        }
        return true;
      },
      { message: "Object constraints validation failed" }
    );
  }
};

// src/handlers/refinement/enumComplex.ts
var EnumComplexHandler = class {
  apply(zodSchema, schema) {
    if (!schema.enum || schema.enum.length === 0) return zodSchema;
    const complexValues = schema.enum.filter(
      (v) => Array.isArray(v) || typeof v === "object" && v !== null
    );
    if (complexValues.length === 0) return zodSchema;
    return zodSchema.refine(
      (value) => {
        if (typeof value !== "object" || value === null) return true;
        return complexValues.some(
          (enumValue) => deepEqual(value, enumValue)
        );
      },
      { message: "Value must match one of the enum values" }
    );
  }
};

// src/handlers/refinement/constComplex.ts
var ConstComplexHandler = class {
  apply(zodSchema, schema) {
    if (schema.const === void 0) return zodSchema;
    const constValue = schema.const;
    if (typeof constValue !== "object" || constValue === null) {
      return zodSchema;
    }
    return zodSchema.refine(
      (value) => deepEqual(value, constValue),
      { message: "Value must equal the const value" }
    );
  }
};

// src/handlers/refinement/metadata.ts
var MetadataHandler = class {
  apply(zodSchema, schema) {
    if (schema.description) {
      zodSchema = zodSchema.describe(schema.description);
    }
    return zodSchema;
  }
};

// src/handlers/refinement/protoRequired.ts
var import_v412 = require("zod/v4");
var ProtoRequiredHandler = class {
  apply(zodSchema, schema) {
    var _a;
    const objectSchema = schema;
    if (!((_a = objectSchema.required) == null ? void 0 : _a.includes("__proto__")) || schema.type !== void 0) {
      return zodSchema;
    }
    return import_v412.z.any().refine(
      (value) => this.validateRequired(value, objectSchema.required),
      { message: "Missing required properties" }
    );
  }
  validateRequired(value, required) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return true;
    }
    return required.every(
      (prop) => Object.prototype.hasOwnProperty.call(value, prop)
    );
  }
};

// src/handlers/refinement/contains.ts
var ContainsHandler = class {
  apply(zodSchema, schema) {
    var _a;
    const arraySchema = schema;
    if (arraySchema.contains === void 0) return zodSchema;
    const containsSchema = convertJsonSchemaToZod(arraySchema.contains);
    const minContains = (_a = arraySchema.minContains) != null ? _a : 1;
    const maxContains = arraySchema.maxContains;
    return zodSchema.refine(
      (value) => {
        if (!Array.isArray(value)) {
          return true;
        }
        let matchCount = 0;
        for (const item of value) {
          if (isValidWithSchema(containsSchema, item)) {
            matchCount++;
          }
        }
        if (matchCount < minContains) {
          return false;
        }
        if (maxContains !== void 0 && matchCount > maxContains) {
          return false;
        }
        return true;
      },
      { message: "Array must contain required items matching the schema" }
    );
  }
};

// src/core/converter.ts
var primitiveHandlers = [
  // Type constraints - should run first
  new ConstHandler(),
  new EnumHandler(),
  new TypeHandler(),
  // Implicit type detection - must run before other constraints
  new ImplicitStringHandler(),
  new ImplicitArrayHandler(),
  new ImplicitObjectHandler(),
  // String constraints
  new MinLengthHandler(),
  new MaxLengthHandler(),
  new PatternHandler(),
  // Number constraints
  new MinimumHandler(),
  new MaximumHandler(),
  new ExclusiveMinimumHandler(),
  new ExclusiveMaximumHandler(),
  new MultipleOfHandler(),
  // Array constraints - TupleHandler must run before ItemsHandler
  new TupleHandler(),
  new MinItemsHandler(),
  new MaxItemsHandler(),
  new ItemsHandler(),
  // Object constraints
  new MaxPropertiesHandler(),
  new MinPropertiesHandler(),
  new PropertiesHandler()
];
var refinementHandlers = [
  // Handle special cases first
  new ProtoRequiredHandler(),
  new EnumComplexHandler(),
  new ConstComplexHandler(),
  // Logical combinations
  new AllOfHandler(),
  new AnyOfHandler(),
  new OneOfHandler(),
  // Type-specific refinements
  new PrefixItemsHandler(),
  new ObjectPropertiesHandler(),
  // Array refinements
  new ContainsHandler(),
  // Other refinements
  new NotHandler(),
  new UniqueItemsHandler(),
  // Metadata last
  new MetadataHandler()
];
function convertJsonSchemaToZod(schema) {
  if (typeof schema === "boolean") {
    return schema ? import_v413.z.any() : import_v413.z.never();
  }
  const types = {};
  for (const handler of primitiveHandlers) {
    handler.apply(types, schema);
  }
  const allowedSchemas = [];
  if (types.string !== false) {
    allowedSchemas.push(types.string || import_v413.z.string());
  }
  if (types.number !== false) {
    allowedSchemas.push(types.number || import_v413.z.number());
  }
  if (types.boolean !== false) {
    allowedSchemas.push(types.boolean || import_v413.z.boolean());
  }
  if (types.null !== false) {
    allowedSchemas.push(types.null || import_v413.z.null());
  }
  if (types.array !== false) {
    allowedSchemas.push(types.array || import_v413.z.array(import_v413.z.any()));
  }
  if (types.tuple !== false && types.tuple !== void 0) {
    allowedSchemas.push(types.tuple);
  }
  if (types.object !== false) {
    if (types.object) {
      allowedSchemas.push(types.object);
    } else {
      const objectSchema = import_v413.z.custom((val) => {
        return typeof val === "object" && val !== null && !Array.isArray(val);
      }, "Must be an object, not an array");
      allowedSchemas.push(objectSchema);
    }
  }
  let zodSchema;
  if (allowedSchemas.length === 0) {
    zodSchema = import_v413.z.never();
  } else if (allowedSchemas.length === 1) {
    zodSchema = allowedSchemas[0];
  } else {
    const hasConstraints = Object.keys(schema).some(
      (key) => key !== "$schema" && key !== "title" && key !== "description"
    );
    if (!hasConstraints) {
      zodSchema = import_v413.z.any();
    } else {
      zodSchema = import_v413.z.union(allowedSchemas);
    }
  }
  for (const handler of refinementHandlers) {
    zodSchema = handler.apply(zodSchema, schema);
  }
  return zodSchema;
}

// src/index.ts
function jsonSchemaObjectToZodRawShape(schema) {
  var _a;
  const raw = {};
  const requiredArray = Array.isArray(schema.required) ? schema.required : [];
  const requiredFields = new Set(requiredArray);
  for (const [key, value] of Object.entries((_a = schema.properties) != null ? _a : {})) {
    if (value === void 0) continue;
    let zodType = convertJsonSchemaToZod(value);
    if (requiredArray.length > 0) {
      if (!requiredFields.has(key)) {
        zodType = zodType.optional();
      }
    } else {
      zodType = zodType.optional();
    }
    raw[key] = zodType;
  }
  return raw;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  convertJsonSchemaToZod,
  createUniqueItemsValidator,
  isValidWithSchema,
  jsonSchemaObjectToZodRawShape
});
