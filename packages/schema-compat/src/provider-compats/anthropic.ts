import type { ZodType as ZodTypeV3 } from 'zod/v3';
import type { ZodType as ZodTypeV4 } from 'zod/v4';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ModelInformation } from '../types';

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
    if (this.isOptional(value)) {
      const handleTypes = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodNever', 'ZodUndefined', 'ZodTuple'];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      // @ts-expect-error - fix later
      return this.defaultZodOptionalHandler(value, handleTypes);
      // @ts-expect-error - fix later
    } else if (this.isObj(value)) {
      // @ts-expect-error - fix later
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value)) {
      // @ts-expect-error - fix later
      return this.defaultZodArrayHandler(value, []);
      // @ts-expect-error - fix later
    } else if (this.isUnion(value)) {
      // @ts-expect-error - fix later
      return this.defaultZodUnionHandler(value);
      // @ts-expect-error - fix later
    } else if (this.isString(value)) {
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
