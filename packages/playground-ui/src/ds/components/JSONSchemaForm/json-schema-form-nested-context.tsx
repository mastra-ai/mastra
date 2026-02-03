import * as React from 'react';
import type { SchemaField } from './types';

export interface JSONSchemaFormNestedContextValue {
  parentPath: string[];
  depth: number;
  fields: SchemaField[];
}

const JSONSchemaFormNestedContext = React.createContext<JSONSchemaFormNestedContextValue | null>(null);

export function JSONSchemaFormNestedProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: JSONSchemaFormNestedContextValue;
}) {
  return (
    <JSONSchemaFormNestedContext.Provider value={value}>
      {children}
    </JSONSchemaFormNestedContext.Provider>
  );
}

export function useJSONSchemaFormNestedContext(): JSONSchemaFormNestedContextValue | null {
  return React.useContext(JSONSchemaFormNestedContext);
}
