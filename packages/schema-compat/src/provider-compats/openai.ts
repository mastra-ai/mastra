import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { isArraySchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isUnion, isArr, isString, isNullable, isDefault } from '../zodTypes';

export class OpenAISchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `jsonSchema7`;
  }

  shouldApply(): boolean {
    if (
      !this.getModel().supportsStructuredOutputs &&
      (this.getModel().provider.includes(`openai`) ||
        this.getModel().modelId.includes(`openai`) ||
        this.getModel().provider.includes(`groq`))
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

      if (model.modelId.includes('gpt-4o-mini')) {
        return this.defaultZodStringHandler(value, ['emoji', 'regex']);
      }

      return this.defaultZodStringHandler(value, checks);
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>, [
      'ZodNever',
      'ZodUndefined',
      'ZodTuple',
    ]);
  }

  /**
   * Override to fix additionalProperties: {} which OpenAI doesn't support.
   * Converts empty object {} to true to preserve passthrough intent.
   */
  processToJSONSchema(zodSchema: ZodTypeV3 | ZodTypeV4): JSONSchema7 {
    const jsonSchema = super.processToJSONSchema(zodSchema);
    return this.fixAdditionalProperties(jsonSchema);
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    // Process based on schema type
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      const model = this.getModel();
      // gpt-4o-mini doesn't respect emoji and regex constraints
      if (model.modelId.includes('gpt-4o-mini')) {
        // Remove emoji format if present
        if (schema.format === 'emoji') {
          delete schema.format;
        }
        // Remove pattern (regex) if present
        if (schema.pattern) {
          delete schema.pattern;
        }
      } else {
        // Other OpenAI models only have issues with emoji
        if (schema.format === 'emoji') {
          delete schema.format;
        }
      }
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    // Fix v4-specific issues in post-processing
    if (isObjectSchema(schema)) {
      // Fix passthrough objects: convert additionalProperties: {} to additionalProperties: true
      if (
        schema.additionalProperties !== undefined &&
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null &&
        Object.keys(schema.additionalProperties).length === 0
      ) {
        schema.additionalProperties = true;
      }

      // Fix record schemas: remove propertyNames (v4 adds this but it's not needed)
      if ('propertyNames' in schema) {
        delete (schema as Record<string, unknown>).propertyNames;
      }
    }
  }

  /**
   * Recursively fixes additionalProperties: {} to additionalProperties: true.
   * OpenAI requires additionalProperties to be either:
   * - false (no additional properties allowed)
   * - true (any additional properties allowed)
   * - an object with a "type" key (typed additional properties)
   * An empty object {} is NOT valid.
   */
  private fixAdditionalProperties(schema: JSONSchema7): JSONSchema7 {
    if (typeof schema !== 'object' || schema === null) {
      return schema;
    }

    const result = { ...schema };

    // Fix additionalProperties if it's an empty object
    if (
      result.additionalProperties !== undefined &&
      typeof result.additionalProperties === 'object' &&
      result.additionalProperties !== null &&
      !Array.isArray(result.additionalProperties) &&
      Object.keys(result.additionalProperties).length === 0
    ) {
      result.additionalProperties = true;
    }

    // Recursively fix nested properties
    if (result.properties) {
      result.properties = Object.fromEntries(
        Object.entries(result.properties).map(([key, value]) => [
          key,
          this.fixAdditionalProperties(value as JSONSchema7),
        ]),
      );
    }

    // Recursively fix items in arrays
    if (result.items) {
      if (Array.isArray(result.items)) {
        result.items = result.items.map(item => this.fixAdditionalProperties(item as JSONSchema7));
      } else {
        result.items = this.fixAdditionalProperties(result.items as JSONSchema7);
      }
    }

    // Recursively fix additionalProperties if it's an object schema (not empty)
    if (
      result.additionalProperties &&
      typeof result.additionalProperties === 'object' &&
      !Array.isArray(result.additionalProperties) &&
      Object.keys(result.additionalProperties).length > 0
    ) {
      result.additionalProperties = this.fixAdditionalProperties(result.additionalProperties as JSONSchema7);
    }

    return result;
  }
}
