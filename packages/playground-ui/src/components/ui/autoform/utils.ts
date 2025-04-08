import { buildZodFieldConfig } from '@autoform/react';
import { FieldTypes } from './AutoForm';

export const fieldConfig = buildZodFieldConfig<
  FieldTypes,
  {
    // Add types for `customData` here.
  }
>();
