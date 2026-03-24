import type { JSONSchema7 } from 'json-schema';
import traverse from 'json-schema-traverse';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import type { Schema } from '../json-schema';
import { jsonSchema } from '../json-schema';
import { isAllOfSchema, isArraySchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { PublicSchema, ZodType } from '../schema.types';
import { toStandardSchema } from '../standard-schema/standard-schema';
import type { StandardSchemaWithJSON } from '../standard-schema/standard-schema.types';
import { zodToJsonSchema } from '../zod-to-json';
import { isOptional, isObj, isUnion, isArr, isString, isNullable, isDefault, isIntersection } from '../zodTypes';

// @see https://developers.openai.com/api/docs/guides/structured-outputs#supported-schemas
const allowedStringFormats = [
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
] as const;

export class OpenAISchemaCompatLayer extends SchemaCompatLayer {
  getSchemaTarget(): Targets | undefined {
    return `jsonSchema7`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
    const modelId = this.getModel().modelId;
    if (!modelId) return false;
    return modelId.includes(`o3`) || modelId.includes(`o4`) || modelId.includes(`o1`);
  }

  shouldApply(): boolean {
    const model = this.getModel();
    if (
      !this.isReasoningModel() &&
      (model.provider.includes(`openai`) || model.modelId?.includes(`openai`) || model.provider.includes(`groq`))
    ) {
      return true;
    }

    return false;
  }

  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      // For OpenAI strict mode, convert .optional() to .nullable() with transform
      // This ensures all fields are in the required array but can accept null values
      // The transform converts null -> undefined to match original .optional() semantics
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;

      if (innerType) {
        // If inner is nullable, just process and return it with transform (strips the optional wrapper)
        // This converts .optional().nullable() -> .nullable() with transform
        if (isNullable(z)(innerType)) {
          const processed = this.processZodType(innerType);
          return processed.transform((val: any) => (val === null ? undefined : val));
        }

        // Otherwise, process inner, make it nullable, and add transform
        // This converts .optional() -> .nullable() with transform that converts null to undefined
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable().transform((val: any) => (val === null ? undefined : val));
      }

      return value;
    } else if (isNullable(z)(value)) {
      // Process nullable: unwrap, process inner, and re-wrap with nullable
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      if (innerType) {
        // Special case: if inner is optional, strip it and add transform for OpenAI strict mode
        // This converts .nullable().optional() -> .nullable() with transform
        if (isOptional(z)(innerType)) {
          const innerInnerType =
            '_def' in innerType ? innerType._def.innerType : (innerType as any)._zod?.def?.innerType;
          if (innerInnerType) {
            const processedInnerInner = this.processZodType(innerInnerType);
            return processedInnerInner.nullable().transform((val: any) => (val === null ? undefined : val));
          }
        }

        const processedInner = this.processZodType(innerType);
        return processedInner.nullable();
      }
      return value;
    } else if (isDefault(z)(value)) {
      // For OpenAI strict mode, convert .default() to .nullable() with transform
      // This ensures all fields are in the required array but can accept null values
      // The transform converts null -> default value to match original .default() semantics
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      const defaultValue = '_def' in value ? value._def.defaultValue : (value as any)._zod?.def?.defaultValue;

      if (innerType) {
        const processedInner = this.processZodType(innerType);
        // Transform null -> default value (call defaultValue() if it's a function)
        return processedInner.nullable().transform((val: any) => {
          if (val === null) {
            return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
          }
          return val;
        });
      }

      return value;
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isString(z)(value)) {
      const model = this.getModel();
      const checks = ['emoji'] as const;

      if (model.modelId?.includes('gpt-4o-mini')) {
        return this.defaultZodStringHandler(value, ['emoji', 'regex']);
      }

      return this.defaultZodStringHandler(value, checks);
    }

    if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>, [
      'ZodNever',
      'ZodUndefined',
      'ZodTuple',
    ]);
  }

  /**
   * Override to apply the same JSON Schema fixes (additionalProperties, required fields)
   * that processToJSONSchema applies. The base implementation skips JSON Schema traversal,
   * which causes OpenAI strict mode to reject tool schemas missing additionalProperties: false.
   */
  processToAISDKSchema(zodSchema: ZodTypeV3 | ZodTypeV4): Schema {
    // Convert to JSON Schema from the original Zod schema
    const jsonSchemaResult = zodToJsonSchema(zodSchema, this.getSchemaTarget());

    // Apply the same JSON Schema fixes as processToJSONSchema
    traverse(jsonSchemaResult, {
      cb: {
        pre: (schema: JSONSchema7) => {
          this.preProcessJSONNode(schema);
        },
        post: (schema: JSONSchema7) => {
          this.postProcessJSONNode(schema);
        },
      },
    });

    // Capture the traversed schema (with x-optional metadata) for #traverse
    const traversedJsonSchema = JSON.parse(JSON.stringify(jsonSchemaResult));

    // Post-process the raw LLM value: strip falsy optional fields and convert
    // date strings back to Date objects, then validate against the original Zod schema.
    return jsonSchema(jsonSchemaResult, {
      validate: (value: unknown) => {
        const transformed = this.#traverse(value, traversedJsonSchema);
        const result = zodSchema.safeParse(transformed);
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    });
  }

  public processToCompatSchema<T>(schema: PublicSchema<T>, io?: 'input' | 'output'): StandardSchemaWithJSON<T> {
    const originalStandardSchema = toStandardSchema(schema);

    // Get the OpenAI-transformed JSON Schema (with all properties required, etc.)
    const transformedJsonSchema = this.processToJSONSchema(schema, io);
    const transformedStandardSchema = toStandardSchema(transformedJsonSchema);

    return {
      '~standard': {
        ...transformedStandardSchema['~standard'],
        version: 1 as const,
        vendor: 'mastra',
        types: originalStandardSchema['~standard'].types,
        validate: (value: unknown) => {
          // Apply OpenAI-specific transforms: null→undefined for optional fields, date string→Date
          const transformed = this.#traverse(value, transformedJsonSchema as Record<string, unknown>);

          // Then validate against the original schema
          return originalStandardSchema['~standard'].validate(transformed);
        },
      },
    };
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
      if (schema.format) {
        if (!(allowedStringFormats as readonly string[]).includes(schema.format as string)) {
          delete schema.format;
          delete schema.pattern;
        }
      }

      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    if (schema.type === undefined && !schema.anyOf) {
      let subSchema: typeof schema = {};
      for (const key of Object.keys(schema)) {
        // @ts-expect-error - key is a valid property for JSON Schema
        subSchema[key] = schema[key];
        // @ts-expect-error - key is a valid property for JSON Schema
        delete schema[key];
      }

      schema.anyOf = [
        subSchema,
        {
          type: 'null',
        },
      ];
    }

    // Ensure bare {"type":"object"} nodes (e.g., inside anyOf) have additionalProperties: false.
    // OpenAI strict mode requires this on every object-type node, even without properties.
    if (isObjectSchema(schema)) {
      schema.additionalProperties = false;

      if (schema.properties) {
        for (const key of Object.keys(schema.properties)) {
          const prop = schema.properties[key] as JSONSchema7;

          if (!schema.required) {
            schema.required = [];
          }

          if (!schema.required?.includes(key)) {
            // @ts-expect-error - x-optional is a custom property
            schema['x-optional'] = [...(schema['x-optional'] || []), key];
            schema.required?.push(key);

            if (prop.type) {
              if (Array.isArray(prop.type)) {
                if (!prop.type.includes('null')) {
                  prop.type.push('null');
                }
              } else if (prop.type !== 'null') {
                prop.type = ['null', prop.type];
              }
            }
          }
        }
      }
    }
  }

  #traverse(value: unknown, schema: Record<string, unknown>): unknown {
    if (isDateFormat(schema)) {
      return new Date(value as string);
    }

    const isArrayType = schema.type === 'array' || (Array.isArray(schema.type) && schema.type.includes('array'));
    if (isArrayType) {
      const arr = value as unknown[];
      return arr.map(item => this.#traverse(item, schema.items as Record<string, unknown>));
    }

    const isObjectType = schema.type === 'object' || (Array.isArray(schema.type) && schema.type.includes('object'));
    if (!isObjectType) {
      return value;
    }

    const properties = schema.properties as Record<string, Record<string, unknown>> | undefined;
    if (!properties || !value) {
      return value;
    }

    const obj = value as Record<string, unknown>;
    const optionalProperties = (schema['x-optional'] ?? []) as string[];
    for (const key in obj) {
      if (optionalProperties.includes(key) && obj[key] === null) {
        obj[key] = undefined;
      } else if (properties[key]) {
        obj[key] = this.#traverse(obj[key], properties[key]);
      }
    }

    return obj;
  }
}

function isDateFormat(schema: Record<string, unknown>): boolean {
  return schema.format === 'date-time' || schema.format === 'date';
}
