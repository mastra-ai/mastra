import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { isArraySchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isString } from '../zodTypes';

export class DeepSeekSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    // Deepseek R1 performs perfectly without this compat layer
    return this.getModel().modelId.includes('deepseek') && !this.getModel().modelId.includes('r1');
  }

  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, ['min', 'max']);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      return this.defaultZodStringHandler(value);
    }

    return value;
  }

  preProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
    } else if (isArraySchema(schema)) {
      this.defaultArrayHandler(schema);
    } else if (isStringSchema(schema)) {
      this.defaultStringHandler(schema);
    }
  }

  postProcessJSONNode(schema: JSONSchema7, _parentSchema?: JSONSchema7): void {
    if (isUnionSchema(schema)) {
      this.defaultUnionHandler(schema);
    }

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
