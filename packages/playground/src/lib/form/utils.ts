import type { FieldConfig } from '@autoform/core';
import { buildZodFieldConfig } from '@autoform/react';
import type { FieldTypes } from './auto-form';

// @ts-expect-error - TODO
export const fieldConfig: FieldConfig = buildZodFieldConfig<
  FieldTypes,
  {
    // Add types for `customData` here.
  }
>();

function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

// Returns `undefined` when the value is considered empty and should be dropped.
function cleanValue(value: any): any {
  if (value === null || value === undefined || value === '') return undefined;

  if (Array.isArray(value)) {
    const cleaned = value.map(cleanValue).filter(item => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  if (isPlainObject(value)) {
    const cleaned = removeEmptyValues(value);
    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  // Primitives and non-plain objects (Date, File, Blob, Map, class instances) pass through untouched.
  return value;
}

export function removeEmptyValues<T extends Record<string, any>>(values: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in values) {
    const cleaned = cleanValue(values[key]);
    if (cleaned !== undefined) {
      result[key] = cleaned;
    }
  }

  return result;
}
