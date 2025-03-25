import type { Workflow } from '@mastra/core/workflows';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { WorkflowRunResult, MastraClient } from '@mastra/client-js';

export const useWorkflow = (workflowId: string, baseUrl: string) => {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const client = new MastraClient({
    baseUrl: baseUrl || '',
  });

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
        setWorkflow(res as Workflow);
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

export const useExecuteWorkflow = (baseUrl: string) => {
  const [isExecutingWorkflow, setIsExecutingWorkflow] = useState(false);

  const client = new MastraClient({
    baseUrl: baseUrl || '',
  });

  const executeWorkflow = async ({ workflowId, input }: { workflowId: string; input: any }) => {
    try {
      setIsExecutingWorkflow(true);
      const response = await client.getWorkflow(workflowId).execute(input || {});
      return response;
    } catch (error) {
      console.error('Error executing workflow:', error);
      throw error;
    } finally {
      setIsExecutingWorkflow(false);
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

  const startWorkflowRun = async ({ workflowId, runId, input }: { workflowId: string; runId: string; input: any }) => {
    try {
      const workflow = client.getWorkflow(workflowId);
      await workflow.start({ runId, triggerData: input || {} });
    } catch (error) {
      console.error('Error starting workflow run:', error);
      throw error;
    }
  };

  return { executeWorkflow, startWorkflowRun, createWorkflowRun, isExecutingWorkflow };
};

export const useWatchWorkflow = (baseUrl: string) => {
  const [isWatchingWorkflow, setIsWatchingWorkflow] = useState(false);
  const [watchResult, setWatchResult] = useState<WorkflowRunResult | null>(null);

  const watchWorkflow = async ({ workflowId, runId }: { workflowId: string; runId: string }) => {
    try {
      setIsWatchingWorkflow(true);
      const client = new MastraClient({
        baseUrl,
      });

      const workflow = client.getWorkflow(workflowId);

      workflow.watch({ runId }, record => {
        setWatchResult(record);
      });
    } catch (error) {
      console.error('Error watching workflow:', error);

      throw error;
    } finally {
      setIsWatchingWorkflow(false);
    }
  };

  return { watchWorkflow, isWatchingWorkflow, watchResult };
};

export const useResumeWorkflow = (baseUrl: string) => {
  const [isResumingWorkflow, setIsResumingWorkflow] = useState(false);

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
      const client = new MastraClient({
        baseUrl: baseUrl || '',
      });

      const response = await client.getWorkflow(workflowId).resume({ stepId, runId, context });

      return response;
    } catch (error) {
      console.error('Error resuming workflow:', error);
      throw error;
    } finally {
      setIsResumingWorkflow(false);
    }
  };

  return { resumeWorkflow, isResumingWorkflow };
};
