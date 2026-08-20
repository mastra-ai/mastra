import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { assert, describe, expect, it } from 'vitest';
import { Observability } from './default';
import { TestExporter } from './exporters';

const mockModel = {
  specificationVersion: 'v2',
  provider: 'mock',
  modelId: 'mock',
  doGenerate: async () => ({
    content: [{ type: 'text', text: 'Hello from the agent' }],
    finishReason: 'stop',
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
  }),
} as any;

/**
 * End-to-end proof of the feedback capture lifecycle:
 * 1. Run an agent turn with memory + observability enabled.
 * 2. Read the trace linkage from the persisted assistant message metadata.
 * 3. Submit feedback twice with the same deterministic feedbackId (idempotent retry).
 * 4. List feedback by sourceId (= messageId) and confirm a single record.
 * 5. Delete feedback by traceId and confirm erasure.
 */
describe('feedback lifecycle end-to-end proof', () => {
  it('bridges message → trace, dedupes retries, filters by sourceId, and erases by traceId', async () => {
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });

    const agent = new Agent({
      id: 'proof-agent',
      name: 'Proof Agent',
      instructions: 'You are a test agent',
      model: mockModel,
      memory,
    });

    const mastra = new Mastra({
      logger: false,
      storage,
      observability: new Observability({
        configs: { test: { serviceName: 'feedback-e2e-proof', exporters: [new TestExporter()] } },
      }),
      agents: { agent },
    });

    // 1. Agent turn with memory persistence
    const result = await mastra
      .getAgent('agent')
      .generate('Say hello', { memory: { thread: 'thread-1', resource: 'resource-1' } });
    expect(result.traceId).toBeDefined();

    // 2. Message → trace bridge: assistant message metadata carries trace linkage
    const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'resource-1' });
    const assistantMessage = messages.find(m => m.role === 'assistant');
    assert(assistantMessage, 'expected a persisted assistant message');
    const traceMeta = (assistantMessage.content.metadata as any)?.mastra;
    expect(traceMeta?.traceId).toBe(result.traceId);
    expect(traceMeta?.agentRunSpanId).toBeDefined();

    const messageId = assistantMessage.id;
    const traceId = traceMeta.traceId as string;

    // 3. Idempotent feedback: submit twice with the same deterministic feedbackId
    const observability = storage.stores.observability;
    assert(observability, 'expected observability storage');
    const feedbackId = `thumbs-${messageId}-user-1`;
    for (const timestamp of [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:05Z')]) {
      await observability.createFeedback({
        feedback: {
          feedbackId,
          timestamp,
          traceId,
          spanId: traceMeta.agentRunSpanId,
          feedbackType: 'thumbs',
          feedbackSource: 'user',
          value: 1,
          sourceId: messageId,
        },
      });
    }

    // 4. List by sourceId (= messageId): retry produced a single record
    const listed = await observability.listFeedback({ filters: { sourceId: messageId } });
    expect(listed.feedback).toHaveLength(1);
    expect(listed.feedback[0]!.feedbackId).toBe(feedbackId);
    expect(listed.feedback[0]!.traceId).toBe(traceId);

    // 5. Erase by traceId and confirm deletion
    await observability.deleteFeedbackByTraceIds({ traceIds: [traceId] });
    const afterDelete = await observability.listFeedback({ filters: { sourceId: messageId } });
    expect(afterDelete.feedback).toHaveLength(0);
  });
});
