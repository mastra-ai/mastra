import { FieldConfig } from '@autoform/core';
import { z } from 'zod';

export function inferFieldType(schema: z.ZodTypeAny, fieldConfig?: FieldConfig): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  if (schema instanceof z.ZodObject) return 'object';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodDate || (schema as any)?.isDatetime || (schema as any)?.isDate) return 'date';
  if (schema instanceof z.ZodString) return 'string';
  if (schema instanceof z.ZodEnum) return 'select';
  if (schema instanceof z.ZodNativeEnum) return 'select';
  if (schema instanceof z.ZodArray) return 'array';
  if (schema instanceof z.ZodRecord) return 'record';

  return 'string'; // Default to string for unknown types
}
