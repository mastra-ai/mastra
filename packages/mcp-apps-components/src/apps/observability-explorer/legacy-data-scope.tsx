import { MastraReactProvider } from '@mastra/react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { createMcpFetch } from '../../shared/mcp-fetch';
import type { OpenedTraceFilter } from '../../shared/mcp-tools';

type Scope = { queryClient: QueryClient; customFetch: typeof fetch };
type Scopes = { opened: Scope; unfiltered: Scope };

const LegacyDataContext = createContext<Scopes | null>(null);

function createScope(app: App, getOpened: () => OpenedTraceFilter | undefined): Scope {
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }),
    customFetch: createMcpFetch(app, getOpened),
  };
}

/**
 * The Studio data stack (React Query and the Mastra client, over the app's tools) for the parts of the explorer
 * that still load through `@mastra/react` hooks: logs, metrics and the thread drawer. The opened scope applies
 * the model's leftover query; the unfiltered one doesn't, so a thread shows every one of its traces.
 */
export function useLegacyDataScopes(app: App, getOpened: () => OpenedTraceFilter | undefined): Scopes {
  const [scopes] = useState(() => ({
    opened: createScope(app, getOpened),
    unfiltered: createScope(app, () => undefined),
  }));
  return scopes;
}

export function LegacyDataProvider({ scopes, children }: { scopes: Scopes; children: ReactNode }) {
  return <LegacyDataContext.Provider value={scopes}>{children}</LegacyDataContext.Provider>;
}

export function LegacyDataScope({ unfiltered = false, children }: { unfiltered?: boolean; children: ReactNode }) {
  const scopes = useContext(LegacyDataContext);
  if (!scopes) throw new Error('LegacyDataScope must be rendered inside LegacyDataProvider.');
  const { queryClient, customFetch } = unfiltered ? scopes.unfiltered : scopes.opened;
  return (
    <QueryClientProvider client={queryClient}>
      <MastraReactProvider baseUrl="https://mcp-app.mastra.invalid" customFetch={customFetch}>
        {children}
      </MastraReactProvider>
    </QueryClientProvider>
  );
}
