/**
 * A person sends a message, reloads the page right away, and must see that message.
 * A reloaded chat rebuilds its transcript from stored thread history, so the
 * message has to be in storage as soon as the session's send is accepted — not
 * after the first model step or at turn end.
 */
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

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
        // The run was aborted while held.
      }
    },
  });
}

function textStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-text', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
      controller.close();
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

/** `holdFirstModelCall` holds the first run mid-stream so a later steer/follow-up targets a running run. */
async function createHarness(id: string, { holdFirstModelCall = false } = {}) {
  let inputHold: { reached: ReturnType<typeof deferred>; gate: ReturnType<typeof deferred> } | undefined;
  const holdingProcessor: Processor = {
    id: 'hold-before-model',
    async processInput({ messages }) {
      const hold = inputHold;
      if (hold) {
        hold.reached.resolve();
        await hold.gate.promise;
      }
      return messages;
    },
  };
  /** Hold every later run inside its input processor, i.e. before its first model request. */
  const holdInput = () => {
    const hold = { reached: deferred(), gate: deferred() };
    inputHold = hold;
    return {
      reached: hold.reached.promise,
      release: () => {
        inputHold = undefined;
        hold.gate.resolve();
      },
    };
  };

  const modelGate = deferred();
  const firstModelCall = deferred();
  let callCount = 0;
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'Reply briefly.',
    memory: new MockMemory({ storage }),
    inputProcessors: [holdingProcessor],
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        if (callCount === 1) firstModelCall.resolve();
        return { stream: holdFirstModelCall && callCount === 1 ? heldStream(modelGate.promise) : textStream() };
      },
    }),
  });
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent(`${id}-agent`) }],
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });

  const storedTexts = async () => {
    const messages = await session.thread.listMessages({ threadId: session.thread.requireId() });
    return messages
      .filter(message => message.role === 'signal' || message.role === 'user')
      .map(message =>
        message.content.parts
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join(''),
      );
  };

  return {
    session,
    events,
    storedTexts,
    holdInput,
    firstModelCall: firstModelCall.promise,
    releaseModel: modelGate.resolve,
  };
}

function waitForEventCount(events: AgentControllerEvent[], type: AgentControllerEvent['type'], count: number) {
  return vi.waitFor(() => {
    expect(events.filter(event => event.type === type).length).toBeGreaterThanOrEqual(count);
  });
}

describe('a sent message is stored as soon as the session accepts it', () => {
  it('sendMessage: the message is in thread history before the first model request', async () => {
    const h = await createHarness('send');

    const hold = h.holdInput();
    const sent = h.session.sendMessage({ content: 'hello there' });
    await hold.reached;

    await vi.waitFor(async () => expect(await h.storedTexts()).toEqual(['hello there']));

    hold.release();
    await sent;
    await waitForEventCount(h.events, 'agent_end', 1);
    expect(await h.storedTexts()).toEqual(['hello there']);
  });

  it('steer: the steering message is in thread history before the steered run reaches the model', async () => {
    const h = await createHarness('steer', { holdFirstModelCall: true });
    void h.session.sendMessage({ content: 'first message' }).catch(() => {});
    await h.firstModelCall;

    const hold = h.holdInput();
    const steered = h.session.steer({ content: 'change direction' });
    h.releaseModel();
    await hold.reached;

    await vi.waitFor(async () => expect(await h.storedTexts()).toContain('change direction'));
    hold.release();
    await steered;
    await waitForEventCount(h.events, 'agent_end', 2);
    expect((await h.storedTexts()).filter(text => text === 'change direction')).toHaveLength(1);
  });

  it('followUp: a message queued behind a running run is in thread history while that run is still going', async () => {
    const h = await createHarness('follow-up', { holdFirstModelCall: true });
    void h.session.sendMessage({ content: 'first message' }).catch(() => {});
    await h.firstModelCall;

    await h.session.followUp({ content: 'and then this' });

    // The first run is still held inside its model stream.
    await vi.waitFor(async () => expect(await h.storedTexts()).toContain('and then this'));

    h.releaseModel();
    await waitForEventCount(h.events, 'agent_end', 2);
    expect((await h.storedTexts()).filter(text => text === 'and then this')).toHaveLength(1);
  });
});
