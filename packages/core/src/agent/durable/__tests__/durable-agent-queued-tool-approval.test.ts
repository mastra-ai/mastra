import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { DurableStepIds } from '../constants';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Engine = 'plain' | 'durable' | 'evented';
type ApprovalOrder = 'forward' | 'reverse' | 'concurrent';

function createTwoCallModel() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const toolResultIds = new Set<string>();
      const visit = (value: unknown) => {
        if (!value || typeof value !== 'object') return;
        if (
          'type' in value &&
          value.type === 'tool-result' &&
          'toolCallId' in value &&
          typeof value.toolCallId === 'string'
        ) {
          toolResultIds.add(value.toolCallId);
        }
        for (const nested of Object.values(value)) visit(nested);
      };
      visit(prompt);
      const parts =
        toolResultIds.size >= 2
          ? [
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'response-metadata' as const,
                id: 'final-response',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              { type: 'text-start' as const, id: 'final-text' },
              { type: 'text-delta' as const, id: 'final-text', delta: 'Both done.' },
              { type: 'text-end' as const, id: 'final-text' },
              { type: 'finish' as const, finishReason: 'stop' as const, usage },
            ]
          : [
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'response-metadata' as const,
                id: 'tool-call-response',
                modelId: 'mock-model-id',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-a',
                toolName: 'suspendingTool',
                input: JSON.stringify({ item: 'A' }),
                providerExecuted: false,
              },
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'call-b',
                toolName: 'suspendingTool',
                input: JSON.stringify({ item: 'B' }),
                providerExecuted: false,
              },
              { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
            ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(parts),
      };
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise.catch(cause => {
      throw new Error(`${label} failed`, { cause });
    }),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), 5_000);
    }),
  ]);
}

async function waitForSuspendedSnapshot(storage: InMemoryStore, runId: string) {
  let currentSnapshot: any;
  await vi.waitFor(
    async () => {
      const workflows = (await storage.getStore('workflows'))!;
      const persisted = await workflows.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
      currentSnapshot = typeof persisted?.snapshot === 'string' ? JSON.parse(persisted.snapshot) : persisted?.snapshot;
      expect(currentSnapshot?.status).toBe('suspended');
    },
    { timeout: 10_000 },
  );
  return currentSnapshot;
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
  globalRunRegistry.clear();
});

describe.each(['plain', 'durable', 'evented'] as const)('%s agent queued schema-less tool approvals', engine => {
  it.each(['forward', 'reverse', 'concurrent'] as const)(
    'processes both approvals in %s order',
    async order => {
      const pubsub = new EventEmitterPubSub();
      const storage = new InMemoryStore();
      const threadId = `${engine}-${order}-queued-approval-thread`;
      const resourceId = 'queued-approval-resource';
      const suspendingTool = createTool({
        id: 'suspendingTool',
        description: 'Suspends until resumed',
        inputSchema: z.object({ item: z.string() }),
        execute: async ({ item }, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend({ item });
          }
          return { item, resumed: true };
        },
      });
      const baseAgent = new Agent({
        id: `${engine}-queued-approval-agent`,
        name: `${engine} queued approval agent`,
        instructions: 'Run both tool calls.',
        model: createTwoCallModel() as LanguageModelV2,
        memory: new MockMemory(),
        tools: { suspendingTool },
      });
      const agent =
        engine === 'plain'
          ? baseAgent
          : engine === 'durable'
            ? createDurableAgent({ agent: baseAgent, pubsub })
            : createEventedAgent({ agent: baseAgent, pubsub });
      const mastra = new Mastra({ agents: { agent }, storage, logger: false });
      const registeredAgent = mastra.getAgent('agent');
      if (engine === 'evented') {
        expect((registeredAgent.getWorkflow() as any).engineType).toBe('evented');
      }

      const chunks: any[] = [];
      const subscription = await registeredAgent.subscribeToThread({ threadId, resourceId });
      const consumeSubscription = (async () => {
        for await (const chunk of subscription.stream) {
          chunks.push(chunk);
        }
      })();
      let initial: { runId: string; cleanup: () => void } | undefined;

      try {
        initial = await registeredAgent.stream('Run both tool calls.', {
          maxSteps: 6,
          memory: { thread: threadId, resource: resourceId },
        });

        await vi.waitFor(() => expect(chunks.filter(chunk => chunk.type === 'tool-call-suspended')).toHaveLength(2), {
          timeout: 10_000,
        });
        if (engine !== 'plain') {
          await waitForSuspendedSnapshot(storage, initial.runId);
        }

        const suspendedIds = chunks
          .filter(chunk => chunk.type === 'tool-call-suspended')
          .map(chunk => chunk.payload.toolCallId as string);
        const orderedIds = order === 'reverse' ? [...suspendedIds].reverse() : suspendedIds;
        const approve = (toolCallId: string) =>
          withTimeout(
            registeredAgent.sendToolApproval({
              threadId,
              resourceId,
              toolCallId,
              approved: true,
              resumeData: { confirmed: true },
            }),
            `${engine} ${order} approval ${toolCallId}`,
          );

        const approvals =
          order === 'concurrent'
            ? await Promise.all(orderedIds.map(approve))
            : [await approve(orderedIds[0]!), await approve(orderedIds[1]!)];
        expect(approvals.map(result => result.toolCallId)).toEqual(orderedIds);

        await vi.waitFor(
          () => {
            expect(
              new Set(
                chunks.filter(chunk => chunk.type === 'tool-result').map(chunk => chunk.payload.toolCallId as string),
              ),
            ).toEqual(new Set(['call-a', 'call-b']));
            expect(chunks.filter(chunk => chunk.type === 'tool-error' || chunk.type === 'error')).toEqual([]);
            expect(
              chunks
                .filter(chunk => chunk.type === 'text-delta')
                .map(chunk => chunk.payload.text)
                .join(''),
            ).toContain('Both done.');
            expect(chunks.some(chunk => chunk.type === 'finish' && chunk.payload.stepResult?.reason === 'stop')).toBe(
              true,
            );
          },
          { timeout: 10_000 },
        );
      } finally {
        if (typeof initial?.cleanup === 'function') initial.cleanup();
        subscription.unsubscribe();
        await consumeSubscription;
        await pubsub.close();
      }
    },
    30_000,
  );
});
