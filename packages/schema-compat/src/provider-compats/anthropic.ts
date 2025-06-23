import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer, isArr, isObj, isOptional, isString, isUnion } from '../schema-compatibility';
import type { AllZodType } from '../schema-compatibility';

export class AnthropicSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude');
  }

  processZodType(value: ZodTypeAny): ZodTypeAny {
    if (isOptional(value)) {
      const handleTypes: AllZodType[] = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodNever', 'ZodUndefined', 'ZodTuple'];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isString(value)) {
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description

      if (this.getModel().modelId.includes('claude-3.5-haiku')) {
        return this.defaultZodStringHandler(value, ['max', 'min']);
      } else {
        return value;
      }
    }

    return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodTuple', 'ZodUndefined']);
  }
}
