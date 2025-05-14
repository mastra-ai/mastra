import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { ShapeValue, StringCheckType } from '..';
import type { MastraLanguageModel } from '../../../agent';

export class OpenAIToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
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

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value);
      }
      case 'ZodString': {
        const model = this.getModel();
        const checks: StringCheckType[] = ['emoji'];

        if (model.modelId.includes('gpt-4o-mini')) {
          checks.push('regex');
        }
        return this.defaultZodStringHandler(value, checks);
      }
      default:
        return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodUndefined', 'ZodTuple']);
    }
  }
}
