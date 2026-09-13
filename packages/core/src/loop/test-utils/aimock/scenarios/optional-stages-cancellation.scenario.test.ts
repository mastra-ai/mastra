import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../../../events';
import type { Mastra } from '../../../../mastra';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { DefaultExecutionEngine } from '../../../../workflows/default';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';

describe.each(['before-next-stage', 'before-terminal-publication'] as const)(
  'AIMock optional stages remote cancellation [%s]',
  schedule => {
    const getMock = useLoopScenarioAimock();

    it('honors a same-generation remote cancellation without local abort or continuation', async () => {
      const abortController = new AbortController();
      let sentinelExecutions = 0;
      const sentinel = createTool({
        id: 'cancellation-sentinel',
        description: 'Must not execute after the remote cancellation is observed.',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          sentinelExecutions++;
          return { value };
        },
      });
      const llm = getMock();
      const shared = await createSharedAgent(llm, { tools: { 'cancellation-sentinel': sentinel } });
      const mastra: Mastra = shared.mastra;
      const workflowsStore = await mastra.getStorage()?.getStore('workflows');
      if (!workflowsStore) throw new Error('AIMock agent did not create a workflows store');

      const runId = `optional-stages-remote-cancel-${schedule}`;
      let injected = 0;
      let authorityReads = 0;
      let canceledGeneration: string | undefined;
      let observedGeneration: string | undefined;
      let canceledObserved = false;
      let executionWorkflowRunId: string | undefined;
      let toolCallEmitted = false;
      const originalCompact = workflowsStore.getWorkflowExecutionState.bind(workflowsStore);
      const originalLoad = workflowsStore.loadWorkflowSnapshot.bind(workflowsStore);
      const originalPersist = workflowsStore.persistWorkflowSnapshot.bind(workflowsStore);
      const compact = vi.spyOn(workflowsStore, 'getWorkflowExecutionState').mockImplementation(async args => {
        const stack = new Error().stack ?? '';
        const authorityRead = stack.includes('getAuthoritativeExecutionDisposition');
        const executionState = await originalCompact(args);
        if (args.workflowName === 'executionWorkflow' && !executionWorkflowRunId) executionWorkflowRunId = args.runId;
        if (args.workflowName !== 'executionWorkflow' || args.runId !== executionWorkflowRunId || !executionState)
          return executionState;

        if (authorityRead) authorityReads++;
        const beforeNextStage =
          schedule === 'before-next-stage' &&
          authorityRead &&
          toolCallEmitted &&
          !stack.includes('isAuthoritativelyCanceled');
        const beforeTerminalPublication =
          schedule === 'before-terminal-publication' && stack.includes('isAuthoritativelyCanceled');
        if (injected > 0 || (!beforeNextStage && !beforeTerminalPublication)) return executionState;

        injected++;
        canceledGeneration = executionState.executionGeneration;
        const snapshot = await originalLoad(args);
        if (!snapshot) return executionState;
        await originalPersist({
          ...args,
          snapshot: { ...snapshot, status: 'canceled' },
        });
        const reread = await originalCompact(args);
        canceledObserved = reread?.status === 'canceled';
        observedGeneration = reread?.executionGeneration;
        return reread;
      });
      const published = vi.spyOn(EventEmitterPubSub.prototype, 'publish');
      const executions = vi.spyOn(DefaultExecutionEngine.prototype, 'execute');

      const previousEvented = process.env.MASTRA_EVENTED_EXECUTION;
      vi.stubEnv('MASTRA_EVENTED_EXECUTION', 'false');
      try {
        const fixtures =
          schedule === 'before-next-stage'
            ? (mock: typeof llm) => {
                mock.on(
                  { endpoint: 'chat', sequenceIndex: 0 },
                  {
                    toolCalls: [
                      {
                        id: 'call-cancellation-sentinel',
                        name: 'cancellation-sentinel',
                        arguments: { value: 'must-not-run' },
                      },
                    ],
                  },
                );
              }
            : (mock: typeof llm) => {
                mock.on({ endpoint: 'chat', sequenceIndex: 0 }, { content: 'terminal answer' });
              };
        const { requests } = await runLoopScenario({
          engine: 'normal',
          llm,
          sharedAgent: shared,
          runId,
          prompt: 'Exercise remote cancellation.',
          maxSteps: 4,
          stopWhen: stepCountIs(4),
          abortSignal: abortController.signal,
          onChunk: (chunk: ChunkType) => {
            // The stream exposes the model tool call before the tool step
            // starts, which is the observable boundary for this schedule.
            if (schedule === 'before-next-stage' && chunk.type === 'tool-call') toolCallEmitted = true;
          },
          fixtures,
        });

        expect(injected).toBe(1);
        expect(abortController.signal.aborted).toBe(false);
        expect(authorityReads).toBeGreaterThan(0);
        expect(requests).toHaveLength(1);
        expect(sentinelExecutions).toBe(0);
        expect(canceledGeneration).toBeTruthy();
        expect(observedGeneration).toBe(canceledGeneration);
        expect(canceledObserved).toBe(true);
        expect(executionWorkflowRunId).toBe(runId);
        const lifecycleEvents = published.mock.calls.flatMap(([, event]) => {
          if (!event || typeof event !== 'object' || !('data' in event)) return [];
          const data = event.data;
          if (!data || typeof data !== 'object' || !('event' in data)) return [];
          if (!('workflowId' in data) || data.workflowId !== 'executionWorkflow') return [];
          if (!('runId' in data) || data.runId !== executionWorkflowRunId) return [];
          if (!('executionGeneration' in data) || data.executionGeneration !== canceledGeneration) return [];
          return [data.event];
        });
        expect(lifecycleEvents).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ type: 'workflow.finished', status: 'success' })]),
        );
        const targetExecutions = executions.mock.calls.flatMap(([params], index) =>
          params.workflowId === 'executionWorkflow' && params.runId === executionWorkflowRunId
            ? [executions.mock.results[index]]
            : [],
        );
        expect(targetExecutions).toHaveLength(1);
        expect(targetExecutions[0]?.type).toBe('return');
        await expect(targetExecutions[0]?.value).resolves.toMatchObject({ status: 'canceled' });
        if (schedule === 'before-terminal-publication') {
          expect(lifecycleEvents).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ type: 'step.finished', stepId: 'signalDrainStep', status: 'success' }),
            ]),
          );
          expect(lifecycleEvents.filter(event => event.type === 'workflow.finished')).toEqual([
            expect.objectContaining({ type: 'workflow.finished', status: 'canceled' }),
          ]);
        }
      } finally {
        compact.mockRestore();
        published.mockRestore();
        executions.mockRestore();
        if (previousEvented === undefined) delete process.env.MASTRA_EVENTED_EXECUTION;
        else vi.stubEnv('MASTRA_EVENTED_EXECUTION', previousEvented);
        await mastra.shutdown();
      }
    });
  },
);
