import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { SchemaConstraints, ShapeValue, StringCheckType } from '..';
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

  processZodType<T extends z.AnyZodObject>(
    value: z.ZodTypeAny,
    path: string,
    constraints: SchemaConstraints,
  ): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value, path, constraints);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value, path, constraints);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, path, constraints, []);
      }
      case 'ZodString': {
        const model = this.getModel();
        const checks: StringCheckType[] = ['emoji'];
        if (model.modelId.includes('gpt-4o-mini')) {
          checks.push('regex');
        }
        return this.defaultZodStringHandler(value, path, constraints, checks);
      }
      default:
        return value as ShapeValue<T>;
    }
  }
}
