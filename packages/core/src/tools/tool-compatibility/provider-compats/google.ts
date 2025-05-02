import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { ToolCompatibility } from '..';
import type { SchemaConstraints, ShapeValue } from '..';
import type { MastraLanguageModel } from '../../../agent';

export class GoogleToolCompat extends ToolCompatibility {
  constructor(model: MastraLanguageModel) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().provider.includes('google') || this.getModel().modelId.includes('google');
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
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      case 'ZodString': {
        return this.defaultZodStringHandler(value, path, constraints);
      }
      case 'ZodNumber': {
        // Google models support these properties but the model doesn't respect them, but it respects them when they're
        // added to the tool description
        return this.defaultZodNumberHandler(value, path, constraints);
      }
      default:
        return value as ShapeValue<T>;
    }
  }
}
