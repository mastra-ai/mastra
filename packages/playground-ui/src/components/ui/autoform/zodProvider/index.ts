import { ParsedField, ParsedSchema, SchemaValidation } from '@autoform/core';
import { getDefaultValueInZodStack, getFieldConfigInZodStack, ZodProvider, getDefaultValues } from '@autoform/zod/v4';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';
import { inferFieldType } from './field-type-inference';
import { get } from 'http';

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
  if (baseSchema instanceof zV3.ZodUnion || baseSchema instanceof z.ZodUnion) {
    subSchema = Object.entries((baseSchema.def as any).options).map(([key, field]: [string, unknown]) => {
      const parsedField = parseField(key, field as unknown as z.ZodTypeAny);

      // let fallbackDefault = undefined;
      // if (typeof defaultValue === 'object') {
      //   if (parsedField.type === 'object') {
      //     fallbackDefault =
      //       typeof defaultValue === 'object' && Object.keys(defaultValue).length > 0 ? defaultValue : undefined;
      //   } else if (parsedField.type === 'array') {
      //     fallbackDefault = Array.isArray(defaultValue) ? defaultValue : undefined;
      //   } else if (parsedField.type === 'date') {
      //     fallbackDefault = defaultValue instanceof Date ? defaultValue : undefined;
      //   }
      // } else {
      //   fallbackDefault = typeof defaultValue === parsedField.type ? defaultValue : undefined;
      // }

      return {
        ...parsedField,
        // default: parsedField.default ?? fallbackDefault,
      };
    });
  }
  if (baseSchema instanceof zV3.ZodIntersection || baseSchema instanceof z.ZodIntersection) {
    const subSchemaLeft = Object.entries((baseSchema.def as any).left.shape).map(([key, field]) =>
      parseField(key, field as z.ZodTypeAny),
    );
    const subSchemaRight = Object.entries((baseSchema.def as any).right.shape).map(([key, field]) =>
      parseField(key, field as z.ZodTypeAny),
    );
    subSchema = [...subSchemaLeft, ...subSchemaRight];
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

  console.log('fields==', fields);

  return { fields };
}

export class CustomZodProvider<T extends z.ZodObject> extends ZodProvider<T> {
  private _schema: T;
  constructor(schema: T) {
    super(schema);
    this._schema = schema;
  }

  // getDefaultValues(): z.core.output<T> {
  //   const defaultValues = super.getDefaultValues() as z.core.output<T>;
  //   const parsedSchema = this.parseSchema();

  //   return defaultValues;
  // }

  validateSchema(values: z.core.output<T>): SchemaValidation {
    const result = super.validateSchema(values);
    return result;
  }

  parseSchema(): ParsedSchema {
    return parseSchema(this._schema);
  }
}
