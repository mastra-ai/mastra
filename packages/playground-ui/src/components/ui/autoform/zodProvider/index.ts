import { ParsedField, ParsedSchema, SchemaValidation } from '@autoform/core';
import { getFieldConfigInZodStack, ZodProvider } from '@autoform/zod/v4';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';
import { inferFieldType } from './field-type-inference';
import { getDefaultValues, getDefaultValueInZodStack } from './default-values';
import { removeEmptyValues } from '../utils';

function parseField(key: string, schema: z.ZodTypeAny): ParsedField {
  const baseSchema = getBaseSchema(schema);
  const fieldConfig = getFieldConfigInZodStack(schema);
  let type = inferFieldType(baseSchema, fieldConfig);
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
      return parseField(key, field as unknown as z.ZodTypeAny);
    });
  }
  if (baseSchema instanceof zV3.ZodIntersection || baseSchema instanceof z.ZodIntersection) {
    const leftSchema = 'left' in baseSchema.def ? baseSchema.def.left : null;
    const rightSchema = 'right' in baseSchema.def ? baseSchema.def.right : null;
    let subSchemaRight: ParsedField[] = [];
    let subSchemaLeft: ParsedField[] = [];
    if (leftSchema) {
      if ('shape' in leftSchema && leftSchema.shape) {
        subSchemaLeft = Object.entries(leftSchema.shape).map(([key, field]) => parseField(key, field as z.ZodTypeAny));
      } else {
        const leftChild = parseField(key, leftSchema as z.ZodTypeAny);
        subSchemaLeft = leftChild.schema ?? [leftChild];
        type = leftChild.type;
      }
    }
    if (rightSchema) {
      if ('shape' in rightSchema && rightSchema.shape) {
        subSchemaRight = Object.entries(rightSchema.shape).map(([key, field]) =>
          parseField(key, field as z.ZodTypeAny),
        );
      } else {
        const rightChild = parseField(key, rightSchema as z.ZodTypeAny);
        subSchemaRight = rightChild.schema ?? [rightChild];
        type = rightChild.type;
      }
    }
    subSchema = [...subSchemaLeft, ...subSchemaRight];
  }
  if (baseSchema instanceof zV3.ZodArray || baseSchema instanceof z.ZodArray) {
    // @ts-expect-error - property element exists in zod v4 Arrays
    subSchema = [parseField('0', baseSchema._zod.def.element)];
  }

  const isLiteral = baseSchema instanceof z.ZodLiteral;
  const literalValues = isLiteral ? baseSchema._zod.def.values : undefined;

  return {
    key,
    type,
    required: !schema.optional(),
    default: defaultValue,
    description: baseSchema.description,
    fieldConfig:
      isLiteral || Object.keys(fieldConfig ?? {})?.length > 0
        ? {
            ...fieldConfig,
            customData: {
              ...(fieldConfig?.customData ?? {}),
              ...(isLiteral ? { isLiteral, literalValues } : {}),
            },
          }
        : undefined,
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

  getDefaultValues(): z.core.output<T> {
    return getDefaultValues(this._schema) as z.core.output<T>;
  }

  validateSchema(values: z.core.output<T>): SchemaValidation {
    const cleanedValues = removeEmptyValues(values);
    const result = super.validateSchema(cleanedValues as z.core.output<T>);
    return result;
  }

  parseSchema(): ParsedSchema {
    return parseSchema(this._schema);
  }
}
