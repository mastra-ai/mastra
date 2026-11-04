/**
 * The step > 0 save in `ObservationStep.prepare()` moves the previous step's input and response
 * messages into the memory bucket and persists them. The MessageList belongs to the whole run, so
 * background tool results can land on it while that save is in flight. These tests check that no
 * message drops out of the list during the save, and that a failed save puts the drained messages
 * back so the end-of-turn save still picks them up.
 */

import type { MastraDBMessage } from '@mastra/core/agent';
import { MessageList } from '@mastra/core/agent';
import { InMemoryMemory, InMemoryDB } from '@mastra/core/storage';
import { describe, it, expect, vi } from 'vitest';

import { ObservationalMemory } from '../observational-memory';

const resourceId = 'resource-step-save';

function textMessage(id: string, role: 'user' | 'assistant', text: string, createdAt: Date, threadId: string) {
  return {
    id,
    role,
    content: { format: 2, parts: [{ type: 'text', text }] },
    type: 'text',
    createdAt,
    threadId,
    resourceId,
  } as MastraDBMessage;
}

function pendingToolCallMessage(id: string, toolCallId: string, createdAt: Date, threadId: string) {
  return {
    id,
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId, toolName: 'slowTask', args: {} },
        },
      ],
    },
    type: 'text',
    createdAt,
    threadId,
    resourceId,
  } as MastraDBMessage;
}

async function setup(threadId: string) {
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
  await storage.saveThread({
    thread: { id: threadId, resourceId, title: 'thread', createdAt: new Date(), updatedAt: new Date() },
  });
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini' as any, messageTokens: 100_000 },
    reflection: { model: 'openai/gpt-4o-mini' as any, observationTokens: 500_000 },
  });
  return { storage, om };
}

describe('ObservationStep step > 0 save', () => {
  it('keeps a background tool result that lands while the save is in flight', async () => {
    const threadId = 'thread-background-result';
    const { storage, om } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    // Saved by an earlier step: an assistant message whose background tool call is still running.
    const backgroundCall = pendingToolCallMessage('background-call', 'call-bg', new Date(t0), threadId);
    const user = textMessage('user-2', 'user', 'next question', new Date(t0 + 1000), threadId);
    const reply = textMessage('reply-2', 'assistant', 'working on it', new Date(t0 + 2000), threadId);
    await storage.saveMessages({ messages: [backgroundCall] });

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(backgroundCall, 'memory');
    messageList.add(user, 'input');
    messageList.add(reply, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();

    let releaseSave!: () => void;
    const saveStarted = new Promise<void>(resolveStarted => {
      const realSave = storage.saveMessages.bind(storage);
      vi.spyOn(storage, 'saveMessages').mockImplementationOnce(async args => {
        resolveStarted();
        await new Promise<void>(release => (releaseSave = release));
        return realSave(args);
      });
    });

    const prepared = turn.step(1).prepare();
    await saveStarted;

    // The background task finishes mid-save and merges its result into the earlier message.
    const merged = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId: 'call-bg', toolName: 'slowTask', args: {}, result: 'done' },
    });
    expect(merged).toBe(true);

    releaseSave();
    await prepared;

    const backgroundInList = messageList.get.all.db().find(m => m.id === 'background-call');
    expect(backgroundInList).toBeDefined();
    expect(backgroundInList!.content.parts[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', result: 'done' },
    });
    // The merged result is still queued for saving.
    expect(messageList.get.response.db().map(m => m.id)).toContain('background-call');
    expect(
      messageList.get.all
        .db()
        .map(m => m.id)
        .sort(),
    ).toEqual(['background-call', 'reply-2', 'user-2']);
  });

  it('merges a background tool result into a message that is being saved', async () => {
    const threadId = 'thread-saving-message-result';
    const { storage, om } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const user = textMessage('user-1', 'user', 'start the task', new Date(t0), threadId);
    // The previous step's response: its background tool call is still running.
    const backgroundCall = pendingToolCallMessage('background-call', 'call-bg', new Date(t0 + 1000), threadId);

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(user, 'input');
    messageList.add(backgroundCall, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();

    let releaseSave!: () => void;
    const saveStarted = new Promise<void>(resolveStarted => {
      const realSave = storage.saveMessages.bind(storage);
      vi.spyOn(storage, 'saveMessages').mockImplementationOnce(async args => {
        resolveStarted();
        await new Promise<void>(release => (releaseSave = release));
        return realSave(args);
      });
    });

    const prepared = turn.step(1).prepare();
    await saveStarted;

    // The message holding the call is in the save batch, but it must still be in the list for the
    // result to merge into it rather than land as a separate message.
    const merged = messageList.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId: 'call-bg', toolName: 'slowTask', args: {}, result: 'done' },
    });
    expect(merged).toBe(true);

    releaseSave();
    await prepared;

    expect(messageList.get.all.db().map(m => m.id)).toEqual(['user-1', 'background-call']);
    expect(messageList.get.all.db()[1]!.content.parts[0]).toMatchObject({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', result: 'done' },
    });
    // The merged result is queued for the next save.
    expect(messageList.get.response.db().map(m => m.id)).toEqual(['background-call']);
  });

  it('puts the drained messages back into their buckets when the save fails', async () => {
    const threadId = 'thread-failed-save';
    const { storage, om } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const earlier = textMessage('earlier', 'assistant', 'already saved', new Date(t0), threadId);
    const user = textMessage('user-2', 'user', 'next question', new Date(t0 + 1000), threadId);
    const reply = textMessage('reply-2', 'assistant', 'tool finished', new Date(t0 + 2000), threadId);
    await storage.saveMessages({ messages: [earlier] });

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(earlier, 'memory');
    messageList.add(user, 'input');
    messageList.add(reply, 'response');

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();

    vi.spyOn(storage, 'saveMessages').mockRejectedValueOnce(new Error('SQLITE_BUSY: database is locked'));

    await expect(turn.step(1).prepare()).rejects.toThrow('SQLITE_BUSY');

    expect(messageList.get.input.db().map(m => m.id)).toEqual(['user-2']);
    expect(messageList.get.response.db().map(m => m.id)).toEqual(['reply-2']);
    expect(messageList.get.all.db().map(m => m.id)).toEqual(['earlier', 'user-2', 'reply-2']);
  });

  it('keeps a restored response separate from an earlier assistant message', async () => {
    const threadId = 'thread-failed-response-save';
    const { storage, om } = await setup(threadId);

    const t0 = Date.now() - 60_000;
    const earlier = textMessage('earlier', 'assistant', 'already saved', new Date(t0), threadId);
    const reply = textMessage('reply-2', 'assistant', 'tool finished', new Date(t0 + 1000), threadId);
    await storage.saveMessages({ messages: [earlier] });

    const messageList = new MessageList({ threadId, resourceId });
    messageList.add(earlier, 'memory');
    messageList.add(reply, 'response', { merge: false });

    const turn = om.beginTurn({ threadId, resourceId, messageList });
    await turn.start();

    vi.spyOn(storage, 'saveMessages').mockRejectedValueOnce(new Error('SQLITE_BUSY: database is locked'));

    await expect(turn.step(1).prepare()).rejects.toThrow('SQLITE_BUSY');

    expect(messageList.get.all.db().map(m => m.id)).toEqual(['earlier', 'reply-2']);
    expect(messageList.get.response.db().map(m => m.id)).toEqual(['reply-2']);
  });
});
