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
  return { agent, controller, session };
}

/** Resolves once the runtime has accepted the next signal sent through `agent`. */
function onNextAcceptance(agent: Agent): Promise<void> {
  const original = agent.sendSignal.bind(agent);
  return new Promise(resolve => {
    vi.spyOn(agent, 'sendSignal').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const result = original(...args);
      void result.accepted.then(() => setTimeout(resolve, 0));
      return result;
    });
  });
}

const TIMED_OUT = Symbol('timed out');

function settleWithin<T>(promise: Promise<T>, ms = 5_000): Promise<T | typeof TIMED_OUT> {
  return Promise.race([promise, new Promise<typeof TIMED_OUT>(resolve => setTimeout(() => resolve(TIMED_OUT), ms))]);
}

describe('Session.sendMessage settles', () => {
  it('settles every concurrent sendMessage on sessions sharing one thread', async () => {
    const { agent, controller, session: first } = await createController();
    const threadId = first.thread.getId()!;
    const sessions = [first];
    for (let i = 0; i < 3; i++) {
      const session = await controller.createSession({
        id: `session-${i}`,
        ownerId: `owner-${i}`,
        scope: `scope-${i}`,
      });
      session.thread.set({ threadId });
      await session.thread.ensureCurrentSubscription();
      sessions.push(session);
    }

    const original = agent.sendSignal.bind(agent);
    let acceptedCount = 0;
    vi.spyOn(agent, 'sendSignal').mockImplementation((...args: Parameters<typeof original>) => {
      const result = original(...args);
      void result.accepted.then(() => acceptedCount++);
      return result;
    });

    const results = await settleWithin(
      Promise.allSettled(sessions.map((session, i) => session.sendMessage({ content: `message ${i}` }))),
    );
    expect(results).not.toBe(TIMED_OUT);
    expect((results as PromiseSettledResult<void>[]).map(result => result.status)).toEqual(
      sessions.map(() => 'fulfilled'),
    );
    expect(acceptedCount).toBe(sessions.length);
  });

  it('rejects when the stream consumer fails before the run ends', async () => {
    const { session } = await createController();
    const error = new Error('consumer blew up');
    vi.spyOn(session, 'processSubscribedThreadStream').mockRejectedValue(error);
    session.thread.cleanupSubscription();

    await expect(settleWithin(session.sendMessage({ content: 'hello' }))).rejects.toBe(error);
  });

  it('opens a fresh subscription for the next send after the consumer fails', async () => {
    const { agent, session } = await createController();
    const error = new Error('consumer blew up');
    const consume = vi
      .spyOn(session, 'processSubscribedThreadStream')
      .mockRejectedValueOnce(error)
      .mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();
    await expect(settleWithin(session.sendMessage({ content: 'first' }))).rejects.toBe(error);

    const accepted = onNextAcceptance(agent);
    const pending = session.sendMessage({ content: 'second' });
    await accepted;
    expect(consume).toHaveBeenCalledTimes(2);
    session.abort();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the subscription is torn down before the run ends', async () => {
    const { agent, session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();
    const accepted = onNextAcceptance(agent);

    const pending = session.sendMessage({ content: 'hello' });
    await accepted;
    session.stream.detach();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the session switches threads while acceptance is pending', async () => {
    const { agent, session } = await createController();
    const originalThreadId = session.thread.getId()!;
    const other = await session.thread.create({ title: 'other' });
    await session.thread.switch({ threadId: originalThreadId });
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();

    let releaseAcceptance!: () => void;
    const gate = new Promise<void>(resolve => (releaseAcceptance = resolve));
    const original = agent.sendSignal.bind(agent);
    let signalSent!: () => void;
    const sent = new Promise<void>(resolve => (signalSent = resolve));
    vi.spyOn(agent, 'sendSignal').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const result = original(...args);
      signalSent();
      return { ...result, accepted: gate.then(() => result.accepted) };
    });

    const pending = session.sendMessage({ content: 'hello' });
    await sent;
    await session.thread.switch({ threadId: other.id });
    await session.thread.ensureCurrentSubscription();
    expect(session.stream.isOpen()).toBe(true);
    releaseAcceptance();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the run is aborted while acceptance is pending', async () => {
    const { agent, session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();

    let releaseAcceptance!: () => void;
    const gate = new Promise<void>(resolve => (releaseAcceptance = resolve));
    const original = agent.sendSignal.bind(agent);
    let signalSent!: () => void;
    const sent = new Promise<void>(resolve => (signalSent = resolve));
    vi.spyOn(agent, 'sendSignal').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const result = original(...args);
      signalSent();
      return { ...result, accepted: gate.then(() => result.accepted) };
    });

    const pending = session.sendMessage({ content: 'hello' });
    await sent;
    session.abort();
    releaseAcceptance();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the run is aborted after a stale abort clears during acceptance', async () => {
    const { agent, session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();

    let releaseAcceptance!: () => void;
    const gate = new Promise<void>(resolve => (releaseAcceptance = resolve));
    const original = agent.sendSignal.bind(agent);
    let signalSent!: () => void;
    const sent = new Promise<void>(resolve => (signalSent = resolve));
    vi.spyOn(agent, 'sendSignal').mockImplementationOnce((...args: Parameters<typeof original>) => {
      const result = original(...args);
      signalSent();
      return { ...result, accepted: gate.then(() => result.accepted) };
    });

    // An earlier run's abort is still flagged when this send starts.
    session.run.requestAbort();
    const pending = session.sendMessage({ content: 'hello' });
    await sent;
    session.run.clearAbortRequested();
    session.abort();
    releaseAcceptance();

    expect(await settleWithin(pending)).toBeUndefined();
  });

  it('resolves when the run is aborted and agent_end never arrives', async () => {
    const { agent, session } = await createController();
    vi.spyOn(session, 'processSubscribedThreadStream').mockReturnValue(new Promise(() => {}));
    session.thread.cleanupSubscription();
    const accepted = onNextAcceptance(agent);

    const pending = session.sendMessage({ content: 'hello' });
    await accepted;
    session.abort();

    expect(await settleWithin(pending)).toBeUndefined();
  });
});
