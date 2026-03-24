import type { JSONSchema7 } from 'json-schema';
import { z } from 'zod';
import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { isAllOfSchema, isArraySchema, isObjectSchema, isStringSchema, isUnionSchema } from '../json-schema/utils';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isString, isIntersection } from '../zodTypes';

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
    } else if (isIntersection(z)(value)) {
      return this.defaultZodIntersectionHandler(value);
    }

    return value;
  }

  preProcessJSONNode(schema: JSONSchema7): void {
    if (isAllOfSchema(schema)) {
      this.defaultAllOfHandler(schema);
    }

    if (isObjectSchema(schema)) {
      this.defaultObjectHandler(schema);
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
}
