import { createContext, useContext } from 'react';

/** How a label-routed provider names itself and what it routes, e.g. Jira's projects and issues. */
export interface RoutingTerms {
  integrationId: string;
  /** "Jira" */
  provider: string;
  /** What a source is, singular: "project". */
  source: string;
  /** What a source holds, plural: "issues". */
  items: string;
}

const RoutingTermsContext = createContext<RoutingTerms | null>(null);

export const RoutingTermsProvider = RoutingTermsContext.Provider;

export function useRoutingTerms(): RoutingTerms {
  const terms = useContext(RoutingTermsContext);
  if (!terms) throw new Error('useRoutingTerms needs a RoutingTermsProvider');
  return terms;
}

export function capitalized(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
