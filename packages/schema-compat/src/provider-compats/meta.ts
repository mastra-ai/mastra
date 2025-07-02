import type { LanguageModelV1 } from 'ai';
import type { ZodTypeAny } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer, isArr, isNumber, isObj, isOptional, isString, isUnion } from '../schema-compatibility';

export class MetaSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('meta');
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
    } else if (isNumber(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString(value)) {
      return this.defaultZodStringHandler(value);
    }

    return value;
  }
}
