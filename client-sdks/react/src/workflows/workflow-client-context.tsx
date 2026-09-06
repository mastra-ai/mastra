import { createWorkflowClient, type ClientOptions, type MastraWorkflowClient } from '@mastra/client-js/workflows';
import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';

export type WorkflowClientContextType = Pick<MastraWorkflowClient, 'getWorkflow'>;

export interface MastraWorkflowProviderProps {
  children: ReactNode;
  baseUrl: string;
  headers?: ClientOptions['headers'];
  apiPrefix?: ClientOptions['apiPrefix'];
  credentials?: ClientOptions['credentials'];
  customFetch?: ClientOptions['fetch'];
  retries?: ClientOptions['retries'];
  backoffMs?: ClientOptions['backoffMs'];
  maxBackoffMs?: ClientOptions['maxBackoffMs'];
  abortSignal?: ClientOptions['abortSignal'];
}

const WorkflowClientContext = createContext<WorkflowClientContextType | null>(null);

export const WorkflowClientContextProvider = ({
  client,
  children,
}: {
  client: WorkflowClientContextType;
  children: ReactNode;
}) => <WorkflowClientContext.Provider value={client}>{children}</WorkflowClientContext.Provider>;

export const MastraWorkflowProvider = ({
  children,
  baseUrl,
  headers,
  apiPrefix,
  credentials = 'include',
  customFetch,
  retries,
  backoffMs,
  maxBackoffMs,
  abortSignal,
}: MastraWorkflowProviderProps) => {
  const client = useMemo(
    () =>
      createWorkflowClient({
        baseUrl,
        headers,
        apiPrefix,
        credentials,
        fetch: customFetch,
        retries,
        backoffMs,
        maxBackoffMs,
        abortSignal,
      }),
    [abortSignal, apiPrefix, backoffMs, baseUrl, credentials, customFetch, headers, maxBackoffMs, retries],
  );

  return <WorkflowClientContextProvider client={client}>{children}</WorkflowClientContextProvider>;
};

export const useWorkflowClient = (): WorkflowClientContextType => {
  const client = useContext(WorkflowClientContext);
  if (!client) {
    throw new Error('useWorkflowClient must be used within MastraWorkflowProvider or MastraReactProvider');
  }
  return client;
};
