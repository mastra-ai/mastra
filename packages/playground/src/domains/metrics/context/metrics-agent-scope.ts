import { createContext } from 'react';

export interface MetricsAgentScope {
  id: string;
  name: string;
}

/** A route-owned scope cannot be changed by dashboard filter controls. */
export const MetricsAgentScopeContext = createContext<MetricsAgentScope | undefined>(undefined);
