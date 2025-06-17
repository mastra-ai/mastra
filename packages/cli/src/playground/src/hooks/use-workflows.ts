import { client } from '@/lib/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useDebouncedCallback } from 'use-debounce';
import { LegacyWorkflowRunResult, WorkflowWatchResult } from '@mastra/client-js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { useState } from 'react';

export type ExtendedLegacyWorkflowRunResult = LegacyWorkflowRunResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

export type ExtendedWorkflowWatchResult = WorkflowWatchResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

const sanitizeWorkflowWatchResult = (record: WorkflowWatchResult) => {
  const formattedResults = Object.entries(record.payload.workflowState.steps || {}).reduce(
    (acc, [key, value]) => {
      let output = value.status === 'success' ? value.output : undefined;
      if (output) {
        output = Object.entries(output).reduce(
          (_acc, [_key, _value]) => {
            const val = _value as { type: string; data: unknown };
            _acc[_key] = val.type?.toLowerCase() === 'buffer' ? { type: 'Buffer', data: `[...buffered data]` } : val;
            return _acc;
          },
          {} as Record<string, unknown>,
        );
      }
      acc[key] = { ...value, output };
      return acc;
    },
    {} as Record<string, unknown>,
  );
  const sanitizedRecord: ExtendedWorkflowWatchResult = {
    ...record,
    sanitizedOutput: record
      ? JSON.stringify(
          {
            ...record,
            payload: {
              ...record.payload,
              workflowState: { ...record.payload.workflowState, steps: formattedResults },
            },
          },
          null,
          2,
        ).slice(0, 50000) // Limit to 50KB
      : null,
  };

  return sanitizedRecord;
};

export const useWorkflows = () => {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => Promise.all([client.getLegacyWorkflows(), client.getWorkflows()]),
  });
};

export const useLegacyWorkflow = (workflowId: string, enabled = true) => {
  return useQuery({
    gcTime: 0,
    staleTime: 0,
    queryKey: ['legacy-workflow', workflowId],
    queryFn: () => client.getLegacyWorkflow(workflowId).details(),
    enabled,
  });
};

export const useWorkflow = (workflowId: string, enabled = true) => {
  return useQuery({
    gcTime: 0,
    staleTime: 0,
    queryKey: ['workflow', workflowId],
    queryFn: () => client.getWorkflow(workflowId).details(),
    enabled,
  });
};

export const useExecuteWorkflow = () => {
  const createLegacyWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
      try {
        const workflow = client.getLegacyWorkflow(workflowId);
        const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
        return { runId: newRunId };
      } catch (error) {
        console.error('Error creating workflow run:', error);
        throw error;
      }
    },
  });

  const createWorkflowRun = useMutation({
    mutationFn: async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
      try {
        const workflow = client.getWorkflow(workflowId);
        const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
        return { runId: newRunId };
      } catch (error) {
        console.error('Error creating workflow run:', error);
        throw error;
      }
    },
  });

  const startLegacyWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
    }: {
      workflowId: string;
      runId: string;
      input: Record<string, unknown>;
    }) => {
      try {
        const workflow = client.getLegacyWorkflow(workflowId);
        await workflow.start({ runId, triggerData: input || {} });
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  });

  const startWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      runId: string;
      input: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      try {
        const runtimeContext = new RuntimeContext();
        Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
          runtimeContext.set(key, value);
        });

        const workflow = client.getWorkflow(workflowId);

        await workflow.start({ runId, inputData: input || {}, runtimeContext });
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  });

  const startAsyncWorkflowRun = useMutation({
    mutationFn: async ({
      workflowId,
      runId,
      input,
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      runId?: string;
      input: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      try {
        const runtimeContext = new RuntimeContext();
        Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
          runtimeContext.set(key, value);
        });
        const workflow = client.getWorkflow(workflowId);
        const result = await workflow.startAsync({ runId, inputData: input || {}, runtimeContext });
        return result;
      } catch (error) {
        console.error('Error starting workflow run:', error);
        throw error;
      }
    },
  });

  return {
    startWorkflowRun,
    createWorkflowRun,
    startLegacyWorkflowRun,
    createLegacyWorkflowRun,
    startAsyncWorkflowRun,
  };
};

