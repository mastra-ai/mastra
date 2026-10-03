import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function makeTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('DurableAgent sendSignal idle wake', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('resolves accepted.output to the model output of the woken run', async () => {
    const agent = new Agent({
      id: 'durable-wake-agent',
      name: 'durable-wake-agent',
      instructions: 'You are helpful.',
      model: makeTextModel('The idle wake completed.'),
      memory: new MockMemory(),
    });
    const durableAgent = createDurableAgent({ agent, pubsub });

    const { accepted } = durableAgent.sendSignal(
      { type: 'notification', contents: 'A customer is waiting for a reply.' },
      { resourceId: 'wake-user', threadId: 'wake-thread', ifIdle: { behavior: 'wake' } },
    );

    const result = await accepted;
    if (result.action !== 'wake') throw new Error(`expected a wake, got ${result.action}`);
    expect(await result.output.text).toBe('The idle wake completed.');
  });

  it('resolves accepted.output to the model output when a local claimed owner runs the wake', async () => {
    const agent = new Agent({
      id: 'durable-owner-agent',
      name: 'durable-owner-agent',
      instructions: 'You are helpful.',
      model: makeTextModel('The claimed owner answered.'),
      memory: new MockMemory(),
    });
    const durableAgent = createDurableAgent({ agent, pubsub });
    const memory = { resource: 'owner-user', thread: 'owner-thread' };

    const claim = await durableAgent.claimThreadOwnership({
      resourceId: 'owner-user',
      threadId: 'owner-thread',
      streamOptions: { memory },
    });
    expect(claim.claimed).toBe(true);

    const { accepted } = durableAgent.sendSignal(
      { type: 'user-message', contents: 'wake the owner' },
      {
        resourceId: 'owner-user',
        threadId: 'owner-thread',
        ifIdle: { behavior: 'wake', streamOptions: { memory } },
      },
    );

    const result = await accepted;
    if (result.action !== 'wake') throw new Error(`expected a wake, got ${result.action}`);
    expect(await result.output.text).toBe('The claimed owner answered.');

    claim.unsubscribe();
  });
});
