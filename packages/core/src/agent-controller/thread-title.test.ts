import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

function createTextStreamModel(text: string) {
  return new MockLanguageModelV2({
    // The title path runs `methodType: 'generate'`; the answering run streams.
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text', text }],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function createBrokenModel() {
  const refuse = async () => {
    throw new Error('Could not find API key process.env.ANTHROPIC_API_KEY');
  };
  return new MockLanguageModelV2({ doGenerate: refuse, doStream: refuse });
}

/** A controller that has taken its first turn, with `titleModel` naming the thread. */
async function startThread(titleModel: MockLanguageModelV2) {
  const storage = new InMemoryStore();
  const memory = new MockMemory({
    storage,
    options: { generateTitle: { model: titleModel } },
  });
  const agent = new Agent({
    id: 'titled-agent',
    name: 'titled-agent',
    instructions: 'You are a test agent.',
    model: createTextStreamModel('On it.'),
    memory,
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));

  await session.sendMessage({ content: 'Rewrite the log parser' });
  await vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true), { timeout: 10_000 });

  return { controller, session, agent, memory, events };
}

/** A controller whose first turn is done, so its thread carries a generated title. */
async function startNamedThread() {
  const started = await startThread(createTextStreamModel('Log parser rewrite'));
  await vi.waitFor(
    async () => {
      const thread = await started.memory.getThreadById({ threadId: started.session.thread.getId()! });
      expect(thread?.title).toBe('Log parser rewrite');
    },
    { timeout: 10_000 },
  );
  return started;
}

describe('AgentController thread titles', () => {
  it('names the thread on its first turn and emits thread_title_updated', async () => {
    const { session, events } = await startNamedThread();

    expect(events).toContainEqual({
      type: 'thread_title_updated',
      threadId: session.thread.getId(),
      title: 'Log parser rewrite',
    });
  });

  it('re-names a thread on request, and tells the live session about it', async () => {
    const { controller, session, memory } = await startNamedThread();
    const threadId = session.thread.getId()!;
    await session.thread.rename({ title: 'Wrong name' });

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    const title = await controller.generateThreadTitle({
      threadId,
      resourceId: session.identity.getResourceId(),
    });

    expect(title).toBe('Log parser rewrite');
    expect((await memory.getThreadById({ threadId }))?.title).toBe('Log parser rewrite');
    expect(events).toContainEqual({ type: 'thread_title_updated', threadId, title: 'Log parser rewrite' });
  });

  it('re-names a thread whose session is no longer live', async () => {
    const { controller, session, memory } = await startNamedThread();
    const threadId = session.thread.getId()!;
    await session.thread.rename({ title: 'Wrong name' });
    await controller.deleteSession({ resourceId: session.identity.getResourceId() });

    expect(await controller.generateThreadTitle({ threadId })).toBe('Log parser rewrite');
    expect((await memory.getThreadById({ threadId }))?.title).toBe('Log parser rewrite');
  });

  it('names a thread under the identity the caller supplies', async () => {
    const { controller, session, agent } = await startNamedThread();
    const threadId = session.thread.getId()!;
    await controller.deleteSession({ resourceId: session.identity.getResourceId() });
    const namer = vi.spyOn(agent, 'generateTitleFromUserMessage');

    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'thread-owner' });
    await controller.generateThreadTitle({ threadId, requestContext });

    expect(namer.mock.calls[0]?.[0].requestContext?.get('user')).toEqual({ id: 'thread-owner' });
  });

  it('names a thread from where the conversation went, not only its opening ask', async () => {
    const { controller, session, agent } = await startNamedThread();
    const threadId = session.thread.getId()!;
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));

    await session.sendMessage({ content: 'Actually, switch it to streaming ingestion' });
    await vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true), { timeout: 10_000 });

    const namer = vi.spyOn(agent, 'generateTitleFromUserMessage');
    await controller.generateThreadTitle({ threadId, resourceId: session.identity.getResourceId() });

    const named = (namer.mock.calls[0]?.[0].messages ?? [])
      .flatMap(message => message.parts?.filter(part => part.type === 'text').map(part => part.text) ?? [])
      .join(' ');
    expect(named).toContain('Rewrite the log parser');
    expect(named).toContain('switch it to streaming ingestion');
  });

  it('keeps the thread working when the title model cannot answer', async () => {
    const { session, memory, events } = await startThread(createBrokenModel());
    const threadId = session.thread.getId()!;

    await session.sendMessage({ content: 'Still listening?' });
    await vi.waitFor(() => expect(events.filter(event => event.type === 'agent_end')).toHaveLength(2), {
      timeout: 10_000,
    });

    expect((await memory.getThreadById({ threadId }))?.title).toBeFalsy();
    expect(events.some(event => event.type === 'thread_title_updated')).toBe(false);
    expect(events.some(event => event.type === 'error')).toBe(false);
  });

  it('says so when the thread has nothing to name it from', async () => {
    const { controller, session } = await startNamedThread();
    const empty = await session.thread.create({ title: 'Untouched' });

    await expect(controller.generateThreadTitle({ threadId: empty.id })).rejects.toThrow(
      'This conversation has no message to name it from yet.',
    );
  });

  it('refuses to name a thread that has no user message', async () => {
    const { controller } = await startNamedThread();
    const thread = await controller.queryThreadById({ threadId: 'missing-thread' });

    expect(thread).toBeNull();
    await expect(controller.generateThreadTitle({ threadId: 'missing-thread' })).rejects.toThrow(
      'Thread not found: missing-thread',
    );
  });
});