export const useWatchWorkflow = () => {
  const [watchResult, setWatchResult] = useState<ExtendedWorkflowWatchResult | null>(null);
  // Debounce the state update to prevent too frequent renders
  const debouncedSetWorkflowWatchResult = useDebouncedCallback((record: ExtendedWorkflowWatchResult) => {
    const sanitizedRecord = sanitizeWorkflowWatchResult(record);
    setWatchResult(sanitizedRecord);
  }, 100);

  const watchWorkflow = useMutation({
    mutationFn: async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
      try {
        const workflow = client.getWorkflow(workflowId);

        await workflow.watch({ runId }, record => {
          try {
            debouncedSetWorkflowWatchResult(record);
          } catch (err) {
            console.error('Error processing workflow record:', err);
            // Set a minimal error state if processing fails
            setWatchResult({
              ...record,
            });
          }
        });
      } catch (error) {
        console.error('Error watching workflow:', error);

        throw error;
      }
    },
  });

  return {
    watchWorkflow,
    watchResult,
  };
};

export const useWatchLegacyWorkflow = () => {
  const [legacyWatchResult, setLegacyWatchResult] = useState<ExtendedLegacyWorkflowRunResult | null>(null);

  // Debounce the state update to prevent too frequent renders
  const debouncedSetLegacyWorkflowWatchResult = useDebouncedCallback((record: ExtendedLegacyWorkflowRunResult) => {
    // Sanitize and limit the size of large data fields
    const formattedResults = Object.entries(record.results || {}).reduce(
      (acc, [key, value]) => {
        let output = value.status === 'success' ? value.output : undefined;
        if (output) {
          output = Object.entries(output).reduce(
            (_acc, [_key, _value]) => {
              const val = _value as { type: string; data: unknown };
              _acc[_key] = val.type?.toLowerCase() === 'buffer' ? { type: 'Buffer', data: `[...buffered data]` } : val;
              return _acc;
            },
            {} as Record<string, unknown>,
          );
        }
        acc[key] = { ...value, output };
        return acc;
      },
      {} as Record<string, unknown>,
    );
    const sanitizedRecord: ExtendedLegacyWorkflowRunResult = {
      ...record,
      sanitizedOutput: record
        ? JSON.stringify({ ...record, results: formattedResults }, null, 2).slice(0, 50000) // Limit to 50KB
        : null,
    };

    setLegacyWatchResult(sanitizedRecord);
  }, 100);

  const watchMutation = useMutation({
    mutationFn: async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
      const workflow = client.getLegacyWorkflow(workflowId);

      await workflow.watch({ runId }, record => {
        try {
          debouncedSetLegacyWorkflowWatchResult(record);
        } catch (err) {
          console.error('Error processing workflow record:', err);
          setLegacyWatchResult({
            ...record,
          });
        }
      });
    },
  });

  return {
    watchMutation,
    legacyWatchResult,
  };
};

export const useResumeWorkflow = () => {
  const resumeLegacyWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      stepId,
      runId,
      context,
    }: {
      workflowId: string;
      stepId: string;
      runId: string;
      context: Record<string, unknown>;
    }) => {
      try {
        const response = await client.getLegacyWorkflow(workflowId).resume({ stepId, runId, context });

        return response;
      } catch (error) {
        console.error('Error resuming workflow:', error);
        throw error;
      }
    },
  });

  const resumeWorkflow = useMutation({
    mutationFn: async ({
      workflowId,
      step,
      runId,
      resumeData,
      runtimeContext: playgroundRuntimeContext,
    }: {
      workflowId: string;
      step: string | string[];
      runId: string;
      resumeData: Record<string, unknown>;
      runtimeContext: Record<string, unknown>;
    }) => {
      try {
        const runtimeContext = new RuntimeContext();
        Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
          runtimeContext.set(key, value);
        });
        const response = await client.getWorkflow(workflowId).resume({ step, runId, resumeData, runtimeContext });

        return response;
      } catch (error) {
        console.error('Error resuming workflow:', error);
        throw error;
      }
    },
  });

  return {
    resumeLegacyWorkflow,
    resumeWorkflow,
  };
};
