import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { Schema } from '../json-schema';
import {
  isAllOfSchema,
  isArraySchema,
  isNumberSchema,
  isObjectSchema,
  isStringSchema,
  isUnionSchema,
  isEnumSchema,
} from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema } from '../schema.types';
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
    return this.getModel().provider.includes('google') || this.getModel().modelId.includes('google');
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

  public processToJSONSchema(zodSchema: PublicSchema<any>, io?: 'input' | 'output'): JSONSchema7 {
    const result = super.processToJSONSchema(zodSchema, io);
    // Fix union type arrays that Gemini doesn't support
    return fixNullableUnionTypes(result as Record<string, any>) as JSONSchema7;
  }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    const result = super.processToAISDKSchema(zodSchema);
    // Fix union type arrays that Gemini doesn't support
    const fixedJsonSchema = fixNullableUnionTypes(result.jsonSchema as Record<string, any>) as JSONSchema7;
    return { ...result, jsonSchema: fixedJsonSchema };
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isEnumSchema(schema)) {
      schema.type = 'string';
    }
  }

  postProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    // Fix v4-specific issues
    if (isObjectSchema(schema)) {
      if (
        schema.additionalProperties !== undefined &&
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null &&
        Object.keys(schema.additionalProperties).length === 0
      ) {
        schema.additionalProperties = true;
      }

      if ('propertyNames' in schema) {
        delete (schema as Record<string, unknown>).propertyNames;
      }
    }
  }
}
