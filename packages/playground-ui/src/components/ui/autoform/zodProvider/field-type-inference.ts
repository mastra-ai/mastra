import { FieldConfig } from '@autoform/core';
import { z } from 'zod';
import { z as zV3 } from 'zod/v3';

export function inferFieldType(schema: z.ZodTypeAny, fieldConfig?: FieldConfig): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  if (schema instanceof z.ZodObject) return 'object';
  if (schema instanceof z.ZodIntersection) return 'object';
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
  if (schema instanceof z.ZodUnion) {
    const options = schema._zod.def.options;
    const hasLiteral = options.every(option => {
      if ('shape' in option._zod.def) {
        return Object.values(option._zod.def.shape as Record<string, z.ZodTypeAny>).some(
          value => value instanceof z.ZodLiteral,
        );
      }
      return false;
    });
    if (hasLiteral) {
      return 'discriminated-union';
    }
    return 'union';
  }
  if (schema instanceof z.ZodDiscriminatedUnion) {
    return 'discriminated-union';
  }
  if (schema instanceof z.ZodLiteral) {
    // For literal types, infer the field type based on the literal value
    // Support both Zod v3 (_def.value) and Zod v4 (_zod.def.values)
    const v4Values = (schema as any)._zod?.def?.values;
    const v3Value = (schema as any)._def?.value;
    const literalValue = v4Values !== undefined ? (Array.isArray(v4Values) ? v4Values[0] : v4Values) : v3Value;
    if (typeof literalValue === 'number') return 'number';
    if (typeof literalValue === 'boolean') return 'boolean';
    return 'string';
  }

  return 'string'; // Default to string for unknown types
}
