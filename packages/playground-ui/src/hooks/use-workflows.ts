import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { LegacyWorkflowRunResult, WorkflowWatchResult, GetWorkflowResponse } from '@mastra/client-js';
import type { MastraClient } from '@mastra/client-js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import type { LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { useMastraClient } from '@/contexts/mastra-client-context';

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
          {} as Record<string, any>,
        );
      }
      acc[key] = { ...value, output };
      return acc;
    },
    {} as Record<string, any>,
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
        const res = await client.getLegacyWorkflow(workflowId).details();
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

            const wFlow = await client.getLegacyWorkflow(step.workflowId).details();

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

export const useWorkflow = (workflowId: string) => {
  const [workflow, setWorkflow] = useState<GetWorkflowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = useMastraClient();

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getWorkflow(workflowId).details();
        setWorkflow(res);
      } catch (error) {
        setWorkflow(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  return { workflow, isLoading };
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

  const createWorkflowRun = async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
    try {
      const workflow = client.getWorkflow(workflowId);
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

  const startWorkflowRun = async ({
    workflowId,
    runId,
    input,
    runtimeContext: playgroundRuntimeContext,
  }: {
    workflowId: string;
    runId: string;
    input: any;
    runtimeContext: Record<string, any>;
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
  };

  const startAsyncWorkflowRun = async ({
    workflowId,
    runId,
    input,
    runtimeContext: playgroundRuntimeContext,
  }: {
    workflowId: string;
    runId?: string;
    input: any;
    runtimeContext: Record<string, any>;
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
  };

  return {
    startWorkflowRun,
    createWorkflowRun,
    startLegacyWorkflowRun,
    createLegacyWorkflowRun,
    startAsyncWorkflowRun,
  };
};

export const useWatchWorkflow = () => {
  const [isWatchingLegacyWorkflow, setIsWatchingLegacyWorkflow] = useState(false);
  const [isWatchingWorkflow, setIsWatchingWorkflow] = useState(false);
  const [legacyWatchResult, setLegacyWatchResult] = useState<ExtendedLegacyWorkflowRunResult | null>(null);
  const [watchResult, setWatchResult] = useState<ExtendedWorkflowWatchResult | null>(null);
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

  // Debounce the state update to prevent too frequent renders
  const debouncedSetWorkflowWatchResult = useDebouncedCallback((record: ExtendedWorkflowWatchResult) => {
    const sanitizedRecord = sanitizeWorkflowWatchResult(record);
    setWatchResult(sanitizedRecord);
  }, 100);

  const watchWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingWorkflow(true);

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
    } finally {
      setIsWatchingWorkflow(false);
    }
  };

  return {
    watchLegacyWorkflow,
    isWatchingLegacyWorkflow,
    legacyWatchResult,
    watchWorkflow,
    isWatchingWorkflow,
    watchResult,
  };
};

export const useResumeWorkflow = () => {
  const [isResumingLegacyWorkflow, setIsResumingLegacyWorkflow] = useState(false);
  const [isResumingWorkflow, setIsResumingWorkflow] = useState(false);

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

  const resumeWorkflow = async ({
    workflowId,
    step,
    runId,
    resumeData,
    runtimeContext: playgroundRuntimeContext,
  }: {
    workflowId: string;
    step: string | string[];
    runId: string;
    resumeData: any;
    runtimeContext: Record<string, any>;
  }) => {
    try {
      setIsResumingWorkflow(true);

      const runtimeContext = new RuntimeContext();
      Object.entries(playgroundRuntimeContext).forEach(([key, value]) => {
        runtimeContext.set(key, value);
      });

      const response = await client.getWorkflow(workflowId).resume({ step, runId, resumeData, runtimeContext });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingWorkflow(false);
    }
  };

  return {
    resumeLegacyWorkflow,
    isResumingLegacyWorkflow,
    resumeWorkflow,
    isResumingWorkflow,
  };
};
