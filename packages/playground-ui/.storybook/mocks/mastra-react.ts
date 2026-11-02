import { createContext, createElement, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

interface MastraReactProviderProps {
  children: ReactNode;
}

const client = {
  options: {
    baseUrl: 'http://localhost:4111',
    apiPrefix: '/api',
  },
};

const MockClientContext = createContext<object>(client);

export function MastraReactProvider({ children }: MastraReactProviderProps) {
  return children;
}

/** Lets a story hand components a fake client; `useMastraClient` returns it. */
export function MockMastraClientProvider({ client: fake, children }: { client: object; children: ReactNode }) {
  const value = useMemo(() => ({ ...client, ...fake }), [fake]);
  return createElement(MockClientContext.Provider, { value }, children);
}

export function useMastraClient() {
  return useContext(MockClientContext);
}
