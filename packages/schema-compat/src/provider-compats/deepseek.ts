import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer, isArr, isObj, isOptional, isString, isUnion } from '../schema-compatibility';

export class DeepSeekSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    // Deepseek R1 performs perfectly without this compat layer
    return this.getModel().modelId.includes('deepseek') && !this.getModel().modelId.includes('r1');
  }

  processZodType(value: ZodTypeAny): ZodTypeAny {
    if (isOptional(value)) {
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(value)) {
      return this.defaultZodArrayHandler(value, ['min', 'max']);
    } else if (isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(value)) {
      return this.defaultZodStringHandler(value);
    }

    return value;
  }
}
