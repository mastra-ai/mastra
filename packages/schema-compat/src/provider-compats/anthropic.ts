import type { LanguageModelV1 } from 'ai';
import type { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import { SchemaCompatLayer } from '../schema-compatibility';
import type { ShapeValue, AllZodType } from '../schema-compatibility';

export class AnthropicSchemaCompatLayer extends SchemaCompatLayer {
  constructor(model: LanguageModelV1) {
    super(model);
  }

  getSchemaTarget(): Targets | undefined {
    return 'jsonSchema7';
  }

  shouldApply(): boolean {
    return this.getModel().modelId.includes('claude');
  }

  processZodType<T extends z.AnyZodObject>(value: z.ZodTypeAny): ShapeValue<T> {
    switch (value._def.typeName) {
      case 'ZodOptional':
        const handleTypes: AllZodType[] = ['ZodObject', 'ZodArray', 'ZodUnion', 'ZodNever', 'ZodUndefined'];
        if (this.getModel().modelId.includes('claude-3.5-haiku')) handleTypes.push('ZodString');
        if (this.getModel().modelId.includes('claude-3.7')) handleTypes.push('ZodTuple');

        return this.defaultZodOptionalHandler(value, handleTypes);
      case 'ZodObject': {
        return this.defaultZodObjectHandler(value);
      }
      case 'ZodArray': {
        return this.defaultZodArrayHandler(value, []);
      }
      case 'ZodUnion': {
        return this.defaultZodUnionHandler(value);
      }
      // the claude-3.5-haiku model support these properties but the model doesn't respect them, but it respects them when they're
      // added to the tool description
      case 'ZodString': {
        if (this.getModel().modelId.includes('claude-3.5-haiku')) {
          return this.defaultZodStringHandler(value, ['max', 'min']);
        } else {
          return value as ShapeValue<T>;
        }
      }
      default:
        if (this.getModel().modelId.includes('claude-3.7')) {
          return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodTuple', 'ZodUndefined']);
        } else {
          return this.defaultUnsupportedZodTypeHandler(value, ['ZodNever', 'ZodUndefined']);
        }
    }
  }
}
