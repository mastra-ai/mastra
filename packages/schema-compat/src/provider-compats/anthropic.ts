import { z } from 'zod';
import type { ZodType as ZodTypeV3, ZodObject as ZodObjectV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodObject as ZodObjectV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { AllZodType as AllZodTypeV3 } from '../schema-compatibility-v3';
import type { AllZodType as AllZodTypeV4 } from '../schema-compatibility-v4';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isString } from '../zodTypes';

export class AnthropicSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude');
  }

  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (isOptional(z)(value)) {
      const handleTypes: AllZodTypeV3[] | AllZodTypeV4 = [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodNever',
        'ZodUndefined',
        'ZodTuple',
      ];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(z)(value)) {
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description

      if (this.getModel().modelId.includes('claude-3.5-haiku')) {
        return this.defaultZodStringHandler(value, ['max', 'min']);
      } else {
        return value;
      }
    }

    return this.defaultUnsupportedZodTypeHandler(value as ZodObjectV4<any> | ZodObjectV3<any>, [
      'ZodNever',
      'ZodTuple',
      'ZodUndefined',
    ]);
  }
}
