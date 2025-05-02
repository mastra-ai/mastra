import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { SchemaConstraints, ShapeValue } from '..';
import type { MastraLanguageModel } from '../../../agent';

export class AnthropicToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude-3.5-haiku');
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
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, path, constraints, []);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value, path, constraints);
      }
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      case 'ZodString': {
        return this.defaultZodStringHandler(value, path, constraints, ['max', 'min']);
      }
      default:
        return value as ShapeValue<T>;
    }
  }
}
