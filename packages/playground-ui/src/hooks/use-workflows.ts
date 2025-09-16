import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { LegacyWorkflowRunResult, WorkflowWatchResult, GetWorkflowResponse } from '@mastra/client-js';
import type { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { useMastraClient } from '@/contexts/mastra-client-context';
import { usePlaygroundStore } from '@/store/playground-store';
import { useQuery } from '@tanstack/react-query';

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

export const useWorkflow = (workflowId: string, enabled = true) => {
  const client = useMastraClient();
  const { runtimeContext } = usePlaygroundStore();
  return useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => client.getWorkflow(workflowId).details(runtimeContext),
    retry: false,
    refetchOnWindowFocus: false,
    throwOnError: false,
    enabled,
  });
};

export const useLegacyWorkflow = (workflowId: string) => {
  const [legacyWorkflow, setLegacyWorkflow] = useState<LegacyWorkflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = useMastraClient();

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setLegacyWorkflow(null);
          setIsLoading(false);
          return;
        }
        const { runtimeContext } = usePlaygroundStore.getState();
        const res = await client.getLegacyWorkflow(workflowId).details(runtimeContext);
        if (!res) {
          setLegacyWorkflow(null);
          console.error('Error fetching legacy workflow');
          toast.error('Error fetching legacy workflow');
          return;
        }
        const steps = res.steps;
        const stepsWithWorkflow = await Promise.all(
          Object.values(steps)?.map(async step => {
            if (!step.workflowId) return step;

            const wFlow = await client.getLegacyWorkflow(step.workflowId).details(runtimeContext);

            if (!wFlow) return step;

            return { ...step, stepGraph: wFlow.stepGraph, stepSubscriberGraph: wFlow.stepSubscriberGraph };
          }),
        );
        const _steps = stepsWithWorkflow.reduce((acc, b) => {
          return { ...acc, [b.id]: b };
        }, {});
        setLegacyWorkflow({ ...res, steps: _steps } as LegacyWorkflow);
      } catch (error) {
        setLegacyWorkflow(null);
        console.error('Error fetching legacy workflow', error);
        toast.error('Error fetching legacy workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  return { legacyWorkflow, isLoading };
};

export const useExecuteWorkflow = () => {
  const client = useMastraClient();

  const createLegacyWorkflowRun = async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
    try {
      const workflow = client.getLegacyWorkflow(workflowId);
      const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
      return { runId: newRunId };
    } catch (error) {
      console.error('Error creating workflow run:', error);
      throw error;
    }
  };

  const startLegacyWorkflowRun = async ({
    workflowId,
    runId,
    input,
  }: {
    workflowId: string;
    runId: string;
    input: any;
  }) => {
    try {
      const workflow = client.getLegacyWorkflow(workflowId);
      await workflow.start({ runId, triggerData: input || {} });
    } catch (error) {
      console.error('Error starting workflow run:', error);
      throw error;
    }
  };

  return {
    startLegacyWorkflowRun,
    createLegacyWorkflowRun,
  };
};

export const useWatchWorkflow = () => {
  const [isWatchingLegacyWorkflow, setIsWatchingLegacyWorkflow] = useState(false);
  const [legacyWatchResult, setLegacyWatchResult] = useState<ExtendedLegacyWorkflowRunResult | null>(null);
  const client = useMastraClient();

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
            {} as Record<string, any>,
          );
        }
        acc[key] = { ...value, output };
        return acc;
      },
      {} as Record<string, any>,
    );
    const sanitizedRecord: ExtendedLegacyWorkflowRunResult = {
      ...record,
      sanitizedOutput: record
        ? JSON.stringify({ ...record, results: formattedResults }, null, 2).slice(0, 50000) // Limit to 50KB
        : null,
    };
    setLegacyWatchResult(sanitizedRecord);
  }, 100);

  const watchLegacyWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingLegacyWorkflow(true);

      const workflow = client.getLegacyWorkflow(workflowId);

      await workflow.watch({ runId }, record => {
        try {
          debouncedSetLegacyWorkflowWatchResult(record);
        } catch (err) {
          console.error('Error processing workflow record:', err);
          // Set a minimal error state if processing fails
          setLegacyWatchResult({
            ...record,
          });
        }
      });
    } catch (error) {
      console.error('Error watching workflow:', error);

      throw error;
    } finally {
      setIsWatchingLegacyWorkflow(false);
    }
  };

  return {
    watchLegacyWorkflow,
    isWatchingLegacyWorkflow,
    legacyWatchResult,
  };
};

export const useResumeWorkflow = () => {
  const [isResumingLegacyWorkflow, setIsResumingLegacyWorkflow] = useState(false);

  const client = useMastraClient();

  const resumeLegacyWorkflow = async ({
    workflowId,
    stepId,
    runId,
    context,
  }: {
    workflowId: string;
    stepId: string;
    runId: string;
    context: any;
  }) => {
    try {
      setIsResumingLegacyWorkflow(true);

      const response = await client.getLegacyWorkflow(workflowId).resume({ stepId, runId, context });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingLegacyWorkflow(false);
    }
  };

  return {
    resumeLegacyWorkflow,
    isResumingLegacyWorkflow,
  };
};
