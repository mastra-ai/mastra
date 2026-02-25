import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { isArraySchema, isNumberSchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';
import {
  isOptional,
  isObj,
  isArr,
  isUnion,
  isDefault,
  isNumber,
  isString,
  isDate,
  isNullable,
  isNull,
} from '../zodTypes';

export class OpenAIReasoningSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
    return (
      this.getModel().modelId.includes(`o3`) ||
      this.getModel().modelId.includes(`o4`) ||
      this.getModel().modelId.includes(`o1`)
    );
  }

  shouldApply(): boolean {
    if (
      this.isReasoningModel() &&
      (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))
    ) {
      return true;
    }

    return false;
  }

  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      // For OpenAI reasoning models strict mode, convert .optional() to .nullable() with transform
      // The transform converts null -> undefined to match original .optional() semantics
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;

      if (innerType) {
        // If inner is nullable, just process and return it with transform (strips the optional wrapper)
        if (isNullable(z)(innerType)) {
          const processed = this.processZodType(innerType);
          return processed.transform((val: any) => (val === null ? undefined : val));
        }

        // Otherwise, process inner, make it nullable, and add transform
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable().transform((val: any) => (val === null ? undefined : val));
      }

      return value;
    } else if (isNullable(z)(value)) {
      // Handle nullable: if inner is optional, strip it and add transform
      // This converts .optional().nullable() -> .nullable() with transform
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      if (innerType && isOptional(z)(innerType)) {
        const innerInnerType = '_def' in innerType ? innerType._def.innerType : (innerType as any)._zod?.def?.innerType;
        if (innerInnerType) {
          const processedInnerInner = this.processZodType(innerInnerType);
          return processedInnerInner.nullable().transform((val: any) => (val === null ? undefined : val));
        }
      }
      // Otherwise process inner and re-wrap with nullable (no transform - intentionally nullable)
      if (innerType) {
        const processedInner = this.processZodType(innerType);
        return processedInner.nullable();
      }
      return value;
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value, { passthrough: false });
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isDefault(z)(value)) {
      const defaultDef = value._def;
      const innerType = defaultDef.innerType;
      // Handle both Zod v3 (function) and v4 (direct value)
      const defaultValue =
        typeof defaultDef.defaultValue === 'function' ? defaultDef.defaultValue() : defaultDef.defaultValue;
      const constraints: string[] = [];
      if (defaultValue !== undefined) {
        constraints.push(`the default value is ${defaultValue}`);
      }

      const description = this.mergeParameterDescription(value.description, constraints);
      let result = this.processZodType(innerType as ZodTypeV3 | ZodTypeV4);
      if (description) {
        result = result.describe(description);
      }
      return result;
    } else if (isNumber(z)(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString(z)(value)) {
      return this.defaultZodStringHandler(value);
    } else if (isDate(z)(value)) {
      return this.defaultZodDateHandler(value);
    } else if (isNull(z)(value)) {
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (value.constructor.name === 'ZodAny') {
      // It's bad practice in the tool to use any, it's not reasonable for models that don't support that OOTB, to cast every single possible type
      // in the schema. Usually when it's "any" it could be a json object or a union of specific types.
      return z
        .string()
        .describe(
          (value.description ?? '') +
            `\nArgument was an "any" type, but you (the LLM) do not support "any", so it was cast to a "string" type`,
        );
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>);
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    // Process based on schema type
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isNumberSchema(schema)) {
      this.defaultNumberHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7): void {
    // Handle union schemas in post-processing (after children are processed)
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

    // Fix v4-specific issues in post-processing
    if (isObjectSchema(schema)) {
      // OpenAI reasoning models don't support passthrough, but we still need to fix empty additionalProperties
      if (
        schema.additionalProperties !== undefined &&
        typeof schema.additionalProperties === 'object' &&
        schema.additionalProperties !== null &&
        Object.keys(schema.additionalProperties).length === 0
      ) {
        // For reasoning models, set to false (strict mode)
        schema.additionalProperties = false;
      }

      // Fix record schemas: remove propertyNames (v4 adds this but it's not needed)
      if ('propertyNames' in schema) {
        delete (schema as Record<string, unknown>).propertyNames;
      }
    }
  }
}
