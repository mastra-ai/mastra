import type { ReactNode } from 'react';

import {
  defaultTraceIntelligenceContextValue,
  TraceIntelligenceContext,
  type TraceIntelligenceRequest,
} from './trace-intelligence-context';
import type { LinkComponent } from '@/ds/types/link-component';

export interface TraceIntelligenceProviderProps {
  cacheScope: string;
  children: ReactNode;
  request?: TraceIntelligenceRequest;
  LinkComponent?: LinkComponent;
  getTraceHref?: (traceId: string) => string;
}

export function TraceIntelligenceProvider({
  cacheScope,
  children,
  request = defaultTraceIntelligenceContextValue.request,
  LinkComponent = defaultTraceIntelligenceContextValue.LinkComponent,
  getTraceHref = defaultTraceIntelligenceContextValue.getTraceHref,
}: TraceIntelligenceProviderProps) {
  return (
    <TraceIntelligenceContext.Provider value={{ cacheScope, request, LinkComponent, getTraceHref }}>
      {children}
    </TraceIntelligenceContext.Provider>
  );
}
