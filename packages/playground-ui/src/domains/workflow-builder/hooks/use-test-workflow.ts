import { useCallback, useRef, useEffect } from 'react';
import { StreamVNextChunkType } from '@mastra/client-js';
import { useMastraClient, mapWorkflowStreamChunkToWatchResult } from '@mastra/react';
import { RequestContext } from '@mastra/core/request-context';
import { WorkflowStreamResult } from '@mastra/core/workflows';
import type { ReadableStreamDefaultReader } from 'stream/web';
import { useWorkflowBuilderStore } from '../store/workflow-builder-store';
import { useTestRunnerStore, type StepStatus } from '../store/test-runner-store';
import { serializeGraph } from '../utils/serialize';

/**
 * Hook to connect the workflow builder's test runner with actual workflow execution
 */
export function useTestWorkflow() {
  const client = useMastraClient();
  const readerRef = useRef<ReadableStreamDefaultReader<StreamVNextChunkType> | null>(null);
  const isMountedRef = useRef(true);

  // Get workflow builder state
  const workflowId = useWorkflowBuilderStore(state => state.workflowId);
  const nodes = useWorkflowBuilderStore(state => state.nodes);
  const edges = useWorkflowBuilderStore(state => state.edges);

  // Get test runner actions
  const startRun = useTestRunnerStore(state => state.startRun);
  const updateStepStatus = useTestRunnerStore(state => state.updateStepStatus);
  const completeRun = useTestRunnerStore(state => state.completeRun);
  const suspendRun = useTestRunnerStore(state => state.suspendRun);
  const resumeRun = useTestRunnerStore(state => state.resumeRun);
  const setShowInputModal = useTestRunnerStore(state => state.setShowInputModal);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch {
          // Reader might already be released
        }
        readerRef.current = null;
      }
    };
  }, []);

  /**
   * Map workflow stream status to test runner step status
   */
  const mapStepStatus = (status: string): StepStatus => {
    switch (status) {
      case 'running':
      case 'active':
        return 'running';
      case 'completed':
      case 'success':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'suspended':
      case 'waiting':
        return 'suspended';
      case 'skipped':
        return 'skipped';
      default:
        return 'pending';
    }
  };

  /**
   * Process stream chunks and update test runner state
   */
  const processStreamChunk = useCallback(
    (chunk: StreamVNextChunkType) => {
      if (!isMountedRef.current) return;

      switch (chunk.type) {
        case 'workflow-step-start': {
          const stepId = chunk.payload?.stepId;
          if (stepId) {
            updateStepStatus(stepId, {
              status: 'running',
              startedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'workflow-step-finish': {
          const stepId = chunk.payload?.stepId;
          const output = chunk.payload?.output;
          const status = chunk.payload?.status;
          if (stepId) {
            updateStepStatus(stepId, {
              status: mapStepStatus(status || 'completed'),
              output,
              completedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'workflow-step-error': {
          const stepId = chunk.payload?.stepId;
          const error = chunk.payload?.error;
          if (stepId) {
            updateStepStatus(stepId, {
              status: 'failed',
              error: typeof error === 'string' ? error : error?.message || 'Unknown error',
              completedAt: new Date().toISOString(),
            });
          }
          break;
        }

        case 'workflow-step-suspended': {
          const stepId = chunk.payload?.stepId;
          const payload = chunk.payload?.payload;
          const resumeSchema = chunk.payload?.resumeSchema;
          if (stepId) {
            updateStepStatus(stepId, {
              status: 'suspended',
            });
            suspendRun(stepId, payload, resumeSchema);
          }
          break;
        }

        case 'workflow-finish': {
          const status = chunk.payload?.workflowStatus;
          const output = chunk.payload?.output;
          const error = chunk.payload?.metadata?.errorMessage;

          if (status === 'failed') {
            completeRun(output, error || 'Workflow execution failed');
          } else if (status === 'suspended') {
            // Already handled in workflow-step-suspended
          } else {
            completeRun(output);
          }
          break;
        }
      }
    },
    [updateStepStatus, completeRun, suspendRun],
  );

  /**
   * Run the workflow with given input
   */
  const runTest = useCallback(
    async (input: Record<string, unknown>) => {
      if (!workflowId) {
        throw new Error('No workflow ID');
      }

      // Clean up any existing reader
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch {
          // Ignore
        }
        readerRef.current = null;
      }

      // Start the run in test runner store
      startRun(workflowId, input);

      try {
        // Create and stream the workflow
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({});
        const stream = await run.stream({
          inputData: input,
          closeOnSuspend: true,
          perStep: true, // Get per-step updates for better UI feedback
        });

        if (!stream) {
          throw new Error('No stream returned from workflow');
        }

        // Get reader and process stream
        const reader = stream.getReader();
        readerRef.current = reader;

        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          processStreamChunk(value);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        completeRun(undefined, errorMessage);
      } finally {
        if (readerRef.current) {
          try {
            readerRef.current.releaseLock();
          } catch {
            // Ignore
          }
          readerRef.current = null;
        }
      }
    },
    [workflowId, client, startRun, processStreamChunk, completeRun],
  );

  /**
   * Resume a suspended workflow
   */
  const resumeTest = useCallback(
    async (resumeInput: Record<string, unknown>) => {
      const currentRun = useTestRunnerStore.getState().currentRun;
      if (!workflowId || !currentRun?.suspend) {
        throw new Error('No suspended workflow to resume');
      }

      // Clean up any existing reader
      if (readerRef.current) {
        try {
          readerRef.current.releaseLock();
        } catch {
          // Ignore
        }
        readerRef.current = null;
      }

      // Update store to running state
      resumeRun(resumeInput);

      try {
        const workflow = client.getWorkflow(workflowId);
        const run = await workflow.createRun({ runId: currentRun.runId });
        const stream = await run.resumeStream({
          step: currentRun.suspend.stepId,
          resumeData: resumeInput,
          perStep: true,
        });

        if (!stream) {
          throw new Error('No stream returned from workflow resume');
        }

        const reader = stream.getReader();
        readerRef.current = reader;

        while (true) {
          if (!isMountedRef.current) break;

          const { done, value } = await reader.read();
          if (done) break;

          processStreamChunk(value);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        completeRun(undefined, errorMessage);
      } finally {
        if (readerRef.current) {
          try {
            readerRef.current.releaseLock();
          } catch {
            // Ignore
          }
          readerRef.current = null;
        }
      }
    },
    [workflowId, client, resumeRun, processStreamChunk, completeRun],
  );

  /**
   * Cancel the current workflow run
   */
  const cancelTest = useCallback(async () => {
    // Release the stream reader to stop receiving updates
    if (readerRef.current) {
      try {
        readerRef.current.releaseLock();
      } catch {
        // Ignore
      }
      readerRef.current = null;
    }

    // The cancelRun action in the store will update the UI
    useTestRunnerStore.getState().cancelRun();
  }, []);

  /**
   * Open the input modal to start a test
   */
  const startTest = useCallback(() => {
    setShowInputModal(true);
  }, [setShowInputModal]);

  return {
    runTest,
    resumeTest,
    cancelTest,
    startTest,
  };
}
