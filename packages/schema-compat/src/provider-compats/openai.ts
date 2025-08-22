import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4, ZodString as ZodStringV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';

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
    if (this.isOptional(value as ZodTypeV4)) {
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNever',
        'ZodUndefined',
        'ZodTuple',
      ]);
    } else if (this.isObj(value as ZodTypeV4)) {
      return this.defaultZodObjectHandler(value);
    } else if (this.isUnion(value as ZodTypeV4)) {
      return this.defaultZodUnionHandler(value);
    } else if (this.isArr(value as ZodTypeV4)) {
      return this.defaultZodArrayHandler(value);
    } else if (this.isString(value as ZodTypeV4)) {
      const model = this.getModel();
      const checks: string[] = ['emoji'];

      if (model.modelId.includes('gpt-4o-mini')) {
        checks.push('regex');
      }

      // @ts-expect-error - fix later
      return this.defaultZodStringHandler(value, checks);
    }

    // @ts-expect-error - fix later
    return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodUndefined', 'ZodTuple']);
  }
}
