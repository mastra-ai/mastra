import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { MASTRA_MESSAGE_AUTHOR_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function callerContext(id: string) {
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_MESSAGE_AUTHOR_KEY, { id });
  return requestContext;
}

/** A model whose streams stay open until `release()` is called for them, in order. */
function createGatedModel() {
  const gates: Array<() => void> = [];
  let started!: () => void;
  let nextStart = new Promise<void>(resolve => (started = resolve));
  const model = new MockLanguageModelV2({
    doStream: async () => {
      const gate = new Promise<void>(resolve => gates.push(resolve));
      started();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: new ReadableStream({
          async start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] });
            controller.enqueue({ type: 'text-start', id: 't1' });
            controller.enqueue({ type: 'text-delta', id: 't1', delta: 'ok' });
            await gate;
            controller.enqueue({ type: 'text-end', id: 't1' });
            controller.enqueue({
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
            });
            controller.close();
          },
        }),
      };
    },
  });
  return {
    model,
    waitForStream: () => nextStart,
    releaseAll: () => {
      nextStart = new Promise<void>(resolve => (started = resolve));
      gates.splice(0).forEach(release => release());
    },
  };
}

async function setup() {
  const storage = new InMemoryStore();
  const factoryCallers: string[] = [];
  const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
    factoryCallers.push((requestContext?.get(MASTRA_MESSAGE_AUTHOR_KEY) as { id: string } | undefined)?.id ?? 'none');
    return new MockMemory({ storage });
  });
  const gated = createGatedModel();
  const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: gated.model });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    resourceId: 'shared-resource',
    storage,
    memory: memoryFactory as any,
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent,
      },
    ],
  });
  await controller.init();
  const session = await controller.createSession({ id: 's', ownerId: 'o' });
  return { agent, session, factoryCallers, gated };
}

describe('Session collaboration across callers', () => {
  it("accepts Bob's message into Alice's active run without resolving memory with Bob's context", async () => {
    const { agent, session, factoryCallers, gated } = await setup();

    const alice = session.sendMessage({ content: 'from alice', requestContext: callerContext('alice') });
    await gated.waitForStream();
    expect(session.stream.isActive()).toBe(true);
    const runId = session.stream.activeRunId();
    factoryCallers.length = 0;

    const original = agent.sendSignal.bind(agent);
    let bobAccepted!: Promise<unknown>;
    vi.spyOn(agent, 'sendSignal').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const result = original(...args);
      bobAccepted = result.accepted;
      return result;
    });
    const bob = session.sendMessage({ content: 'from bob', requestContext: callerContext('bob') });
    const bobFailed = bob.then(
      () => new Promise<never>(() => {}),
      (error: unknown) => Promise.reject(error),
    );
    await Promise.race([vi.waitFor(() => expect(bobAccepted).toBeDefined()), bobFailed]);
    await expect(bobAccepted).resolves.toBeDefined();

    expect(session.stream.activeRunId()).toBe(runId);
    expect(factoryCallers).not.toContain('bob');

    await vi.waitFor(() => {
      gated.releaseAll();
      expect(session.stream.isActive()).toBe(false);
    });
    await expect(Promise.all([alice, bob])).resolves.toBeDefined();
  });

  it("resolves memory with Bob's context when his message starts the next run", async () => {
    const { session, factoryCallers, gated } = await setup();

    const alice = session.sendMessage({ content: 'from alice', requestContext: callerContext('alice') });
    await gated.waitForStream();
    gated.releaseAll();
    await alice;
    expect(session.stream.isActive()).toBe(false);
    factoryCallers.length = 0;

    const bob = session.sendMessage({ content: 'from bob', requestContext: callerContext('bob') });
    await gated.waitForStream();
    expect(factoryCallers).toContain('bob');
    expect(factoryCallers).not.toContain('alice');
    gated.releaseAll();
    await bob;
  });
});
