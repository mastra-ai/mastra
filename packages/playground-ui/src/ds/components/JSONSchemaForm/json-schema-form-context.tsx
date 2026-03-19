import * as React from 'react';
import type { SchemaField } from './types';

export interface JSONSchemaFormContextValue {
  fields: SchemaField[];
  addField: (parentPath: string[]) => void;
  removeField: (parentPath: string[], fieldId: string) => void;
  updateField: (parentPath: string[], fieldId: string, updates: Partial<SchemaField>) => void;
  maxDepth: number;
}

const JSONSchemaFormContext = React.createContext<JSONSchemaFormContextValue | null>(null);

export function JSONSchemaFormProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: JSONSchemaFormContextValue;
}) {
  return <JSONSchemaFormContext.Provider value={value}>{children}</JSONSchemaFormContext.Provider>;
}

export function useJSONSchemaForm(): JSONSchemaFormContextValue {
  const context = React.useContext(JSONSchemaFormContext);
  if (!context) {
    throw new Error('useJSONSchemaForm must be used within a JSONSchemaForm.Root');
  }
  return context;
}
