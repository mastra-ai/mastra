import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import type { MastraDBMessage } from '../agent/message-list';
import { MASTRA_THREAD_ID_KEY, RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

async function fixture(count = 4) {
  const storage = new InMemoryStore();
  const store = await storage.getStore('memory');
  const date = new Date('2026-09-14T00:00:00Z');
  await store.saveThread({
    thread: {
      id: 'source',
      resourceId: 'owner',
      title: 'Original',
      createdAt: date,
      updatedAt: date,
      metadata: { workingMemory: 'later thread memory', testTag: 'retained' },
    },
  });
  const messages: MastraDBMessage[] = Array.from({ length: count }, (_, i) => ({
    id: `message-${i}`,
    threadId: 'source',
    resourceId: 'owner',
    role: i % 2 ? 'assistant' : 'user',
    createdAt: new Date(date.getTime() + i),
    content: { format: 2, parts: [{ type: 'text', text: `original-${i}` }] },
  }));
  await store.saveMessages({ messages });
  const controller = new AgentController({
    id: 'controller',
    resourceId: 'owner',
    storage,
    workspace: createMockWorkspace(),
    modes: [
      {
        id: 'default',
        name: 'Default',
        default: true,
        agent: new Agent({
          id: 'test-agent',
          name: 'Test',
          instructions: 'Test',
          model: 'openai/gpt-4o',
        }),
      },
    ],
  });
  const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true }) }));
  const createSession = vi
    .spyOn(controller, 'createSession')
    .mockResolvedValue({ sendSignal, thread: { getId: () => 'edited' } } as never);
  const input = {
    resourceId: 'owner',
    sourceThreadId: 'source',
    messageId: 'message-2',
    content: 'Corrected',
    newThreadId: 'edited',
    newSessionScope: 'edited-scope',
  };
  return { controller, store, messages, sendSignal, createSession, input };
}

describe('Controller edited conversations', () => {
  it('keeps the original and copies only messages before the edited one', async () => {
    const f = await fixture();
    const original = await f.store.listMessages({ threadId: 'source', perPage: false });
    const result = await f.controller.editMessage(f.input);
    expect(result.id).toBe('edited');
    expect(await f.store.listMessages({ threadId: 'source', perPage: false })).toEqual(original);
    const copied = await f.store.listMessages({ threadId: 'edited', perPage: false });
    expect(copied.messages.map(m => m.content.parts)).toEqual(f.messages.slice(0, 2).map(m => m.content.parts));
    expect(result.metadata?.workingMemory).toBeUndefined();
    expect(f.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'owner',
        threadId: 'edited',
        scope: 'edited-scope',
      }),
    );
    expect(f.sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: [{ type: 'text', text: 'Corrected' }],
      }),
      { requireDelivery: true },
    );
  });

  it('copies no messages when editing the first one', async () => {
    const f = await fixture();
    await f.controller.editMessage({ ...f.input, messageId: 'message-0' });
    expect((await f.store.listMessages({ threadId: 'edited', perPage: false })).messages).toEqual([]);
    expect((await f.store.listMessages({ threadId: 'source', perPage: false })).messages).toHaveLength(4);
  });

  it('reads the complete stored history, including more than 64 messages', async () => {
    const f = await fixture(202);
    await f.controller.editMessage({ ...f.input, messageId: 'message-200' });
    expect((await f.store.listMessages({ threadId: 'edited', perPage: false })).messages).toHaveLength(200);
  });

  it('retains file contents and uses the edited thread in the request context', async () => {
    const f = await fixture();
    const file = { type: 'file' as const, data: 'https://example.test/report.pdf', mimeType: 'application/pdf' };
    await f.store.saveMessages({
      messages: [
        {
          ...f.messages[2],
          content: {
            format: 2,
            parts: [...f.messages[2].content.parts, file],
          },
        },
      ],
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_THREAD_ID_KEY, 'source');
    requestContext.set('user', { id: 'owner' });
    await f.controller.editMessage({ ...f.input, requestContext });
    const [input] = f.sendSignal.mock.calls[0] as unknown as [{ content: unknown; requestContext: RequestContext }];
    expect(input.content).toEqual([
      { type: 'text', text: 'Corrected' },
      { type: 'file', data: file.data, mediaType: file.mimeType },
    ]);
    expect(input.requestContext.get(MASTRA_THREAD_ID_KEY)).toBe('edited');
    expect(input.requestContext.get('user')).toEqual({ id: 'owner' });
    expect(requestContext.get(MASTRA_THREAD_ID_KEY)).toBe('source');
  });

  it.each([
    { resourceId: 'another-owner' },
    { sourceThreadId: 'missing' },
    { messageId: 'message-1' },
    { messageId: 'missing' },
    { content: '   ' },
    { newThreadId: 'source' },
    { newSessionScope: '' },
  ])('rejects invalid or foreign edits before creating a copy: %j', async patch => {
    const f = await fixture();
    const status = 'content' in patch || 'newSessionScope' in patch ? 400 : 'newThreadId' in patch ? 409 : 404;
    await expect(f.controller.editMessage({ ...f.input, ...patch })).rejects.toMatchObject({ details: { status } });
    expect(await f.store.getThreadById({ threadId: 'edited' })).toBeNull();
    expect(f.sendSignal).not.toHaveBeenCalled();
  });

  it('keeps all original messages if copying fails', async () => {
    const f = await fixture();
    vi.spyOn(f.store, 'cloneThread').mockRejectedValue(new Error('Storage unavailable'));
    await expect(f.controller.editMessage(f.input)).rejects.toThrow('Storage unavailable');
    expect((await f.store.listMessages({ threadId: 'source', perPage: false })).messages).toHaveLength(4);
    expect(f.sendSignal).not.toHaveBeenCalled();
  });

  it('reports rejected delivery and leaves both histories available', async () => {
    const f = await fixture();
    f.sendSignal.mockImplementation(() => ({ accepted: Promise.reject(new Error('Admission failed')) }));
    await expect(f.controller.editMessage(f.input)).rejects.toThrow('Admission failed');
    expect((await f.store.listMessages({ threadId: 'source', perPage: false })).messages).toHaveLength(4);
    expect(await f.store.getThreadById({ threadId: 'edited' })).not.toBeNull();
  });

  it('does not submit a second run when a target is reused', async () => {
    const f = await fixture();
    await f.controller.editMessage(f.input);
    await expect(f.controller.editMessage(f.input)).rejects.toThrow('Edited thread already exists');
    expect(f.sendSignal).toHaveBeenCalledTimes(1);
  });

  it('rejects overlapping submissions for the same new thread', async () => {
    const f = await fixture();
    const input = { ...f.input, messageId: 'message-0' };
    const results = await Promise.allSettled([f.controller.editMessage(input), f.controller.editMessage(input)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(f.sendSignal).toHaveBeenCalledTimes(1);
  });
});
