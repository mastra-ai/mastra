import { ParsedField, ParsedSchema } from '@autoform/core';
import { getDefaultValueInZodStack, getFieldConfigInZodStack, ZodObjectOrWrapped, ZodProvider } from '@autoform/zod';
import { z } from 'zod';
import { inferFieldType } from './field-type-inference';

// Extract number constraints from Zod schema
function extractNumberConstraints(schema: z.ZodTypeAny): { min?: number; max?: number; step?: number } {
  const constraints: { min?: number; max?: number; step?: number } = {};

  // Get the base schema
  let baseSchema = getBaseSchema(schema);

  // Extract min, max and step
  if (baseSchema._def && baseSchema._def.checks) {
    for (const check of baseSchema._def.checks) {
      if (check.kind === 'min' && check.inclusive) {
        constraints.min = check.value;
      } else if (check.kind === 'max' && check.inclusive) {
        constraints.max = check.value;
      } else if (check.kind === 'multipleOf') {
        constraints.step = check.value;
      }
    }
  }

  return constraints;
}

function parseField(key: string, schema: z.ZodTypeAny): ParsedField {
  const baseSchema = getBaseSchema(schema);
  let fieldConfig = getFieldConfigInZodStack(schema);
  const type = inferFieldType(baseSchema, fieldConfig);
  const defaultValue = getDefaultValueInZodStack(schema);

  // Extract number constraints for number fields
  if (type === 'number' && baseSchema instanceof z.ZodNumber) {
    const constraints = extractNumberConstraints(schema);
    if (Object.keys(constraints).length > 0) {
      if (!fieldConfig) {
        fieldConfig = {};
      }
      if (typeof fieldConfig === 'object') {
        fieldConfig.inputProps = { ...fieldConfig?.inputProps, ...constraints };
      }
    }
  }

  // Enums
  const options = baseSchema._def?.values;
  let optionValues: [string, string][] = [];
  if (options) {
    if (!Array.isArray(options)) {
      optionValues = Object.entries(options);
    } else {
      optionValues = options.map(value => [value, value]);
    }
  }

  // Arrays and objects
  let subSchema: ParsedField[] = [];
  if (baseSchema instanceof z.ZodObject) {
    subSchema = Object.entries(baseSchema.shape).map(([key, field]) => parseField(key, field as z.ZodTypeAny));
  }
  if (baseSchema instanceof z.ZodArray) {
    subSchema = [parseField('0', baseSchema._def.type)];
  }

  return {
    key,
    type,
    required: !schema.isOptional(),
    default: defaultValue,
    description: baseSchema.description,
    fieldConfig,
    options: optionValues,
    schema: subSchema,
  };
}

function getBaseSchema<ChildType extends z.ZodAny | z.ZodTypeAny | z.AnyZodObject = z.ZodAny>(
  schema: ChildType | z.ZodEffects<ChildType>,
): ChildType {
  if ('innerType' in schema._def) {
    return getBaseSchema(schema._def.innerType as ChildType);
  }
  if ('schema' in schema._def) {
    return getBaseSchema(schema._def.schema as ChildType);
  }
  return schema as ChildType;
}

export function parseSchema(schema: ZodObjectOrWrapped): ParsedSchema {
  const objectSchema = schema instanceof z.ZodEffects ? schema.innerType() : schema;
  const shape = objectSchema.shape;

  const fields: ParsedField[] = Object.entries(shape).map(([key, field]) => parseField(key, field as z.ZodTypeAny));

  return { fields };
}

export class CustomZodProvider<T extends ZodObjectOrWrapped> extends ZodProvider<T> {
  private _schema: T;
  constructor(schema: T) {
    super(schema);
    this._schema = schema;
  }

  parseSchema(): ParsedSchema {
    return parseSchema(this._schema);
  }
}
