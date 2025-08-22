import { z } from 'zod';
import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';

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
    if (this.isOptional(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNumber',
        // @ts-expect-error - fix later
        ...this.getUnsupportedZodTypes(value),
      ]);
    } else if (this.isNull(value as ZodTypeV4)) {
      // Google models don't support null, so we need to convert it to any and then refine it to null
      return z
        .any()
        .refine(v => v === null, { message: 'must be null' })
        .describe(value.description || 'must be null');
    } else if (this.isObj(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodArrayHandler(value, []);
    } else if (this.isUnion(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodUnionHandler(value);
    } else if (this.isString(value as ZodTypeV4)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodStringHandler(value as ZodStringV4);
    } else if (this.isNumber(value as ZodTypeV4)) {
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      return this.defaultZodNumberHandler(value);
    }
    // @ts-expect-error - fix later
    return this.defaultUnsupportedZodTypeHandler(value);
  }
}
