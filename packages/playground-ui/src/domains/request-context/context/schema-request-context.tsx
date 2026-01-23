import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  const [schemaValues, setSchemaValuesState] = useState<Record<string, any>>({});

  const setSchemaValues = useCallback((values: Record<string, any>) => {
    setSchemaValuesState(values);
  }, []);

  const clearSchemaValues = useCallback(() => {
    setSchemaValuesState({});
  }, []);

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
 */
export function useMergedRequestContext(globalRequestContext: Record<string, any> | undefined) {
  const { schemaValues } = useSchemaRequestContext();

  // Merge global context with schema values (schema values take precedence)
  return {
    ...(globalRequestContext ?? {}),
    ...schemaValues,
  };
}
