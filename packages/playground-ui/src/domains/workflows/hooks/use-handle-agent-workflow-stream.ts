import { WorkflowWatchResult } from '@mastra/client-js';

import { useEffect, useState } from 'react';
import { mapWorkflowStreamChunkToWatchResult } from '../utils';
import { StreamChunk } from '@/types';

export const useHandleAgentWorkflowStream = (workflowOutput?: StreamChunk) => {
  const [streamResult, setStreamResult] = useState<WorkflowWatchResult>({} as WorkflowWatchResult);

  useEffect(() => {
    if (!workflowOutput) return;

    setStreamResult(prev => mapWorkflowStreamChunkToWatchResult(prev, workflowOutput));
  }, [workflowOutput]);

  return streamResult;
};
