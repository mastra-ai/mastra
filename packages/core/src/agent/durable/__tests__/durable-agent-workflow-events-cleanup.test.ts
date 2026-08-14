/**
 * Regression for #20786.
 *
 * Durable agents run on the default workflow engine, so the evented engine's
 * terminal `workflow.events.v2.<runId>` cleanup never fires. Terminal durable
 * cleanup must clear that topic itself (alongside `agent.stream.<runId>`),
 * otherwise a persistent CachingPubSub orphans a no-TTL counter key per run.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { AGENT_STREAM_TOPIC } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

describe('DurableAgent workflow.events.v2 topic cleanup (#20786)', () => {
  it('clears workflow.events.v2.<runId> when cleanup() runs', async () => {
    const pubsub = new EventEmitterPubSub();

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'hi' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      }),
    });

    const baseAgent = new Agent({
      id: 'cleanup-agent',
      name: 'Cleanup Agent',
      instructions: 'test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({
      agent: baseAgent,
      pubsub,
      cleanupTimeoutMs: 0,
    });

    // Spy the agent-facing pubsub (CachingPubSub wrapper), which is what
    // #clearPubsubTopic calls — not the inner EventEmitterPubSub alone.
    const clearTopic = vi.spyOn(durableAgent.pubsub, 'clearTopic');

    const { runId, cleanup } = await durableAgent.stream('hi');
    // cleanup() is what #clearPubsubTopic is wired through; no need to drain.
    cleanup();

    expect(clearTopic).toHaveBeenCalledWith(AGENT_STREAM_TOPIC(runId));
    expect(clearTopic).toHaveBeenCalledWith(`workflow.events.v2.${runId}`);

    await pubsub.close();
  });
});
