import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../../agent';
import { getMessageAuthor } from '../../agent/signals';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
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

async function createHarness({ holdFirstRun = false }: { holdFirstRun?: boolean } = {}) {
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>(resolve => {
    releaseFirst = resolve;
  });
  let signalFirstCall!: () => void;
  const firstCallStarted = new Promise<void>(resolve => {
    signalFirstCall = resolve;
  });
  let callCount = 0;
  const storage = new InMemoryStore();
  const agent = new Agent({
    id: 'message-author-agent',
    name: 'message author agent',
    instructions: 'Reply briefly.',
    memory: new MockMemory({ storage }),
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount++;
        if (callCount === 1) signalFirstCall();
        return { stream: holdFirstRun && callCount === 1 ? heldStream(firstGate) : textStream() };
      },
    }),
  });
  const mastra = new Mastra({ agents: { 'message-author-agent': agent }, logger: false, storage });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'message-author-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: mastra.getAgent('message-author-agent') }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'message-author-session', ownerId: 'owner-1' });
  await session.thread.create();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });
  return { session, events, releaseFirst, firstCallStarted };
}

function waitForEventCount(events: AgentControllerEvent[], type: AgentControllerEvent['type'], count: number) {
  return vi.waitFor(() => {
    expect(events.filter(event => event.type === type)).toHaveLength(count);
  });
}

async function userMessages(session: Awaited<ReturnType<typeof createHarness>>['session']) {
  const messages = await session.thread.listMessages({ threadId: session.thread.requireId() });
  return messages.filter(message => message.role === 'signal');
}

describe('AgentController message author metadata', () => {
  it('persists an author on an idle sendMessage', async () => {
    const { session } = await createHarness();

    await session.sendMessage({ content: 'hello', author: { id: 'user-1', name: 'Ada' } });

    const messages = await userMessages(session);
    expect(messages).toHaveLength(1);
    expect(getMessageAuthor(messages[0]!)).toEqual({ id: 'user-1', name: 'Ada' });
    expect(messages[0]!.content.providerMetadata?.mastra).toEqual({ author: { id: 'user-1', name: 'Ada' } });
  });

  it('persists the author on an active-run steer', async () => {
    const { session, events, releaseFirst, firstCallStarted } = await createHarness({ holdFirstRun: true });
    void session.sendMessage({ content: 'first message', author: { id: 'user-1' } }).catch(() => {});
    await firstCallStarted;

    const steered = session.steer({ content: 'change direction', author: { id: 'user-2' } });
    releaseFirst();
    await steered;
    await waitForEventCount(events, 'agent_end', 2);

    const messages = await userMessages(session);
    expect(messages.map(message => getMessageAuthor(message))).toEqual([{ id: 'user-1' }, { id: 'user-2' }]);
  });

  it('persists the author on a queued message', async () => {
    const { session, events, releaseFirst, firstCallStarted } = await createHarness({ holdFirstRun: true });
    void session.sendMessage({ content: 'first message', author: { id: 'user-1' } });
    await firstCallStarted;

    await session.queueMessage({ content: 'next task', author: { id: 'user-3' } });
    releaseFirst();
    await waitForEventCount(events, 'agent_end', 2);

    const messages = await userMessages(session);
    expect(messages.map(message => getMessageAuthor(message))).toEqual([{ id: 'user-1' }, { id: 'user-3' }]);
  });

  it('leaves author metadata absent when no author is provided', async () => {
    const { session } = await createHarness();

    await session.sendMessage({ content: 'anonymous' });

    const messages = await userMessages(session);
    expect(messages).toHaveLength(1);
    expect(getMessageAuthor(messages[0]!)).toBeUndefined();
    expect(messages[0]!.content.metadata?.signal).not.toHaveProperty('author');
  });
});
