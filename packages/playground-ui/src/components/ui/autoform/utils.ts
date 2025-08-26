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
