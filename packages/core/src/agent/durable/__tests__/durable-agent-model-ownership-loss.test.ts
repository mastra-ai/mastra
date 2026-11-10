import { APICallError } from '@ai-sdk/provider-v5';
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  DurableExecutionFenceError,
  ExecutionFence,
  __resetExecutionFencesForTests,
  executionLeaseKey,
  resolveLeaseProvider,
} from '../execution-fence';
import { globalRunRegistry } from '../run-registry';

const THREAD = 'model-ownership-thread';
const RESOURCE = 'model-ownership-resource';
const STALE_TEXT = 'partial output from superseded provider';

function answer(text: string) {
  return {
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'text-start' as const, id: 'answer' },
      { type: 'text-delta' as const, id: 'answer', delta: text },
      { type: 'text-end' as const, id: 'answer' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]),
    rawCall: { rawPrompt: null, rawSettings: {} },
  };
}

describe.each(['storage', 'lease'] as const)('model ownership loss with %s ownership (COR-1473)', backend => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    __resetExecutionFencesForTests();
    globalRunRegistry.clear();
    vi.restoreAllMocks();
    await pubsub.close();
  });

  it.each(['durable', 'evented'] as const)(
    '%s aborts the provider and does not retry, fall back, or persist its partial answer',
    async kind => {
      const storage = new InMemoryStore();
      if (backend === 'lease') vi.spyOn(storage.stores.workflows!, 'supportsRunFencing').mockReturnValue(false);
      const memory = new MockMemory({ storage });
      let providerSignal: AbortSignal | undefined;
      let primaryCalls = 0;
      const normalizedErrors: APICallError[] = [];
      let stopProvider!: () => void;
      const primary = new MockLanguageModelV2({
        doStream: async ({ abortSignal }) => {
          primaryCalls++;
          if (primaryCalls > 1) return answer('recovered answer');
          providerSignal = abortSignal;
          return {
            stream: new ReadableStream({
              start(controller) {
                controller.enqueue({ type: 'stream-start', warnings: [] });
                controller.enqueue({ type: 'text-start', id: 'stale' });
                controller.enqueue({ type: 'text-delta', id: 'stale', delta: STALE_TEXT });
                stopProvider = () => {
                  const error = new APICallError({
                    message: 'Provider normalized cancellation into a retryable transport failure',
                    url: '',
                    requestBodyValues: {},
                    statusCode: 503,
                    isRetryable: true,
                  });
                  normalizedErrors.push(error);
                  controller.error(error);
                };
                abortSignal?.addEventListener('abort', stopProvider, { once: true });
              },
            }),
            rawCall: { rawPrompt: null, rawSettings: {} },
          };
        },
      });
      const fallbackCall = vi.fn(async () => answer('fallback must not run'));
      const fallback = new MockLanguageModelV2({ doStream: fallbackCall });
      const base = new Agent({
        id: 'model-ownership-agent',
        name: 'Model Ownership Agent',
        instructions: 'Answer the question.',
        memory,
        errorProcessorDefaults: false,
        model: [
          { id: 'primary', model: primary as LanguageModelV2, maxRetries: 2 },
          { id: 'fallback', model: fallback as LanguageModelV2, maxRetries: 2 },
        ],
      });
      const agent =
        kind === 'durable' ? createDurableAgent({ agent: base, pubsub }) : createEventedAgent({ agent: base });
      new Mastra({
        agents: { 'model-ownership-agent': agent as any },
        logger: false,
        storage,
        pubsub,
        recovery: { durableAgents: 'auto' },
      });
      const cancellations: string[] = [];
      const publish = pubsub.publish.bind(pubsub);
      vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event, options) => {
        if (event.type === 'workflow.cancel') cancellations.push(event.runId);
        return publish(topic, event, options);
      });
      const started = await agent.stream('Give me an answer.', {
        memory: { thread: THREAD, resource: RESOURCE },
      });
      const chunks: unknown[] = [];
      const reader = started.fullStream.getReader();
      const reading = (async () => {
        try {
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } catch {
          // The superseded caller may be rejected; the replacement must not be.
        }
      })();
      try {
        await vi.waitFor(() => expect(JSON.stringify(chunks)).toContain(STALE_TEXT));
        expect(providerSignal).toBeInstanceOf(AbortSignal);
        expect(providerSignal!.aborted).toBe(false);
        const fence = ExecutionFence.getLocalActive(started.runId)!;
        expect(fence).toBeDefined();
        const foreignOwner = 'replacement-execution';
        if (backend === 'storage') {
          const claim = await storage.stores.workflows!.claimRunOwnership({
            runId: started.runId,
            ownerId: foreignOwner,
            force: true,
            leaseMs: 60_000,
          });
          expect(claim.acquired).toBe(true);
          expect(
            await storage.stores.memory!.raiseRunFence({
              runId: started.runId,
              ownerId: foreignOwner,
              generation: claim.record!.generation,
            }),
          ).toBe(true);
        } else {
          expect(
            await resolveLeaseProvider(agent.pubsub).transferLease(
              executionLeaseKey(fence.agentId, started.runId),
              fence.executionId,
              foreignOwner,
              60_000,
            ),
          ).toBe(true);
        }
        await expect(fence.verify()).rejects.toBeInstanceOf(DurableExecutionFenceError);
        await vi.waitFor(() => expect(providerSignal!.aborted).toBe(true));
        expect(providerSignal!.reason).toBeInstanceOf(DurableExecutionFenceError);
        await fence.whenSettled;
        expect(normalizedErrors).toHaveLength(1);
        expect(normalizedErrors[0]!.isRetryable).toBe(true);
        expect(primaryCalls).toBe(1);
        expect(fallbackCall).not.toHaveBeenCalled();
        const beforeRecovery = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
        expect(JSON.stringify(beforeRecovery.messages.filter(message => message.role === 'assistant'))).not.toContain(
          STALE_TEXT,
        );
        expect(cancellations).toEqual([]);
        if (backend === 'storage') {
          expect((await storage.stores.workflows!.getRunOwnership({ runId: started.runId }))!.ownerId).toBe(
            foreignOwner,
          );
        } else {
          expect(
            await resolveLeaseProvider(agent.pubsub).getLeaseOwner(executionLeaseKey(fence.agentId, started.runId)),
          ).toBe(foreignOwner);
        }

        const recovered = await agent.recover(started.runId, { force: true });
        try {
          const recoveryFence = ExecutionFence.getLocalActive(started.runId)!;
          const recoveredChunks: any[] = [];
          for await (const chunk of recovered.fullStream) recoveredChunks.push(chunk);
          await recoveryFence.whenSettled;
          expect(recoveredChunks.some(chunk => chunk.type === 'error')).toBe(false);
          expect(recoveredChunks.some(chunk => chunk.type === 'finish')).toBe(true);
          expect(primaryCalls).toBe(2);
          expect(fallbackCall).not.toHaveBeenCalled();
          const afterRecovery = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
          const assistant = JSON.stringify(afterRecovery.messages.filter(message => message.role === 'assistant'));
          expect(assistant).toContain('recovered answer');
          expect(assistant).not.toContain(STALE_TEXT);
        } finally {
          recovered.cleanup();
        }
      } finally {
        providerSignal?.removeEventListener('abort', stopProvider);
        await reader.cancel().catch(() => {});
        await reading;
        started.cleanup();
      }
    },
  );
});
