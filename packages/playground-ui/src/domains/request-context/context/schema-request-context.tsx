import { usePlaygroundStore } from '@/store/playground-store';
import { createContext, useContext, useState, ReactNode } from 'react';

interface SchemaRequestContextState {
  /**
   * Current values from the schema-driven request context form.
   * These values are specific to the entity (agent/workflow) with a requestContextSchema.
   */
  schemaValues: Record<string, any>;

  /**
   * Update the schema values. Called by RequestContextSchemaForm when form values change.
   */
  setSchemaValues: (values: Record<string, any>) => void;

  /**
   * Clear the schema values. Called when navigating away from an entity with a schema.
   */
  clearSchemaValues: () => void;
}

export const SchemaRequestContext = createContext<SchemaRequestContextState | null>(null);

export function SchemaRequestContextProvider({ children }: { children: ReactNode }) {
  const { requestContext } = usePlaygroundStore();
  const [schemaValues, setSchemaValuesState] = useState<Record<string, any>>(requestContext);

  const setSchemaValues = (values: Record<string, any>) => setSchemaValuesState(values);

  const clearSchemaValues = () => {
    setSchemaValuesState({});
  };

  return (
    <SchemaRequestContext.Provider value={{ schemaValues, setSchemaValues, clearSchemaValues }}>
      {children}
    </SchemaRequestContext.Provider>
  );
}

/**
 * Hook to access schema-driven request context values.
 * Used by RequestContextSchemaForm to update values and by chat components to read them.
 */
export function useSchemaRequestContext() {
  const context = useContext(SchemaRequestContext);
  if (!context) {
    throw new Error('useSchemaRequestContext must be used within a SchemaRequestContextProvider');
  }
  return context;
}

/**
 * Hook to get merged request context (global store + schema form values).
 * Schema form values take precedence over global store values.
 * Works with or without SchemaRequestContextProvider.
 */
export function useMergedRequestContext() {
  const { requestContext: globalRequestContext } = usePlaygroundStore();
  const schemaContext = useContext(SchemaRequestContext);
  const schemaValues = schemaContext?.schemaValues ?? {};

  return {
    ...(globalRequestContext ?? {}),
    ...schemaValues,
  };
}
