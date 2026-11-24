import { createContext, useContext } from 'react';

export interface DatasetSaveContextValue {
  /** Whether dataset save actions should be shown on messages */
  enabled: boolean;
  /** Thread ID for fetching actual messages from storage */
  threadId: string;
  /** Agent ID for fetching messages via agent memory */
  agentId: string;
  /** Request context to persist with saved dataset items */
  requestContext?: Record<string, unknown>;
}

export const DatasetSaveContext = createContext<DatasetSaveContextValue | null>(null);

export function useDatasetSaveContext() {
  return useContext(DatasetSaveContext);
}
