import { WorkflowWatchResult } from '@mastra/client-js';
import { WorkflowOutputType } from './types';
import { useEffect, useState } from 'react';
import { WorkflowRunStatus } from '@mastra/core';

export const useHandleAgentWorkflowStream = (workflowOutput?: WorkflowOutputType) => {
  const [streamResult, setStreamResult] = useState<WorkflowWatchResult>({} as WorkflowWatchResult);

  useEffect(() => {
    if (!workflowOutput) return;

    setStreamResult(prevStreamResult => {
      if (workflowOutput.type === 'workflow-start') {
        const workflowResult: WorkflowWatchResult = {
          ...prevStreamResult,
          type: 'watch',
          eventTimestamp: new Date(),
          runId: workflowOutput.runId,
          payload: {
            ...prevStreamResult?.payload,
            currentStep: undefined,
            workflowState: {
              ...prevStreamResult?.payload?.workflowState,
              status: 'running',
              steps: {},
            },
          },
        };

        return workflowResult;
      }

      if (workflowOutput.type === 'workflow-step-start') {
        const workflowResult: WorkflowWatchResult = {
          ...prevStreamResult,
          type: 'watch',
          eventTimestamp: new Date(),
          runId: workflowOutput.runId,
          payload: {
            ...prevStreamResult?.payload,
            currentStep: {
              ...prevStreamResult?.payload?.currentStep,
              id: workflowOutput.payload?.id,
              payload: workflowOutput.payload?.payload,
              status: workflowOutput.payload?.status as WorkflowRunStatus,
            },
            workflowState: {
              ...prevStreamResult?.payload?.workflowState,
              status: workflowOutput.payload?.status as WorkflowRunStatus,
              steps: {
                ...prevStreamResult?.payload?.workflowState?.steps,
                [workflowOutput.payload?.id]: {
                  ...prevStreamResult?.payload?.workflowState?.steps[workflowOutput.payload?.id],
                  status: workflowOutput.payload?.status as WorkflowRunStatus,
                  payload: workflowOutput.payload?.payload,
                  startedAt: workflowOutput.payload?.startedAt,
                  endedAt: 0,
                },
              },
            },
          },
        };

        return workflowResult;
      }

      if (workflowOutput.type === 'workflow-step-result') {
        const workflowResult: WorkflowWatchResult = {
          ...prevStreamResult,
          type: 'watch',
          eventTimestamp: new Date(),
          runId: workflowOutput.runId,
          payload: {
            ...prevStreamResult?.payload,
            currentStep: {
              ...prevStreamResult?.payload?.currentStep,
              id: workflowOutput.payload?.id,
              payload: workflowOutput.payload?.payload,
              status: workflowOutput.payload?.status as WorkflowRunStatus,
              output: workflowOutput.payload?.output,
            },
            workflowState: {
              ...prevStreamResult?.payload?.workflowState,
              status: workflowOutput.payload?.status as WorkflowRunStatus,
              steps: {
                ...prevStreamResult?.payload?.workflowState?.steps,
                [workflowOutput.payload?.id]: {
                  ...prevStreamResult?.payload?.workflowState?.steps[workflowOutput.payload?.id],
                  status: workflowOutput.payload?.status as WorkflowRunStatus,
                  endedAt: workflowOutput.payload?.endedAt,
                  output: workflowOutput.payload?.output,
                },
              },
            },
          },
        };

        return workflowResult;
      }

      return prevStreamResult;
    });
  }, [workflowOutput]);

  return streamResult;
};
