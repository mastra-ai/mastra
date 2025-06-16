import { createContext } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';

import { GetWorkflowResponse } from '@mastra/client-js';

export type DataHooksContextType = {
  useWorkflow: (
    workflowId: string,
    enabled?: boolean,
  ) => Partial<UseQueryResult<GetWorkflowResponse | undefined, Error>>;
};

export const DataHooksContext = createContext<DataHooksContextType>({
  useWorkflow: () => ({}),
});
