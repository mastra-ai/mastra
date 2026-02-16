import * as React from 'react';
import type { SchemaField } from './types';

export interface JSONSchemaFormFieldContextValue {
  field: SchemaField;
  parentPath: string[];
  depth: number;
  update: (updates: Partial<SchemaField>) => void;
  remove: () => void;
}

const JSONSchemaFormFieldContext = React.createContext<JSONSchemaFormFieldContextValue | null>(null);

export function JSONSchemaFormFieldProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: JSONSchemaFormFieldContextValue;
}) {
  return <JSONSchemaFormFieldContext.Provider value={value}>{children}</JSONSchemaFormFieldContext.Provider>;
}

export function useJSONSchemaFormField(): JSONSchemaFormFieldContextValue {
  const context = React.useContext(JSONSchemaFormFieldContext);
  if (!context) {
    throw new Error('useJSONSchemaFormField must be used within a JSONSchemaForm.Field');
  }
  return context;
}
