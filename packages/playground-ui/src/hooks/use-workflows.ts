import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import {
  WorkflowRunResult as BaseWorkflowRunResult,
  VNextWorkflowWatchResult,
  GetVNextWorkflowResponse,
} from '@mastra/client-js';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createMastraClient } from '@/lib/mastra-client';

export type ExtendedWorkflowRunResult = BaseWorkflowRunResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

export type ExtendedVNextWorkflowWatchResult = VNextWorkflowWatchResult & {
  sanitizedOutput?: string | null;
  sanitizedError?: {
    message: string;
    stack?: string;
  } | null;
};

const sanitizeVNexWorkflowWatchResult = (record: VNextWorkflowWatchResult) => {
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
  const sanitizedRecord: ExtendedVNextWorkflowWatchResult = {
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

export const useWorkflow = (workflowId: string, baseUrl: string) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = createMastraClient(baseUrl);

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
        if (!res) {
          setWorkflow(null);
          console.error('Error fetching workflow');
          toast.error('Error fetching workflow');
          return;
        }
        const steps = res.steps;
        const stepsWithWorkflow = await Promise.all(
          Object.values(steps)?.map(async step => {
            if (!step.workflowId) return step;

            const wFlow = await client.getWorkflow(step.workflowId).details();

            if (!res) return step;

            return { ...step, stepGraph: wFlow.stepGraph, stepSubscriberGraph: wFlow.stepSubscriberGraph };
          }),
        );
        const _steps = stepsWithWorkflow.reduce((acc, b) => {
          return { ...acc, [b.id]: b };
        }, {});
        setWorkflow({ ...res, steps: _steps } as Workflow);
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

export const useVNextWorkflow = (workflowId: string, baseUrl: string) => {
  const [vNextWorkflow, setVNextWorkflow] = useState<GetVNextWorkflowResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = createMastraClient(baseUrl);

  useEffect(() => {
    const fetchWorkflow = async () => {
      setIsLoading(true);
      try {
        if (!workflowId) {
          setVNextWorkflow(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getVNextWorkflow(workflowId).details();
        setVNextWorkflow(res);
      } catch (error) {
        setVNextWorkflow(null);
        console.error('Error fetching workflow', error);
        toast.error('Error fetching workflow');
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflow();
  }, [workflowId]);

  return { vNextWorkflow, isLoading };
};

export const useExecuteWorkflow = (baseUrl: string) => {
  const client = createMastraClient(baseUrl);

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

  const createVNextWorkflowRun = async ({ workflowId, prevRunId }: { workflowId: string; prevRunId?: string }) => {
    try {
      const workflow = client.getVNextWorkflow(workflowId);
      const { runId: newRunId } = await workflow.createRun({ runId: prevRunId });
      return { runId: newRunId };
    } catch (error) {
      console.error('Error creating workflow run:', error);
      throw error;
    }
  };

  const startWorkflowRun = async ({ workflowId, runId, input }: { workflowId: string; runId: string; input: any }) => {
    try {
      const workflow = client.getWorkflow(workflowId);
      await workflow.start({ runId, triggerData: input || {} });
    } catch (error) {
      console.error('Error starting workflow run:', error);
      throw error;
    }
  };

  const startVNextWorkflowRun = async ({
    workflowId,
    runId,
    input,
  }: {
    workflowId: string;
    runId: string;
    input: any;
  }) => {
    try {
      const workflow = client.getVNextWorkflow(workflowId);
      await workflow.start({ runId, inputData: input || {} });
    } catch (error) {
      console.error('Error starting workflow run:', error);
      throw error;
    }
  };

  const startAsyncVNextWorkflowRun = async ({
    workflowId,
    runId,
    input,
  }: {
    workflowId: string;
    runId?: string;
    input: any;
  }) => {
    try {
      const workflow = client.getVNextWorkflow(workflowId);
      const result = await workflow.startAsync({ runId, inputData: input || {} });
      return result;
    } catch (error) {
      console.error('Error starting workflow run:', error);
      throw error;
    }
  };

  return {
    startWorkflowRun,
    createWorkflowRun,
    startVNextWorkflowRun,
    createVNextWorkflowRun,
    startAsyncVNextWorkflowRun,
  };
};

export const useWatchWorkflow = (baseUrl: string) => {
  const [isWatchingWorkflow, setIsWatchingWorkflow] = useState(false);
  const [isWatchingVNextWorkflow, setIsWatchingVNextWorkflow] = useState(false);
  const [watchResult, setWatchResult] = useState<ExtendedWorkflowRunResult | null>(null);
  const [watchVNextResult, setWatchVNextResult] = useState<ExtendedVNextWorkflowWatchResult | null>(null);

  // Debounce the state update to prevent too frequent renders
  const debouncedSetWatchResult = useDebouncedCallback((record: ExtendedWorkflowRunResult) => {
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
    const sanitizedRecord: ExtendedWorkflowRunResult = {
      ...record,
      sanitizedOutput: record
        ? JSON.stringify({ ...record, results: formattedResults }, null, 2).slice(0, 50000) // Limit to 50KB
        : null,
    };
    setWatchResult(sanitizedRecord);
  }, 100);

  const watchWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingWorkflow(true);
      const client = createMastraClient(baseUrl);

      const workflow = client.getWorkflow(workflowId);

      await workflow.watch({ runId }, record => {
        console.log('record in use-workflows==', record);
        try {
          debouncedSetWatchResult(record);
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

  // Debounce the state update to prevent too frequent renders
  const debouncedSetVNextWatchResult = useDebouncedCallback((record: ExtendedVNextWorkflowWatchResult) => {
    const sanitizedRecord = sanitizeVNexWorkflowWatchResult(record);
    setWatchVNextResult(sanitizedRecord);
  }, 100);

  const watchVNextWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingVNextWorkflow(true);
      const client = createMastraClient(baseUrl);

      const workflow = client.getVNextWorkflow(workflowId);

      await workflow.watch({ runId }, record => {
        console.log('record in use-workflows===', record);
        try {
          debouncedSetVNextWatchResult(record);
        } catch (err) {
          console.error('Error processing workflow record:', err);
          // Set a minimal error state if processing fails
          setWatchVNextResult({
            ...record,
          });
        }
      });
    } catch (error) {
      console.error('Error watching workflow:', error);

      throw error;
    } finally {
      setIsWatchingVNextWorkflow(false);
    }
  };

  return {
    watchWorkflow,
    isWatchingWorkflow,
    watchResult,
    watchVNextWorkflow,
    isWatchingVNextWorkflow,
    watchVNextResult,
  };
};

export const useResumeWorkflow = (baseUrl: string) => {
  const [isResumingWorkflow, setIsResumingWorkflow] = useState(false);
  const [isResumingVNextWorkflow, setIsResumingVNextWorkflow] = useState(false);

  const resumeWorkflow = async ({
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
      setIsResumingWorkflow(true);
      const client = createMastraClient(baseUrl);

      const response = await client.getWorkflow(workflowId).resume({ stepId, runId, context });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingWorkflow(false);
    }
  };

  const resumeVNextWorkflow = async ({
    workflowId,
    step,
    runId,
    resumeData,
    runtimeContext,
  }: {
    workflowId: string;
    step: string | string[];
    runId: string;
    resumeData: any;
    runtimeContext?: RuntimeContext;
  }) => {
    try {
      setIsResumingVNextWorkflow(true);
      const client = createMastraClient(baseUrl);

      const response = await client.getVNextWorkflow(workflowId).resume({ step, runId, resumeData, runtimeContext });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingVNextWorkflow(false);
    }
  };

  return {
    resumeWorkflow,
    isResumingWorkflow,
    resumeVNextWorkflow,
    isResumingVNextWorkflow,
  };
};
