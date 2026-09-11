/**
 * Regression tests for #23456 — calling `abort()` and immediately sending
 * another message (via `steer`, a direct `abort()` + `sendMessage()`, or
 * `followUp` on an idle-after-abort session) must start a fresh, observable run.
 *
 * Before the fix, `Session.sendSignal` re-used the live subscription handle
 * captured before `waitForStreamIdle()`. The abort teardown detached that
 * handle while the wait was in flight, so the follow-up run dispatched with no
 * native subscription: its `agent_start`/`agent_end` never reached the session
 * and the display state never returned to idle. The fix re-ensures the
 * subscription (for the dispatch-captured agent) after the wait.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** A model stream that emits an opening delta, then blocks until `gate` resolves. */
function heldStream(gate: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-held', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-held' });
      controller.enqueue({ type: 'text-delta', id: 'text-held', delta: 'thinking' });
      await gate;
      try {
        controller.enqueue({ type: 'text-end', id: 'text-held' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
        controller.close();
      } catch {
        // The run was aborted while held; the stream is already torn down.
      }
    },
  });
}

/** A model stream that completes immediately with a short text turn. */
function textStream(delta: string) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

async function createHarness(id: string) {
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });

  let callCount = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You reply to the user.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        return { stream: callCount === 1 ? heldStream(firstGate) : textStream('second reply') };
      },
    }),
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

  return { session, events, releaseFirst };
}

/** Resolve once `count` events of `type` have been observed, or after `timeoutMs`. */
function waitForEventCount(
  events: AgentControllerEvent[],
  type: AgentControllerEvent['type'],
  count: number,
  timeoutMs = 5_000,
) {
  return new Promise<void>(resolve => {
    const start = Date.now();
    const check = () => {
      if (events.filter(e => e.type === type).length >= count || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

function waitForFirstActive(session: any, events: AgentControllerEvent[]) {
  return waitForEventCount(events, 'agent_start', 1).then(() => {
    // Give the model stream a tick to emit its first delta so the run is
    // genuinely in-flight when we abort.
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  });
}

describe('immediate message after Session.abort() (#23456)', () => {
  it('Given an in-flight run, When steer() aborts and immediately sends, Then a second run starts and the session returns to idle', async () => {
    const { session, events, releaseFirst } = await createHarness('steer');

    void session.sendMessage({ content: 'first message' }).catch(() => {});
    await waitForFirstActive(session, events);

    // steer() = abort() + immediate sendMessage() with a distinct instruction.
    const steered = session.steer({ content: 'second message' });
    releaseFirst();
    await steered.catch(() => {});
    await waitForEventCount(events, 'agent_end', 2);

    expect(events.filter(e => e.type === 'agent_start')).toHaveLength(2);
    expect(events.filter(e => e.type === 'agent_end')).toHaveLength(2);
    expect(session.displayState.get().isRunning).toBe(false);
  });

  it('Given an in-flight run, When abort() is followed synchronously by sendMessage(), Then a second run starts and the session returns to idle', async () => {
    const { session, events, releaseFirst } = await createHarness('abort-send');

    void session.sendMessage({ content: 'first message' }).catch(() => {});
    await waitForFirstActive(session, events);

    session.abort();
    const sent = session.sendMessage({ content: 'second message' });
    releaseFirst();
    await sent.catch(() => {});
    await waitForEventCount(events, 'agent_end', 2);

    expect(events.filter(e => e.type === 'agent_start')).toHaveLength(2);
    expect(events.filter(e => e.type === 'agent_end')).toHaveLength(2);
    expect(session.displayState.get().isRunning).toBe(false);
  });

  it('Control: two sequential sends (no abort) each start their own run', async () => {
    const { session, events, releaseFirst } = await createHarness('control-sequential');

    // Let the first run finish normally before sending the second.
    const first = session.sendMessage({ content: 'first message' });
    await waitForFirstActive(session, events);
    releaseFirst();
    await first;
    await session.sendMessage({ content: 'second message' });

    expect(events.filter(e => e.type === 'agent_start')).toHaveLength(2);
    expect(events.filter(e => e.type === 'agent_end')).toHaveLength(2);
    expect(session.displayState.get().isRunning).toBe(false);
  });
});
