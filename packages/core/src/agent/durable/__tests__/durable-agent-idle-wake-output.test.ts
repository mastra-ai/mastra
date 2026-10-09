import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function makeTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

describe('idle wake sendSignal accepted.output', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  async function wake(agent: Pick<Agent, 'sendSignal'>, threadId: string) {
    const result = agent.sendSignal(
      { type: 'user-message', contents: 'wake up' },
      { resourceId: 'user-1', threadId, ifIdle: { behavior: 'wake' } },
    );
    return result.accepted;
  }

  it('returns MastraModelOutput for a regular Agent', async () => {
    const agent = new Agent({
      id: 'regular-wake-agent',
      name: 'Regular Wake Agent',
      instructions: 'Test',
      model: makeTextModel('The idle wake completed.'),
      pubsub,
    });

    const accepted = await wake(agent, 'regular-thread');

    expect(accepted.action).toBe('wake');
    expect(accepted.output).toBeDefined();
    await expect(accepted.output!.text).resolves.toBe('The idle wake completed.');
  });

  it('returns MastraModelOutput (not the durable wrapper) for a DurableAgent', async () => {
    const agent = new Agent({
      id: 'durable-wake-agent',
      name: 'Durable Wake Agent',
      instructions: 'Test',
      model: makeTextModel('The idle wake completed.'),
    });
    const durableAgent = createDurableAgent({ agent, pubsub });

    const accepted = await wake(durableAgent, 'durable-thread');

    expect(accepted.action).toBe('wake');
    expect(accepted.output).toBeDefined();
    expect(accepted.output).not.toHaveProperty('cleanup');
    await expect(accepted.output!.text).resolves.toBe('The idle wake completed.');
  });
});
