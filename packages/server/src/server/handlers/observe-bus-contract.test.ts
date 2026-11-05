import { Agent, isDurableAgentLike } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';
import { OBSERVE_AGENT_STREAM_ROUTE } from './agents';

async function setup(delivery: 'hook' | 'bus' | 'neither') {
  const agent = new Agent({
    id: 'observation-agent',
    name: 'Observation agent',
    instructions: 'Answer the user.',
    model: {
      specificationVersion: 'v2',
      provider: 'test',
      modelId: 'observation-model',
      supportedUrls: {},
      async doGenerate() {
        throw new Error('This model only supports streaming.');
      },
      doStream: async () => ({
        stream: new ReadableStream({
          start(controller) {
            for (const event of [
              { type: 'text-start', id: 'text' },
              { type: 'text-delta', id: 'text', delta: 'retained-answer' },
              { type: 'text-end', id: 'text' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1 } },
            ])
              controller.enqueue(event);
            controller.close();
          },
        }),
      }),
    },
  });
  const delegate = createDurableAgent({ agent });
  // Structural adapters may supply either delivery contract. Keep execution and
  // persisted ownership real, without the delegate's local ownership shortcut.
  const wrapper = new Proxy(delegate, {
    get(target, key) {
      if (['__getStreamBus', '__getRunOwner', '__getRunRecord', '__getPublishedRunOwner'].includes(String(key))) {
        return undefined;
      }
      if (key === 'pubsub' && delivery !== 'bus') return undefined;
      if (key === '__subscribeToRunStream' && delivery !== 'hook') return undefined;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const storage = new InMemoryStore();
  const transport = new EventEmitterPubSub();
  const mastra = new Mastra({ agents: { observation: wrapper }, storage, pubsub: transport, logger: false });
  const runId = crypto.randomUUID();
  const run = await wrapper.stream('Hello', {
    runId,
    memory: { resource: 'owner', thread: `thread-${runId}` },
  });
  await run.output.consumeStream();
  const workflows = await storage.getStore('workflows');
  const row = await workflows!.getWorkflowRunById({ workflowName: delegate.getDurableWorkflows()[0]!.id, runId });
  expect(row?.resourceId).toBe('owner');
  expect(isDurableAgentLike(wrapper)).toBe(true);
  return { wrapper, delegate, mastra, transport, runId };
}

function observe(mastra: Mastra, agentId: string, runId: string, resourceId = 'owner') {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
  return OBSERVE_AGENT_STREAM_ROUTE.handler({ mastra, agentId, runId, requestContext });
}

async function drain(stream: ReadableStream) {
  const events = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return events;
      events.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

describe('observe stream delivery contracts with persisted runs', () => {
  it.each(['hook', 'bus'] as const)(
    'replays through the publishing %s without guessing a global bus',
    async delivery => {
      const { wrapper, delegate, mastra, transport, runId } = await setup(delivery);
      const globalReplay = vi.spyOn(transport, 'subscribeWithReplay');
      const globalOffset = vi.spyOn(transport, 'subscribeFromOffset');
      const hook = vi.spyOn(delegate, '__subscribeToRunStream');

      await expect(observe(mastra, wrapper.id, runId, 'another-owner')).rejects.toMatchObject({ status: 403 });
      expect(hook).not.toHaveBeenCalled();
      const events = await drain(await observe(mastra, wrapper.id, runId));
      expect(JSON.stringify(events)).toContain('retained-answer');
      expect(events.filter(event => event.type === 'finish')).toHaveLength(1);
      expect(hook).toHaveBeenCalledTimes(delivery === 'hook' ? 1 : 0);
      expect(globalReplay).not.toHaveBeenCalled();
      expect(globalOffset).not.toHaveBeenCalled();
    },
  );

  it('rejects an authorized adapter with neither delivery contract before opening a stream', async () => {
    const { wrapper, mastra, transport, runId } = await setup('neither');
    const globalReplay = vi.spyOn(transport, 'subscribeWithReplay');
    const globalOffset = vi.spyOn(transport, 'subscribeFromOffset');
    const globalLive = vi.spyOn(transport, 'subscribe');

    await expect(observe(mastra, wrapper.id, runId, 'another-owner')).rejects.toMatchObject({ status: 403 });
    await expect(observe(mastra, wrapper.id, 'unknown-run')).rejects.toMatchObject({ status: 404 });
    await expect(observe(mastra, wrapper.id, runId)).rejects.toMatchObject({ status: 501 });
    expect(globalReplay).not.toHaveBeenCalled();
    expect(globalOffset).not.toHaveBeenCalled();
    expect(globalLive).not.toHaveBeenCalled();
  });
});
