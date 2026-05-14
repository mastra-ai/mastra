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

function fixAISDKNullableUnionTypes(schema: Record<string, any>): Record<string, any> {
  if (typeof schema !== 'object' || schema === null) {
    return schema;
  }

  const result = { ...schema };

  if (Array.isArray(result.type)) {
    const nonNullTypes = result.type.filter((t: string) => t !== 'null');
    if (nonNullTypes.length === 1) {
      result.type = nonNullTypes[0];
      result.nullable = true;
    } else {
      delete result.type;
      delete result.nullable;
    }
  }

  if (Array.isArray(result.enum) && result.enum.some((value: unknown) => typeof value !== 'string')) {
    delete result.enum;
  }

  if ('const' in result && typeof result.const !== 'string') {
    delete result.const;
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    const nullSchema = result.anyOf.find((s: any) => typeof s === 'object' && s !== null && s.type === 'null');
    const nonNullSchemas = result.anyOf.filter((s: any) => !(typeof s === 'object' && s !== null && s.type === 'null'));

    if (nullSchema) {
      const { anyOf: _, ...rest } = result;
      if (nonNullSchemas.length === 1 && typeof nonNullSchemas[0] === 'object' && nonNullSchemas[0] !== null) {
        const fixedOther = fixAISDKNullableUnionTypes(nonNullSchemas[0]);
        return fixedOther.type ? { ...rest, ...fixedOther, nullable: true } : { ...rest, ...fixedOther };
      }
      return rest;
    }
  }

  if (result.properties && typeof result.properties === 'object') {
    result.properties = Object.fromEntries(
      Object.entries(result.properties).map(([key, value]) => [key, fixAISDKNullableUnionTypes(value as any)]),
    );
  }

  if (result.items) {
    if (Array.isArray(result.items)) {
      result.items = result.items.map((item: any) => fixAISDKNullableUnionTypes(item));
    } else {
      result.items = fixAISDKNullableUnionTypes(result.items);
    }
  }

  if (result.additionalProperties && typeof result.additionalProperties === 'object') {
    result.additionalProperties = fixAISDKNullableUnionTypes(result.additionalProperties);
  }

  if (result.anyOf && Array.isArray(result.anyOf)) {
    result.anyOf = result.anyOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }
  if (result.oneOf && Array.isArray(result.oneOf)) {
    result.oneOf = result.oneOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }
  if (result.allOf && Array.isArray(result.allOf)) {
    result.allOf = result.allOf.map((s: any) => fixAISDKNullableUnionTypes(s));
  }

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

  public processToJSONSchema(schema: PublicSchema<any>, io?: 'input' | 'output'): JSONSchema7 {
    return super.processToJSONSchema(schema, io);
  }

  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    const compat = this.processToCompatSchema(zodSchema);
    const transformedJsonSchema = standardSchemaToJSONSchema(compat);
    const fixedJsonSchema = fixAISDKNullableUnionTypes(transformedJsonSchema as Record<string, any>) as JSONSchema7;

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
