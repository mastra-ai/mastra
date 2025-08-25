import { FieldConfig } from '@autoform/core';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';

export function inferFieldType(schema: z.ZodTypeAny, fieldConfig?: FieldConfig): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  if (schema instanceof z.ZodObject) return 'object';
  if (schema instanceof z.ZodNumber) return 'number';
  if (schema instanceof z.ZodBoolean) return 'boolean';
  if (schema instanceof z.ZodString) {
    const checks = schema._zod.def.checks || [];
    const hasDateTimeCheck = checks.some(
      //@ts-expect-error - zod string_format check has format property
      check => check._zod.def.check === 'string_format' && check._zod.def.format === 'datetime',
    );
    if (hasDateTimeCheck) return 'date';
    return 'string';
  }
  if (schema instanceof z.ZodEnum) return 'select';
  //ZodNativeEnum is not supported in zod@v4, This makes is backwards compatible with zod@v3
  if (schema instanceof zV3.ZodNativeEnum) return 'select';
  if (schema instanceof z.ZodArray) return 'array';
  if (schema instanceof z.ZodRecord) return 'record';

  return 'string'; // Default to string for unknown types
}
