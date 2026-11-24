import type { SignalCatalogEntry } from '@mastra/client-js';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { defaultTraceIntelligenceContextValue, TraceIntelligenceContext } from './trace-intelligence-context';
import type { TraceIntelligenceRequest, TraceSignalManagement } from './trace-intelligence-context';
import type { LinkComponent } from '@/ds/types/link-component';

export interface TraceIntelligenceProviderProps {
  cacheScope: string;
  children: ReactNode;
  request?: TraceIntelligenceRequest;
  LinkComponent?: LinkComponent;
  getTraceHref?: (traceId: string) => string;
  signalCatalog?: SignalCatalogEntry[];
  signalManagement?: TraceSignalManagement;
}

export function TraceIntelligenceProvider({
  cacheScope,
  children,
  request = defaultTraceIntelligenceContextValue.request,
  LinkComponent = defaultTraceIntelligenceContextValue.LinkComponent,
  getTraceHref = defaultTraceIntelligenceContextValue.getTraceHref,
  signalCatalog = defaultTraceIntelligenceContextValue.signalCatalog,
  signalManagement,
}: TraceIntelligenceProviderProps) {
  const value = useMemo(
    () => ({ cacheScope, request, LinkComponent, getTraceHref, signalCatalog, signalManagement }),
    [cacheScope, getTraceHref, LinkComponent, request, signalCatalog, signalManagement],
  );

  return <TraceIntelligenceContext.Provider value={value}>{children}</TraceIntelligenceContext.Provider>;
}
