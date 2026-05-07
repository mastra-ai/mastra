import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { Schema } from '../json-schema';
import { jsonSchema } from '../json-schema';
import {
  isAllOfSchema,
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isStringSchema,
  isUnionSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema } from '../schema.types';
import { standardSchemaToJSONSchema, toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isNullable, isNull, isObj, isArr, isUnion, isString, isNumber, isIntersection } from '../zodTypes';

/**
 * Recursively converts union type arrays (e.g., `type: ["string", "null"]`) to
 * Gemini-compatible format using `nullable: true`.
 *
 * Gemini's function calling API does not support union type arrays in JSON Schema.
 * This function converts patterns like `{ type: ["string", "null"] }` to
 * `{ type: "string", nullable: true }`.
 */
function fixNullableUnionTypes(schema: Record<string, any>): Record<string, any> {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  // Convert type arrays with "null" to single type + nullable: true
  if (Array.isArray(result.type)) {
    const nonNullTypes = result.type.filter((t: string) => t !== 'null');
    if (nonNullTypes.length < result.type.length) {
      // Has "null" in the type array
      result.nullable = true;
      if (nonNullTypes.length === 1) {
        result.type = nonNullTypes[0];
      } else if (nonNullTypes.length > 1) {
        result.type = nonNullTypes;
      } else {
        // Only "null" type — remove type entirely
        delete result.type;
      }
    }
  }

  // Convert anyOf nullable patterns directly to nullable: true
  if (result.anyOf && Array.isArray(result.anyOf) && result.anyOf.length === 2) {
    const nullSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type === 'null');
    const otherSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type !== 'null');

    if (nullSchema && otherSchema && typeof otherSchema === 'object') {
      const { anyOf: _, ...rest } = result;
      const fixedOther = fixNullableUnionTypes(otherSchema);
      return { ...rest, ...fixedOther, nullable: true };
    }
  }

  // Recursively fix properties
  if (result.properties && typeof result.properties === 'object') {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, fixNullableUnionTypes(value as any)]),
    );
  }

  // Recursively fix items
  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item: any) => fixNullableUnionTypes(item));
    } else {
      result.items = fixNullableUnionTypes(result.items);
    }
  }

  // Recursively fix additionalProperties (e.g., z.record() value schemas)
  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = fixNullableUnionTypes(result.additionalProperties);
  }

  // Recursively fix anyOf/oneOf/allOf
  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map((s: any) => fixNullableUnionTypes(s));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map((s: any) => fixNullableUnionTypes(s));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map((s: any) => fixNullableUnionTypes(s));
  }

  // Gemini requires anyOf to be the only field in the schema — strip all siblings
  if (result.anyOf && Array.isArray(result.anyOf)) {
    if (result.description) {
      for (const item of result.anyOf) {
        if (typeof item === 'object' && item !== null && !item.description) {
          item.description = result.description;
        }
      }
    }
    return { anyOf: result.anyOf };
  }

  return result;
}

export class GoogleSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return (
      this.getModel().provider.includes('google') ||
      this.getModel().modelId.includes('gemini-') ||
      this.getModel().modelId.includes('google')
    );
  }
  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNumber',
        'ZodNullable',
      ]);
    } else if (isNullable(z)(value)) {
      return this.defaultZodNullableHandler(value);
    } else if (isNull(z)(value)) {
      // Google models don't support null, so we need to convert it to any and then refine it to null
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodStringHandler(value);
    } else if (isNumber(z)(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodNumberHandler(value);
    } else if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }
    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>);
  }

  // public processToJSONSchema(zodSchema: PublicSchema<any>, io?: 'input' | 'output'): JSONSchema7 {
  //   const result = super.processToJSONSchema(zodSchema, io);
  //   // Fix union type arrays that Gemini doesn't support
  //   return fixNullableUnionTypes(result as Record<string, any>) as JSONSchema7;
  // }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    const compat = this.processToCompatSchema(zodSchema);
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);
    const fixedJsonSchema = fixNullableUnionTypes(transformedJsonSchema as Record<string, any>) as JSONSchema7;

    return jsonSchema(fixedJsonSchema, {
      validate: (value: unknown) => {
        const transformed = this.#traverse(value, fixedJsonSchema as Record<string, unknown>);
        const result = zodSchema.safeParse(transformed);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    });
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>): StandardSchemaWithJSON<T> {
    const originalStandardSchema = toStandardSchema(schema);

    return {
      '~standard': {
        version: 1,
        vendor: 'mastra',
        validate: (value: unknown) => {
          const transformedJsonSchema = this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          const transformed = this.#traverse(value, transformedJsonSchema);
          return originalStandardSchema['~standard'].validate(transformed);
        },
        jsonSchema: {
          input: () => {
            return this.processToJSONSchema(schema, 'input') as Record<string, unknown>;
          },
          output: () => {
            return this.processToJSONSchema(schema, 'output') as Record<string, unknown>;
          },
        },
      },
    };
  }

  preProcessJSONNode(schema: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    const resolved = this.#resolveAnyOf(schema);

    if (resolved['x-date'] === true && typeof value === 'string') {
      return new Date(value);
    }

    const isArrayType =
      resolved.type === 'array' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('array'));
    if (isArrayType) {
      if (!Array.isArray(value)) {
        return value;
      }
      return value.map(item => this.#traverse(item, resolved.items as Record<string, unknown>));
    }

    const isObjectType =
      resolved.type === 'object' || (Array.isArray(resolved.type) && (resolved.type as string[]).includes('object'));
    if (!isObjectType) {
      return value;
    }

    const properties = resolved.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties || !value) {
      return value;
    }

    const obj = value as Record<string, unknown>;
    for (const key in obj) {
      if (properties[key]) {
        obj[key] = this.#traverse(obj[key], properties[key]);
      }
    }

    return obj;
  }

  #resolveAnyOf(schema: Record<string, unknown>): Record<string, unknown> {
    if (Array.isArray(schema.anyOf)) {
      const nonNull = (schema.anyOf as Record<string, unknown>[]).find(s => s.type !== 'null');
      if (nonNull) {
        return nonNull;
      }
    }

    return schema;
  }
}
