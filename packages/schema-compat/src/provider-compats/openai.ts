import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer, isArr, isObj, isOptional, isString, isUnion } from '../schema-compatibility';
import type { StringCheckType } from '../schema-compatibility';

export class OpenAISchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
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

  processZodType(value: ZodTypeAny): ZodTypeAny {
    if (isOptional(value)) {
      return this.defaultZodOptionalHandler(value, [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodString',
        'ZodNever',
        'ZodUndefined',
        'ZodTuple',
      ]);
    } else if (isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isArr(value)) {
      return this.defaultZodArrayHandler(value);
    } else if (isString(value)) {
      const model = this.getModel();
      const checks: StringCheckType[] = ['emoji'];

      if (model.modelId.includes('gpt-4o-mini')) {
        checks.push('regex');
      }
      return this.defaultZodStringHandler(value, checks);
    }

    return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodUndefined', 'ZodTuple']);
  }
}
