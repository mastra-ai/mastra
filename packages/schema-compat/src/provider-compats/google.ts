import type { LanguageModelV1 } from 'ai';
import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer, UNSUPPORTED_ZOD_TYPES } from '../schema-compatibility';
import type { ShapeValue } from '../schema-compatibility';

export class GoogleSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().provider.includes('google') || this.getModel().modelId.includes('google');
  }

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodOptional':
        return this.defaultZodOptionalHandler(value, [
          'ZodObject',
          'ZodArray',
          'ZodUnion',
          'ZodString',
          'ZodNumber',
          ...UNSUPPORTED_ZOD_TYPES,
        ]);
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, []);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value);
      }
      // Google models support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      case 'ZodString': {
        return this.defaultZodStringHandler(value);
      }
      case 'ZodNumber': {
        // Google models support these properties but the model doesn't respect them, but it respects them when they're
        // added to the tool description
        return this.defaultZodNumberHandler(value);
      }
      default:
        return this.defaultUnsupportedZodTypeHandler(value);
    }
  }
}
