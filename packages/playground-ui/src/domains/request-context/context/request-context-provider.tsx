import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo } from 'react';
import { z } from 'zod/v4';

import { useLocalStorageState } from '@/hooks/use-local-storage-state';

export type RequestContextValues = Record<string, unknown>;

interface RequestContextState {
  /** Per-entity request context values sent with runs/chats/tool executions. */
  requestContext: RequestContextValues;
  setRequestContext: (values: RequestContextValues) => void;
  clearRequestContext: () => void;
}

const RequestContextContext = createContext<RequestContextState | null>(null);

const requestContextSchema = z.record(z.string(), z.unknown());

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export const getRequestContextStorageKey = (entityKey: string) => `mastra:request-context:${entityKey}`;

interface RequestContextProviderProps {
  /** Unique key of the entity owning this request context, e.g. `agent:weather-agent`. */
  entityKey: string;
  children: ReactNode;
}

// Storage key is read once on mount: mount with `key={entityKey}` so a new entity gets a fresh provider.
export function RequestContextProvider({ entityKey, children }: RequestContextProviderProps) {
  const [requestContext, setRequestContextState] = useLocalStorageState<RequestContextValues>({
    initialKey: getRequestContextStorageKey(entityKey),
    defaultValue: {},
    schema: requestContextSchema,
  });

  const setRequestContext = useCallback(
    (values: RequestContextValues) => setRequestContextState(values),
    [setRequestContextState],
  );
  const clearRequestContext = useCallback(() => setRequestContextState({}), [setRequestContextState]);

  const value = useMemo(
    () => ({ requestContext, setRequestContext, clearRequestContext }),
    [requestContext, setRequestContext, clearRequestContext],
  );

  return <RequestContextContext.Provider value={value}>{children}</RequestContextContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useRequestContext() {
  const context = useContext(RequestContextContext);
  if (!context) {
    throw new Error('useRequestContext must be used within a RequestContextProvider');
  }
  return context;
}

const EMPTY_REQUEST_CONTEXT: RequestContextValues = {};

/** Returns the current entity request context, or `{}` when rendered outside a provider. */
// eslint-disable-next-line react-refresh/only-export-components -- provider and its hook intentionally share this module
export function useOptionalRequestContext(): RequestContextValues {
  return useContext(RequestContextContext)?.requestContext ?? EMPTY_REQUEST_CONTEXT;
}
