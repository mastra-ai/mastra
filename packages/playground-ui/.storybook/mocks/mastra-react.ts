import { MastraClient } from '@mastra/client-js';
import type { MastraReactProvider as RealMastraReactProvider } from '@mastra/react';
// Aliased in main.ts to the real `@mastra/react`, which this mock otherwise stands in for.
// @ts-expect-error -- not a published subpath; only the Storybook alias resolves it.
import { MastraReactProvider as RealProvider } from '@mastra/react/provider';
import type { ReactNode } from 'react';
import { createContext, createElement, useContext, useMemo } from 'react';

interface MastraReactProviderProps {
  children: ReactNode;
  baseUrl?: string;
  /**
   * A story's own network. Given one, hooks get a real client that sends every request through it,
   * both this mock's `useMastraClient` and the real `@mastra/react/hooks/*`.
   */
  customFetch?: typeof fetch;
}

const stub = {
  options: {
    baseUrl: 'http://localhost:4111',
    apiPrefix: '/api',
  },
};

const ClientContext = createContext<unknown>(stub);

const Real: typeof RealMastraReactProvider = RealProvider;

export function MastraReactProvider({
  children,
  baseUrl = stub.options.baseUrl,
  customFetch,
}: MastraReactProviderProps) {
  const client = useMemo(
    () => (customFetch ? new MastraClient({ baseUrl, fetch: customFetch }) : stub),
    [baseUrl, customFetch],
  );
  const own = createElement(ClientContext.Provider, { value: client }, children);
  return customFetch ? createElement(Real, { baseUrl, customFetch, children: own }) : own;
}

/** Lets a story hand components a fake client; `useMastraClient` returns it. */
export function MockMastraClientProvider({ client: fake, children }: { client: object; children: ReactNode }) {
  const value = useMemo(() => ({ ...stub, ...fake }), [fake]);
  return createElement(ClientContext.Provider, { value }, children);
}

export function useMastraClient() {
  return useContext(ClientContext);
}
