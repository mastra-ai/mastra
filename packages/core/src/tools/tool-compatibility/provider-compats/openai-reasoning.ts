import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { ShapeValue } from '..';
import type { MastraLanguageModel } from '../../../agent';

export class OpenAIReasoningToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return `openApi3`;
  }

  isReasoningModel(): boolean {
    // there isn't a good way to automatically detect reasoning models besides doing this.
    // in the future when o5 is released this compat wont apply and we'll want to come back and update this class + our tests
    return this.getModel().modelId.includes(`o3`) || this.getModel().modelId.includes(`o4`);
  }

  shouldApply(): boolean {
    if (
      (this.getModel().supportsStructuredOutputs || this.isReasoningModel()) &&
      (this.getModel().provider.includes(`openai`) || this.getModel().modelId.includes(`openai`))
    ) {
      return true;
    }

    return false;
  }

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodOptional':
        return (value as z.ZodOptional<z.ZodTypeAny>).unwrap().nullable() as ShapeValue<T>;
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value);
      }
      case 'ZodDefault': {
        const defaultDef = (value as z.ZodDefault<any>)._def;
        const innerType = defaultDef.innerType;
        const defaultValue = defaultDef.defaultValue();
        const constraints: { defaultValue?: unknown } = {};
        if (defaultValue !== undefined) {
          constraints.defaultValue = defaultValue;
        }

        const description = this.mergeParameterDescription(value.description, constraints);
        let result = this.processZodType<T>(innerType);
        if (description) {
          result = result.describe(description);
        }
        return result;
      }
      case 'ZodNumber': {
        return this.defaultZodNumberHandler(value);
      }
      case 'ZodString': {
        return this.defaultZodStringHandler(value);
      }
      case 'ZodDate': {
        return this.defaultZodDateHandler(value);
      }
      default:
        return this.defaultUnsupportedZodTypeHandler(value);
    }
  }
}
