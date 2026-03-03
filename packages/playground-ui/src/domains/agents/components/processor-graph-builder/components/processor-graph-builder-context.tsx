import { createContext, useContext } from 'react';

import type { ProcessorProviderInfo } from '@mastra/client-js';

import type { JsonSchema } from '@/lib/json-schema';
import type { ProcessorGraphBuilderAPI } from '../hooks/use-processor-graph-builder';

interface ProcessorGraphBuilderContextValue {
  builder: ProcessorGraphBuilderAPI;
  providers: ProcessorProviderInfo[];
  isLoadingProviders: boolean;
  readOnly: boolean;
  variablesSchema?: JsonSchema;
}

const ProcessorGraphBuilderContext = createContext<ProcessorGraphBuilderContextValue | null>(null);

export function ProcessorGraphBuilderProvider({
  children,
  ...value
}: ProcessorGraphBuilderContextValue & { children: React.ReactNode }) {
  return <ProcessorGraphBuilderContext.Provider value={value}>{children}</ProcessorGraphBuilderContext.Provider>;
}

export function useProcessorGraphBuilderContext() {
  const ctx = useContext(ProcessorGraphBuilderContext);
  if (!ctx) {
    throw new Error('useProcessorGraphBuilderContext must be used within a ProcessorGraphBuilderProvider');
  }
  return ctx;
}
