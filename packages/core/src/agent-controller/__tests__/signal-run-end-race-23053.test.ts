/**
 * Regression tests for #23053: a signal sent while a run is finishing must still
 * start its wake run with the session's request context.
 *
 * `Session.sendSignal` decides "this run is active" before it routes the signal.
 * If the run ends in between, the agent wakes the thread with the call's `ifIdle`.
 * The active branch used to pass no stream options, so the woken run had no
 * `controller` request context and a model resolver that depends on it (Mastra
 * Code's `getDynamicModel`) threw "No model available". Factory retried the
 * dispatch on the same session and lost the same race every time.
 *
 * The model is a gated `MastraLanguageModelV2Mock` rather than aimock: the race
 * needs a run that is provably in flight when the session reads its state and
 * provably gone when the agent routes the signal, which requires holding the
 * provider stream open at an exact point.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import type { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function textStream(delta: string, gate?: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta });
      await gate;
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

function waitFor(check: () => boolean, label: string, timeoutMs = 5_000) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const poll = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error(`timed out waiting for ${label}`));
      setTimeout(poll, 10);
    };
    poll();
  });
}

async function createHarness(id: string) {
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });

  // One entry per model resolution (several per run): whether it saw the controller context.
  const modelResolutions: boolean[] = [];
  let streamCalls = 0;
  const model = new MastraLanguageModelV2Mock({
    doStream: async () => {
      streamCalls++;
      return { stream: streamCalls === 1 ? textStream('first reply', firstGate) : textStream('second reply') };
    },
  });

  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You reply to the user.',
    // Mirrors Mastra Code's resolver: the model comes from the controller session.
    model: ({ requestContext }: { requestContext: RequestContext }) => {
      const hasController = requestContext.get('controller') !== undefined;
      modelResolutions.push(hasController);
      if (!hasController) {
        throw new Error('No model available: this run started without a controller session context');
      }
      return model;
    },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe((event: AgentControllerEvent) => {
    events.push(event);
  });
  const count = (type: AgentControllerEvent['type']) => events.filter(event => event.type === type).length;

  /**
   * Start a run, then send `send()` while it is in flight but let the run finish
   * before the session routes the signal to the agent.
   */
  async function sendAcrossRunEnd<T>(send: () => T): Promise<T> {
    void session.sendMessage({ content: 'first message' }).catch(() => {});
    await waitFor(() => streamCalls === 1, 'the first model call');
    expect(session.run.isRunning()).toBe(true);

    // The session prepares the thread subscription right before routing. Finish
    // the first run there, so the session has already chosen its active branch.
    const ensureSubscription = session.thread.ensureSubscription.bind(session.thread);
    let raced = false;
    vi.spyOn(session.thread, 'ensureSubscription').mockImplementation(async (...args) => {
      if (!raced) {
        raced = true;
        releaseFirst();
        await waitFor(() => count('agent_end') >= 1, 'the first run to end');
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return ensureSubscription(...args);
    });

    const result = send();
    await waitFor(() => raced, 'the session to route the signal');
    return result;
  }

  return { session, count, modelResolutions, releaseFirst, sendAcrossRunEnd, getStreamCalls: () => streamCalls };
}

describe('signal sent while a run is finishing (#23053)', () => {
  it('Given a run that ends before routing, When sendSignal requires delivery, Then the wake run has the controller context', async () => {
    const { session, count, modelResolutions, sendAcrossRunEnd, getStreamCalls } =
      await createHarness('require-delivery');

    const signal = await sendAcrossRunEnd(() => session.sendSignal({ content: 'kickoff' }, { requireDelivery: true }));
    await expect(signal.accepted).resolves.toMatchObject({ accepted: true, action: 'wake' });
    await waitFor(() => count('agent_end') >= 2, 'the woken run to end');

    expect(modelResolutions.length).toBeGreaterThan(1);
    expect(modelResolutions).not.toContain(false);
    expect(count('agent_start')).toBe(2);
    expect(count('error')).toBe(0);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given a run that ends before routing, When a plain sendSignal is sent, Then the wake run has the controller context', async () => {
    const { session, count, modelResolutions, sendAcrossRunEnd, getStreamCalls } = await createHarness('plain');

    const signal = await sendAcrossRunEnd(() => session.sendSignal({ content: 'follow up' }));
    await expect(signal.accepted).resolves.toMatchObject({ accepted: true });
    await waitFor(() => count('agent_end') >= 2, 'the woken run to end');

    expect(modelResolutions.length).toBeGreaterThan(1);
    expect(modelResolutions).not.toContain(false);
    expect(count('agent_start')).toBe(2);
    expect(count('error')).toBe(0);
  });

  it('Given a run that is still active at routing, When sendSignal is sent, Then it is delivered to that run without building stream options', async () => {
    const { session, count, releaseFirst, getStreamCalls } = await createHarness('active');
    void session.sendMessage({ content: 'first message' }).catch(() => {});
    await waitFor(() => getStreamCalls() === 1, 'the first model call');
    const buildStreamOptions = vi.spyOn(session.machinery, 'buildStreamOptions');

    const signal = session.sendSignal({ content: 'while running' }, { requireDelivery: true });
    await expect(signal.accepted).resolves.toMatchObject({ accepted: true, action: 'deliver' });
    expect(buildStreamOptions).not.toHaveBeenCalled();

    releaseFirst();
    await waitFor(() => count('agent_end') >= 1, 'the run to end');
    // The signal joined the running run instead of starting another one.
    expect(count('agent_start')).toBe(1);
  });
});
