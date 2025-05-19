import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { MastraLanguageModel } from '../../../agent';
import type { ShapeValue } from '../index';

export class DeepSeekToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('deepseek');
  }

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodOptional':
        return this.defaultZodOptionalHandler(value, ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodString', 'ZodNumber']);
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, ['min', 'max']);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value);
      }
      case 'ZodString': {
        return this.defaultZodStringHandler(value);
      }
      default:
        return value as ShapeValue<T>;
    }
  }
}
