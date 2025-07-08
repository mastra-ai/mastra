import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import {
  SchemaCompatLayer,
  UNSUPPORTED_ZOD_TYPES,
  isArr,
  isNull,
  isNumber,
  isObj,
  isOptional,
  isString,
  isUnion,
} from '../schema-compatibility';

export class GoogleSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().provider.includes('google') || this.getModel().modelId.includes('google');
  }

  processZodType(value: ZodTypeAny): ZodTypeAny {
    if (isOptional(value)) {
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNumber',
        ...UNSUPPORTED_ZOD_TYPES,
      ]);
    } else if (isNull(value)) {
      // Google models don't support null, so we need to convert it to any and then refine it to null
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value._def.description || 'must be null');
    } else if (isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodStringHandler(value);
    } else if (isNumber(value)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodNumberHandler(value);
    }
    return this.defaultUnsupportedZodTypeHandler(value);
  }
}
