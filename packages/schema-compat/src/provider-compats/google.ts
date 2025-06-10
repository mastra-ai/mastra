import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import {
  SchemaCompatLayer,
  UNSUPPORTED_ZOD_TYPES,
  isArr,
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
