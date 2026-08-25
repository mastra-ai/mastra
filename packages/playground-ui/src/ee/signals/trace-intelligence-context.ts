import { createContext } from 'react';

import type { LinkComponent } from '@/ds/types/link-component';

export type TraceIntelligenceRequest = <Response>(path: string) => Promise<Response>;

async function defaultRequest<Response>(path: string): Promise<Response> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Agent Learning request failed (${response.status})`);
  }
  return response.json() as Promise<Response>;
}

export interface TraceIntelligenceContextValue {
  cacheScope: string;
  request: TraceIntelligenceRequest;
  LinkComponent: LinkComponent;
  getTraceHref: (traceId: string) => string;
}

export const defaultTraceIntelligenceContextValue: TraceIntelligenceContextValue = {
  cacheScope: 'oss-studio',
  request: defaultRequest,
  LinkComponent: 'a',
  getTraceHref: traceId => `/traces?traceId=${encodeURIComponent(traceId)}`,
};

export const TraceIntelligenceContext = createContext(defaultTraceIntelligenceContextValue);
