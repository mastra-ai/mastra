import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createTextStreamModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Hello' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

async function createController() {
  const agent = new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: createTextStreamModel(),
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

const TIMED_OUT = Symbol('timed out');

function settleWithin<T>(promise: Promise<T>, ms = 5_000): Promise<T | typeof TIMED_OUT> {
  return Promise.race([promise, new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), ms))]);
}

describe('Session.sendMessage settles', () => {
  it('settles every concurrent sendMessage on sessions sharing one thread', async () => {
    const { controller, session: first } = await createController();
    const threadId = first.thread.getId()!;
    const sessions = [first];
    for (let i = 0; i < 3; i++) {
      const session = await controller.createSession({ id: `session-${i}`, ownerId: `owner-${i}` });
      session.thread.set({ threadId });
      await session.thread.ensureCurrentSubscription();
      sessions.push(session);
    }

    const results = await settleWithin(
      Promise.allSettled(sessions.map((session, i) => session.sendMessage({ content: `message ${i}` }))),
    );
    expect(results).not.toBe(TIMED_OUT);
  });

  it('rejects when the stream consumer fails before the run ends', async () => {
    const { session } = await createController();
    const error = new Error('consumer blew up');
    vi.spyOn(session, 'processSubscribedThreadStream').mockRejectedValue(error);
    session.thread.cleanupSubscription();

    await expect(settleWithin(session.sendMessage({ content: 'hello' }))).rejects.toBe(error);
  });

  it('resolves when the subscription is torn down before the run ends', async () => {
    const { session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();

    const pending = session.sendMessage({ content: 'hello' });
    await new Promise(resolve => setTimeout(resolve, 50));
    session.stream.detach();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the run is aborted and agent_end never arrives', async () => {
    const { session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();

    const pending = session.sendMessage({ content: 'hello' });
    await new Promise(resolve => setTimeout(resolve, 50));
    session.abort();

    expect(await settleWithin(pending)).toBeUndefined();
  });
});
