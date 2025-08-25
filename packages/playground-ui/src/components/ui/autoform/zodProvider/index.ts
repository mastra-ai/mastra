import { ParsedField, ParsedSchema, SchemaValidation } from '@autoform/core';
import { getDefaultValueInZodStack, getFieldConfigInZodStack, ZodProvider } from '@autoform/zod/v4';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';
import { inferFieldType } from './field-type-inference';

function parseField(key: string, schema: z.ZodTypeAny): ParsedField {
  const baseSchema = getBaseSchema(schema);
  const fieldConfig = getFieldConfigInZodStack(schema);
  const type = inferFieldType(baseSchema, fieldConfig);
  const defaultValue = getDefaultValueInZodStack(schema);

  // Enums
  // @ts-expect-error - property entries exists in zod v4 Enums
  const options = baseSchema._zod.def?.entries;
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
  if (baseSchema instanceof zV3.ZodObject || baseSchema instanceof z.ZodObject) {
    subSchema = Object.entries(baseSchema.shape).map(([key, field]) => parseField(key, field as z.ZodTypeAny));
  }
  if (baseSchema instanceof zV3.ZodArray || baseSchema instanceof z.ZodArray) {
    // @ts-expect-error - property element exists in zod v4 Arrays
    subSchema = [parseField('0', baseSchema._zod.def.element)];
  }

  return {
    key,
    type,
    required: !schema.optional(),
    default: defaultValue,
    description: baseSchema.description,
    fieldConfig,
    options: optionValues,
    schema: subSchema,
  };
}

function getBaseSchema<ChildType extends z.ZodAny | z.ZodTypeAny = z.ZodAny>(schema: ChildType): ChildType {
  if ('innerType' in schema._zod.def) {
    return getBaseSchema(schema._zod.def.innerType as ChildType);
  }
  if ('schema' in schema._zod.def) {
    return getBaseSchema(schema._zod.def.schema as ChildType);
  }
  return schema as ChildType;
}

export function parseSchema(schema: z.ZodObject): ParsedSchema {
  const shape = schema.shape;

  const fields: ParsedField[] = Object.entries(shape).map(([key, field]) => parseField(key, field as z.ZodTypeAny));

  return { fields };
}

export class CustomZodProvider<T extends z.ZodObject> extends ZodProvider<T> {
  private _schema: T;
  constructor(schema: T) {
    super(schema);
    this._schema = schema;
  }

  validateSchema(values: z.core.output<T>): SchemaValidation {
    const result = super.validateSchema(values);
    return result;
  }

  parseSchema(): ParsedSchema {
    return parseSchema(this._schema);
  }
}
