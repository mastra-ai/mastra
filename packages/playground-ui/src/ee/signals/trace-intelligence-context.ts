import type { SignalCatalogEntry } from '@mastra/client-js';
import { createContext } from 'react';

import { BUILT_IN_SIGNAL_CATALOG } from './signal-formatting';
import type { LinkComponent } from '@/ds/types/link-component';

export type TraceIntelligenceRequest = <Response>(path: string) => Promise<Response>;

async function defaultRequest<Response>(path: string): Promise<Response> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    throw Object.assign(new Error(`Trace Intelligence request failed (${response.status})`), {
      status: response.status,
    });
  }
  return response.json() as Promise<Response>;
}

export interface TraceIntelligenceContextValue {
  cacheScope: string;
  request: TraceIntelligenceRequest;
  LinkComponent: LinkComponent;
  getTraceHref: (traceId: string) => string;
  signalCatalog: SignalCatalogEntry[];
}

export const defaultTraceIntelligenceContextValue: TraceIntelligenceContextValue = {
  cacheScope: 'oss-studio',
  request: defaultRequest,
  LinkComponent: 'a',
  getTraceHref: traceId => `/traces/${encodeURIComponent(traceId)}`,
  signalCatalog: BUILT_IN_SIGNAL_CATALOG,
};

export const TraceIntelligenceContext = createContext(defaultTraceIntelligenceContextValue);
