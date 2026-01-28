import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ZodType } from '../schema.types';
import type { ModelInformation } from '../types';
import { isOptional, isObj, isArr, isUnion, isNumber, isString } from '../zodTypes';

export class MetaSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: ModelInformation) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('meta');
  }

  processZodType(value: ZodType): ZodType {
    if (isOptional(z)(value)) {
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (isObj(z)(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (isArr(z)(value)) {
      return this.defaultZodArrayHandler(value, ['min', 'max']);
    } else if (isUnion(z)(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (isNumber(z)(value)) {
      return this.defaultZodNumberHandler(value);
    } else if (isString(z)(value)) {
      return this.defaultZodStringHandler(value);
    }

    return value;
  }
}
