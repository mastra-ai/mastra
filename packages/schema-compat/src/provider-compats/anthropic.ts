import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer  } from '../schema-compatibility';
import type {ModelInformation} from '../schema-compatibility';
import type { ZodType } from '../schema.types';
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

  processZodType(value: ZodType): ZodType {
    if (this.isOptional(value)) {
      const handleTypes: string[] = [
        'ZodObject',
        'ZodArray',
        'ZodUnion',
        'ZodNever',
        'ZodUndefined',
        'ZodTuple',
      ];
      if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
      return this.defaultZodOptionalHandler(value, handleTypes);
    } else if (this.isObj(value)) {
      return this.defaultZodObjectHandler(value);
    } else if (this.isArr(value)) {
      return this.defaultZodArrayHandler(value, []);
    } else if (this.isUnion(value)) {
      return this.defaultZodUnionHandler(value);
    } else if (this.isString(value)) {
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description

      if (this.getModel().modelId.includes('claude-3.5-haiku')) {
        return this.defaultZodStringHandler(value, ['max', 'min']);
      } else {
        return value;
      }
    }

    return this.defaultUnsupportedZodTypeHandler(value);
  }
}
