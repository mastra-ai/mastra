import { buildZodFieldConfig } from '@autoform/react';
import { FieldTypes } from './AutoForm';
import { FieldConfig } from '@autoform/core';

// @ts-ignore
export const fieldConfig: FieldConfig = buildZodFieldConfig<
  FieldTypes,
  {
    // Add types for `customData` here.
  }
>();

export function removeEmptyValues<T extends Record<string, any>>(values: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in values) {
    const value = values[key];
    if ([null, undefined, '', [], {}].includes(value)) {
      continue;
    }

    if (Array.isArray(value)) {
      const newArray = value.map((item: any) => {
        if (typeof item === 'object') {
          const cleanedItem = removeEmptyValues(item);
          if (Object.keys(cleanedItem).length > 0) {
            return cleanedItem;
          }
          return null;
        }
        return item;
      });
      const filteredArray = newArray.filter((item: any) => item !== null);
      if (filteredArray.length > 0) {
        result[key] = filteredArray;
      }
    } else if (typeof value === 'object') {
      const cleanedValue = removeEmptyValues(value);
      if (Object.keys(cleanedValue).length > 0) {
        result[key] = cleanedValue as any;
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}
