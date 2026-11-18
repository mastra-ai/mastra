/**
 * A person hits enter and reloads the page. The reloaded page rebuilds the transcript from stored
 * thread history plus the session's display state, so from the moment a send is acknowledged the
 * message has to be in one of the two: listed as pending until the run stores it, then stored. It
 * must never be in neither, and never stay pending once stored, blocked or cancelled.
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

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

function replyStream(text: string, gate?: Promise<void>) {
  return new ReadableStream({
    async start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: `id-${text}`, modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: text });
      if (gate) await gate;
      try {
        controller.enqueue({ type: 'text-end', id: 'text-1' });
        controller.enqueue({ type: 'finish', finishReason: 'stop', usage });
        controller.close();
      } catch {
        // The run was aborted while held.
      }
    },
  });
}

type Hold = { reached: Promise<void>; release: () => void };

async function createHarness(id: string, { blockText }: { blockText?: string } = {}) {
  let inputHold: { reached: ReturnType<typeof deferred>; gate: ReturnType<typeof deferred> } | undefined;
  const processor: Processor = {
    id: 'hold-or-block-input',
    async processInput({ messages, abort }) {
      const hold = inputHold;
      if (hold) {
        hold.reached.resolve();
        await hold.gate.promise;
      }
      if (blockText && JSON.stringify(messages).includes(blockText)) abort('blocked by policy');
      return messages;
    },
  };
  /** Hold the next run inside its input processor: before the run has accepted the message. */
  const holdInput = (): Hold => {
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

  const modelHolds = new Map<number, { reached: ReturnType<typeof deferred>; gate: ReturnType<typeof deferred> }>();
  /** Hold model call `n` (1-based) mid-stream: after the run has accepted and stored the message. */
  const holdModelCall = (n: number): Hold => {
    const hold = { reached: deferred(), gate: deferred() };
    modelHolds.set(n, hold);
    return { reached: hold.reached.promise, release: hold.gate.resolve };
  };

  const prompts: string[] = [];
  let call = 0;
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'Reply briefly.',
    memory: new MockMemory({ storage }),
    inputProcessors: [processor],
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        call++;
        prompts.push(JSON.stringify(prompt));
        const hold = modelHolds.get(call);
        hold?.reached.resolve();
        return { stream: replyStream(`reply ${call}`, hold?.gate.promise) };
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

  const textOf = (message: { content: { parts: Array<{ type: string; text?: string }> } }) =>
    message.content.parts
      .filter(part => part.type === 'text')
      .map(part => part.text)
      .join('');
  /** The transcript a reload rebuilds from storage. */
  const stored = async () =>
    (await session.thread.listMessages({ threadId: session.thread.requireId() })).map(
      message => `${message.role === 'assistant' ? 'assistant' : 'user'}: ${textOf(message)}`,
    );
  const storedUserTexts = async () =>
    (await stored()).filter(line => line.startsWith('user: ')).map(line => line.slice('user: '.length));
  const pending = () => session.displayState.get().pendingUserMessages.map(({ content, kind }) => ({ content, kind }));

  const runsEnded = (count: number) =>
    vi.waitFor(() => expect(events.filter(event => event.type === 'agent_end').length).toBeGreaterThanOrEqual(count));

  return {
    agent,
    session,
    prompts,
    stored,
    storedUserTexts,
    pending,
    holdInput,
    holdModelCall,
    runsEnded,
  };
}

