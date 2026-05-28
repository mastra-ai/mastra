/**
 * Verifies that `signal.providerOptions.mastra.*` survives onto the transient
 * `data-${type}` chunk that subscribed-thread consumers see.
 *
 * This is the channel AgentChannels uses to decide whether to broadcast a
 * heartbeat-triggered run to the underlying chat platform. We use
 * `providerOptions` (not `attributes`) because `attributes` is serialized as
 * XML attributes on the signal tag and IS shown to the LLM, while
 * `providerOptions.mastra.*` is out-of-band metadata that is stripped before
 * the model sees the request.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { Agent } from '../agent';

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

async function readWholeRun(iterator: AsyncIterator<any>) {
  const parts: any[] = [];
  while (true) {
    const next = await iterator.next();
    if (next.done) return parts;
    parts.push(next.value);
    if (next.value.type === 'finish' || next.value.type === 'error' || next.value.type === 'abort') {
      return parts;
    }
  }
}

describe('signal providerOptions on subscribed thread chunks', () => {
  it('surfaces signal.providerOptions.mastra.heartbeat on the transient data-user-message chunk', async () => {
    const agent = new Agent({
      id: 'heartbeat-provider-options-agent',
      name: 'Heartbeat Provider Options Agent',
      instructions: 'test',
      model: createTextStreamModel('hello from heartbeat'),
      memory: new MockMemory(),
    });
    new Mastra({ logger: false, agents: { agent } });

    const resourceId = 'hb-resource';
    const threadId = 'hb-thread';

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const iterator = subscription.stream[Symbol.asyncIterator]();
    const runPromise = readWholeRun(iterator);

    const heartbeatMetadata = {
      broadcast: 'on-complete' as const,
      scheduleId: 'hb_agent_thread',
    };

    agent.sendSignal(
      {
        type: 'user-message',
        contents: 'tick',
        providerOptions: { mastra: { heartbeat: heartbeatMetadata } },
      },
      {
        resourceId,
        threadId,
        ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
      },
    );

    const parts = await runPromise;

    // The transient data-user-message chunk arrives near the start of the
    // run, BEFORE any text-delta — AgentChannels can detect heartbeat runs
    // eagerly and gate every subsequent chunk for the run.
    const dataUserMessageIndex = parts.findIndex(p => p.type === 'data-user-message');
    const firstTextDeltaIndex = parts.findIndex(p => p.type === 'text-delta');
    expect(dataUserMessageIndex).toBeGreaterThanOrEqual(0);
    expect(firstTextDeltaIndex).toBeGreaterThan(dataUserMessageIndex);

    const signalPart = parts[dataUserMessageIndex];
    expect(signalPart.transient).toBe(true);
    expect(signalPart.data?.providerOptions?.mastra?.heartbeat).toMatchObject(heartbeatMetadata);

    subscription.unsubscribe();
  });
});
