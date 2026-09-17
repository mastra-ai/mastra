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

export function isPlainObject(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