describe('a sent message is pending until stored, then stored', () => {
  it('send: pending before the run accepts it, stored and no longer pending once the model is asked', async () => {
    const h = await createHarness('send');
    const input = h.holdInput();
    const model = h.holdModelCall(1);

    const sent = h.session.sendMessage({ content: 'hello there' });
    expect(h.pending()).toEqual([{ content: 'hello there', kind: 'message' }]);
    await input.reached;
    expect(h.pending()).toEqual([{ content: 'hello there', kind: 'message' }]);
    expect(await h.storedUserTexts()).toEqual([]);

    input.release();
    await model.reached;
    await vi.waitFor(() => expect(h.pending()).toEqual([]));
    expect(await h.storedUserTexts()).toEqual(['hello there']);

    model.release();
    await sent;
    await h.runsEnded(1);
    expect(await h.stored()).toEqual(['user: hello there', 'assistant: reply 1']);
    expect(h.pending()).toEqual([]);
  });

  it('steer: pending before the steered run accepts it, then stored', async () => {
    const h = await createHarness('steer');
    const first = h.holdModelCall(1);
    void h.session.sendMessage({ content: 'first message' }).catch(() => {});
    await first.reached;

    const input = h.holdInput();
    const second = h.holdModelCall(2);
    const steered = h.session.steer({ content: 'change direction' });
    expect(h.pending()).toEqual([{ content: 'change direction', kind: 'steer' }]);
    first.release();
    await input.reached;
    expect(h.pending()).toEqual([{ content: 'change direction', kind: 'steer' }]);
    expect(await h.storedUserTexts()).toEqual(['first message']);

    input.release();
    await second.reached;
    await vi.waitFor(() => expect(h.pending()).toEqual([]));
    expect(await h.storedUserTexts()).toEqual(['first message', 'change direction']);

    second.release();
    await steered;
    await h.runsEnded(2);
    expect(h.pending()).toEqual([]);
    expect(await h.storedUserTexts()).toEqual(['first message', 'change direction']);
  });

  it('follow-up: pending while queued, stored after the first reply, in send order', async () => {
    const h = await createHarness('follow-up');
    const first = h.holdModelCall(1);
    void h.session.sendMessage({ content: 'first message' }).catch(() => {});
    await first.reached;

    const followed = h.session.followUp({ content: 'and then this' });
    expect(h.pending()).toEqual([{ content: 'and then this', kind: 'follow-up' }]);
    await followed;
    expect(h.pending()).toEqual([{ content: 'and then this', kind: 'follow-up' }]);
    expect(await h.storedUserTexts()).toEqual(['first message']);

    const second = h.holdModelCall(2);
    first.release();
    await second.reached;
    await vi.waitFor(() => expect(h.pending()).toEqual([]));
    expect(await h.storedUserTexts()).toEqual(['first message', 'and then this']);

    second.release();
    await h.runsEnded(2);
    expect(await h.stored()).toEqual([
      'user: first message',
      'assistant: reply 1',
      'user: and then this',
      'assistant: reply 2',
    ]);
    expect(h.pending()).toEqual([]);
  });

  it('a cancelled queued follow-up is neither pending nor stored', async () => {
    const h = await createHarness('cancel');
    const first = h.holdModelCall(1);
    void h.session.sendMessage({ content: 'first message' }).catch(() => {});
    await first.reached;
    await h.session.followUp({ content: 'never mind' });
    const [queued] = h.session.displayState.get().pendingUserMessages;

    const { cancelledSignalIds } = h.agent.cancelQueuedMessages({
      resourceId: h.session.identity.getResourceId(),
      threadId: h.session.thread.requireId(),
      signalIds: [queued!.id],
    });
    expect(cancelledSignalIds).toEqual([queued!.id]);
    await vi.waitFor(() => expect(h.pending()).toEqual([]));

    first.release();
    await h.runsEnded(1);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await h.storedUserTexts()).toEqual(['first message']);
    expect(h.pending()).toEqual([]);
  });

  it('a message an input processor blocks leaves pending and is never stored or prompted', async () => {
    const h = await createHarness('blocked', { blockText: 'forbidden' });

    await h.session.sendMessage({ content: 'forbidden words' });
    await h.runsEnded(1);
    expect(h.pending()).toEqual([]);
    expect(await h.storedUserTexts()).toEqual([]);

    await h.session.sendMessage({ content: 'hello again' });
    await h.runsEnded(2);
    expect(await h.storedUserTexts()).toEqual(['hello again']);
    expect(h.prompts.join('\n')).not.toContain('forbidden');
    expect(h.pending()).toEqual([]);
  });

  it('switching threads drops pending messages of the old thread', async () => {
    const h = await createHarness('switch');
    const input = h.holdInput();
    void h.session.sendMessage({ content: 'hello there' }).catch(() => {});
    await input.reached;
    expect(h.pending()).toEqual([{ content: 'hello there', kind: 'message' }]);

    await h.session.thread.create();
    expect(h.pending()).toEqual([]);
    input.release();
  });
});
