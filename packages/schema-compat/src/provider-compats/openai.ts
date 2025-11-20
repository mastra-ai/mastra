import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isUnion, isArr, isString, isNullable } from '../zodTypes';

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
      (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))
    ) {
      return true;
    }

    return false;
  }

  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      // For OpenAI strict mode, convert .optional().nullable() or .nullable().optional()
      // to just .nullable() so the field stays in the required array
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;

      if (innerType && isNullable(z)(innerType)) {
        // Inner type is nullable, so process it and return without re-applying optional
        // This converts .optional().nullable() -> .nullable()
        return this.processZodType(innerType);
      }

      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNever',
        'ZodUndefined',
        'ZodTuple',
        'ZodNullable', // Add ZodNullable to the list
      ]);
    } else if (isNullable(z)(value)) {
      // Process nullable: unwrap, process inner, and re-wrap with nullable
      const innerType = '_def' in value ? value._def.innerType : (value as any)._zod?.def?.innerType;
      if (innerType) {
        // Special case: if inner is optional, strip it for OpenAI strict mode
        // This converts .nullable().optional() -> .nullable()
        if (isOptional(z)(innerType)) {
          const innerInnerType =
            '_def' in innerType ? innerType._def.innerType : (innerType as any)._zod?.def?.innerType;
          if (innerInnerType) {
            const processedInnerInner = this.processZodType(innerInnerType);
            return (processedInnerInner as any).nullable();
          }
        }

        const processedInner = this.processZodType(innerType);
        return (processedInner as any).nullable();
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
}
