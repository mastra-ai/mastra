import type { FieldConfig } from '@autoform/core';
import { getDef, getStringChecks, hasDateTimeCheck, getUnionOptions, getShape, getLiteralValue } from './compat';

export function inferFieldType(schema: any, fieldConfig?: FieldConfig): string {
  if (fieldConfig?.fieldType) {
    return fieldConfig.fieldType;
  }

  //starts with an underscore, so we want to pick from second character
  const constructorName = schema?.constructor?.name?.slice(1);
  const def = getDef(schema);
  const v4Type =
    typeof def?.type === 'string' ? `Zod${def.type.charAt(0).toUpperCase()}${def.type.slice(1)}` : undefined;
  const typeName = def?.typeName ?? v4Type ?? constructorName;

  if (typeName === 'ZodObject') return 'object';
  if (typeName === 'ZodIntersection') return 'object';
  if (typeName === 'ZodNumber') return 'number';
  if (typeName === 'ZodBoolean') return 'boolean';

  if (typeName === 'ZodString') {
    const checks = getStringChecks(schema);
    if (hasDateTimeCheck(checks)) return 'date';
    return 'string';
  }

  if (typeName === 'ZodEnum') return 'select';
  // ZodNativeEnum is not supported in zod@v4, this makes it backwards compatible with zod@v3
  if (typeName === 'ZodNativeEnum') return 'select';
  if (typeName === 'ZodArray') return 'array';
  if (typeName === 'ZodRecord') return 'record';

  if (typeName === 'ZodUnion') {
    const options = getUnionOptions(schema);
    if (options) {
      const hasLiteral = options.every((option: any) => {
        const optShape = getShape(option);
        if (optShape) {
          return Object.values(optShape).some((value: any) => {
            const vName = value?.constructor?.name?.slice(1);
            const vDef = getDef(value);
            return vName === 'ZodLiteral' || vDef?.typeName === 'ZodLiteral' || vDef?.type === 'literal';
          });
        }
        return false;
      });
      if (hasLiteral) {
        return 'discriminated-union';
      }
    }
    return 'union';
  }

  if (typeName === 'ZodDiscriminatedUnion') {
    return 'discriminated-union';
  }

  if (typeName === 'ZodLiteral') {
    const literalValue = getLiteralValue(schema);
    if (typeof literalValue === 'number') return 'number';
    if (typeof literalValue === 'boolean') return 'boolean';
    return 'string';
  }

  return 'string'; // Default to string for unknown types
}
