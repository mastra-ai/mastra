import { randomUUID } from 'node:crypto';
import { MessageList } from '@mastra/core/agent';
import { AgentStreamEventTypes, globalRunRegistry } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { PUBSUB_SYMBOL } from '@mastra/core/workflows/_constants';
import { Inngest } from 'inngest';
import { describe, expect, it, vi } from 'vitest';
import { createInngestDurableAgenticWorkflow } from './durable-agent/create-inngest-agentic-workflow';
import { InngestExecutionEngine } from './execution-engine';

describe('actual durable agent final-output map', () => {
  it.each(['healthy', 'tripwire', 'error', 'empty'] as const)(
    'preserves the final processor result through SDK serialization: %s',
    async outcome => {
      const runId = randomUUID();
      const messageList = new MessageList();
      messageList.add({ role: 'assistant', content: 'Original answer.' }, 'response');
      const outputCheck = vi.fn(({ abort, messageList: messages }) => {
        if (outcome === 'tripwire') abort('Final output blocked', { retry: true, metadata: { policy: 'actual-map' } });
        if (outcome === 'error') throw new Error('Output save failed');
        if (outcome === 'empty') return [];
        return messages;
      });
      globalRunRegistry.set(runId, {
        messageList,
        tools: {},
        model: undefined,
        inputProcessors: [],
        outputProcessors: [{ id: 'actual-final-check', processOutputResult: outputCheck }],
      } as any);
      const inngest = new Inngest({ id: 'actual-final-output-map', isDev: true });
      const workflow = createInngestDurableAgenticWorkflow({ inngest });
      const mapFinalOutput = (workflow.executionGraph.steps as any[]).find(
        entry => entry.id === 'map-final-output',
      )?.mapConfig;
      expect(mapFinalOutput).toBeTypeOf('function');
      const pubsub = new EventEmitterPubSub();
      const publish = vi.spyOn(pubsub, 'publish');
      const memo = new Map<string, { ok: true; value: unknown } | { ok: false; value: string }>();
      const sdkStep = {
        run: vi.fn(async (id: string, fn: () => Promise<unknown>) => {
          let saved = memo.get(id);
          if (!saved) {
            try {
              const value = await fn();
              saved = { ok: true, value: value === undefined ? undefined : JSON.parse(JSON.stringify(value)) };
            } catch (error) {
              if (!(error instanceof Error)) throw error;
              saved = {
                ok: false,
                value: JSON.stringify({
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                  cause: error.cause,
                }),
              };
            }
            memo.set(id, saved);
          }
          if (!saved.ok) throw Object.assign(new Error(), JSON.parse(saved.value));
          return saved.value;
        }),
        sleep: vi.fn(),
        sleepUntil: vi.fn(),
      };
      const engine = new InngestExecutionEngine(undefined as any, sdkStep as any, 0, {});
      const initData = { runId, agentId: 'actual-map-agent', state: {}, messageListState: messageList.serialize() };
      const state = {
        runId,
        messageId: 'answer',
        messageListState: messageList.serialize(),
        state: {},
        accumulatedSteps: [{ text: 'Original answer.' }],
        lastStepResult: { reason: 'stop', isContinued: false, warnings: [] },
        accumulatedUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      };
      const execute = () =>
        engine.executeStepWithRetry(
          'map-final-output',
          () =>
            mapFinalOutput({
              inputData: state,
              getInitData: () => initData,
              engine: engine.getEngineContext(),
              [PUBSUB_SYMBOL]: pubsub,
            }),
          { retries: 0, delay: 0, workflowId: workflow.id, runId },
        );
      try {
        const result = await execute();
        const replay = await execute();
        expect(outputCheck).toHaveBeenCalledOnce();
        expect(replay).toEqual(result);
        const finishes = publish.mock.calls.filter(([, event]) => event.type === AgentStreamEventTypes.FINISH);
        if (outcome === 'tripwire') {
          expect(result).toMatchObject({
            ok: false,
            error: {
              status: 'failed',
              tripwire: {
                reason: 'Final output blocked',
                retry: true,
                metadata: { policy: 'actual-map' },
                processorId: 'actual-final-check',
              },
            },
          });
          expect(finishes).toHaveLength(0);
        } else if (outcome === 'error') {
          expect(result).toMatchObject({ ok: false, error: { error: { message: 'Output save failed' } } });
          expect(finishes).toHaveLength(0);
        } else {
          expect(result).toMatchObject({
            ok: true,
            result: { output: { text: outcome === 'empty' ? '' : 'Original answer.' } },
          });
          expect(finishes).toHaveLength(1);
        }
      } finally {
        globalRunRegistry.delete(runId);
        await pubsub.close();
      }
    },
  );
});
