import type {
  CreateTraceSignalDefinitionInput,
  ProjectTraceSignalSetting,
  SignalCatalogEntry,
  TraceSignalDefinition,
  TraceSignalManagementListResponse,
  UpdateTraceSignalDefinitionInput,
} from '@mastra/client-js';
import { createContext } from 'react';

import { BUILT_IN_SIGNAL_CATALOG } from './signal-formatting';
import type { LinkComponent } from '@/ds/types/link-component';

export type TraceIntelligenceRequest = <Response>(path: string) => Promise<Response>;

export interface TraceSignalManagement {
  canManage: boolean;
  list: () => Promise<TraceSignalManagementListResponse>;
  create: (input: CreateTraceSignalDefinitionInput) => Promise<TraceSignalDefinition>;
  update: (id: string, input: UpdateTraceSignalDefinitionInput) => Promise<TraceSignalDefinition>;
  archive: (id: string) => Promise<TraceSignalDefinition>;
  restore: (id: string) => Promise<TraceSignalDefinition>;
  setProjectEnabled: (id: string, enabled: boolean) => Promise<ProjectTraceSignalSetting>;
}

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
  signalManagement?: TraceSignalManagement;
}

export const defaultTraceIntelligenceContextValue: TraceIntelligenceContextValue = {
  cacheScope: 'oss-studio',
  request: defaultRequest,
  LinkComponent: 'a',
  getTraceHref: traceId => `/traces/${encodeURIComponent(traceId)}`,
  signalCatalog: BUILT_IN_SIGNAL_CATALOG,
};

export const TraceIntelligenceContext = createContext(defaultTraceIntelligenceContextValue);
