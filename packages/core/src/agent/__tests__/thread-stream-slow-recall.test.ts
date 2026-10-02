/**
 * `subscribeToThread({ withInitialHistory })` when the run keeps streaming,
 * finishes and saves while history is still being recalled: the saved parts
 * are in the `thread-history` chunk and must not be sent again after it.
 */
import { afterEach, expect, it } from 'vitest';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { MockLanguageModelV2 } from './mock-model';
import { LeasePubSub, nextTicks } from './thread-stream-test-utils';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const threadId = 'slow-recall-thread';
const resourceId = 'slow-recall-user';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

class SlowRecallMemory extends MockMemory {
  gate?: Promise<void>;
  recallStarted = deferred();

  override async recall(...args: Parameters<MockMemory['recall']>) {
    if (this.gate) {
      this.recallStarted.resolve();
      await this.gate;
    }
    return super.recall(...args);
  }
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

it('parts saved while history is being recalled are not sent again', async () => {
  const midStream = deferred();
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        async start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'response-metadata', id: 'r', modelId: 'mock', timestamp: new Date(0) });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'a0 ' });
          await midStream.promise;
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'a1 ' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'a2 ' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
          controller.close();
        },
      }),
    }),
  });
  const pubsub = new LeasePubSub();
  pubsub.retain = true;
  const memory = new SlowRecallMemory();
  const mastra = new Mastra({
    agents: { agent: new Agent({ id: 'slow-recall', name: 'Slow Recall', instructions: 'test', model, memory }) },
    storage: new InMemoryStore(),
    logger: false,
    pubsub,
  });
  const agent = mastra.getAgent('agent');

  const output = await agent.stream('go', { memory: { thread: threadId, resource: resourceId } });
  const run = (async () => {
    for await (const _ of output.fullStream);
    await nextTicks(20);
  })();
  await nextTicks(20);

  const recallGate = deferred();
  memory.gate = recallGate.promise;
  const chunks: any[] = [];
  const joined = (async () => {
    const subscription = await agent.subscribeToThread({ threadId, resourceId, withInitialHistory: true });
    const consumed = (async () => {
      for await (const chunk of subscription.stream) chunks.push(chunk);
    })();
    await nextTicks(20);
    subscription.unsubscribe();
    await consumed;
  })();

  await memory.recallStarted.promise;
  midStream.resolve();
  await run;
  recallGate.resolve();
  await joined;

  expect(chunks[0].type).toBe('thread-history');
  const historyText = chunks[0].payload.messages
    .filter((m: any) => m.role === 'assistant')
    .flatMap((m: any) => m.content?.parts ?? [])
    .filter((p: any) => p.type === 'text')
    .map((p: any) => p.text)
    .join('');
  expect(historyText).toBe('a0 a1 a2 ');
  expect(chunks.slice(1).map(c => c.type)).not.toContain('text-delta');
});
