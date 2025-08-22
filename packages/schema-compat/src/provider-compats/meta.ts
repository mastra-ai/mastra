import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';

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

  processZodType(value: ZodTypeV3): ZodTypeV3;
  processZodType(value: ZodTypeV4): ZodTypeV4;
  processZodType(value: ZodTypeV3 | ZodTypeV4): ZodTypeV3 | ZodTypeV4 {
    if (this.isOptional(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
    } else if (this.isObj(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodArrayHandler(value, ['min', 'max']);
    } else if (this.isUnion(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodUnionHandler(value);
    } else if (this.isNumber(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodNumberHandler(value);
    } else if (this.isString(value as ZodTypeV4)) {
      // @ts-expect-error - fix later
      return this.defaultZodStringHandler(value);
    }

    return value;
  }
}
