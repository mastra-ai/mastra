/* eslint-disable react-refresh/only-export-components -- context and hooks intentionally co-located with their provider */
import { useLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { z } from 'zod/v4';

export type RequestContextEntityType = 'agent' | 'agent-tool' | 'workflow' | 'tool' | 'mcp-tool';

interface SchemaRequestContextState {
  /**
   * Request context values of the entity (agent/workflow/tool) this provider is scoped to.
   * Persisted in localStorage per entity.
   */
  schemaValues: Record<string, any>;

  setSchemaValues: (values: Record<string, any>) => void;

  clearSchemaValues: () => void;
}

export const SchemaRequestContext = createContext<SchemaRequestContextState | null>(null);

const requestContextSchema = z.record(z.string(), z.unknown());

interface SchemaRequestContextProviderProps {
  entityType: RequestContextEntityType;
  entityId: string;
  children: ReactNode;
}

export function SchemaRequestContextProvider({ entityType, entityId, children }: SchemaRequestContextProviderProps) {
  const storageKey = `mastra-request-context:${entityType}:${entityId}`;
  return (
    <SchemaRequestContextState key={storageKey} storageKey={storageKey}>
      {children}
    </SchemaRequestContextState>
  );
}

function SchemaRequestContextState({ storageKey, children }: { storageKey: string; children: ReactNode }) {
  const [schemaValues, setSchemaValues] = useLocalStorageState<Record<string, unknown>>({
    initialKey: storageKey,
    defaultValue: {},
    schema: requestContextSchema,
  });

  const clearSchemaValues = () => setSchemaValues({});

  return (
    <SchemaRequestContext.Provider value={{ schemaValues, setSchemaValues, clearSchemaValues }}>
      {children}
    </SchemaRequestContext.Provider>
  );
}

/**
 * Hook to access the entity-scoped request context values.
 * Used by RequestContextSchemaForm / RequestContext editor to update values.
 */
export function useSchemaRequestContext() {
  const context = useContext(SchemaRequestContext);
  if (!context) {
    throw new Error('useSchemaRequestContext must be used within a SchemaRequestContextProvider');
  }
  return context;
}

/**
 * Returns the request context of the enclosing entity, or `undefined` outside an entity scope.
 */
const EMPTY_REQUEST_CONTEXT: Record<string, any> = {};

export function useLocalRequestContext(): Record<string, any> {
  return useContext(SchemaRequestContext)?.schemaValues ?? EMPTY_REQUEST_CONTEXT;
}
