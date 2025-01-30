import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PostgresStore } from '../../../../storage/pg/src/index';
import { Memory } from '../index';

dotenv.config();

const connectionString = process.env.DB_URL! || 'postgresql://postgres:postgres@localhost:5432';
const resourceId = 'test-user';

describe('PgMastraMemory', () => {
  let memory: Memory;

  beforeAll(async () => {
    memory = new Memory({ storage: new PostgresStore({ connectionString }) });
  });

  afterAll(async () => {
    const threads = await memory.getThreadsByResourceId({ resourceId });
    expect(threads.length).toBeGreaterThan(0);
    for (const thread of threads) {
      await memory.deleteThread(thread.id);
    }
    expect((await memory.getThreadsByResourceId({ resourceId })).length).toBe(0);
  });

  it('should create and retrieve a thread', async () => {
    const thread = await memory.createThread({ title: 'Test thread', resourceId });
    const retrievedThread = await memory.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toEqual(thread);
  });

  it('should save and retrieve messages', async () => {
    const thread = await memory.createThread({ title: 'Test thread 2', resourceId });
    const message1 = await memory.addMessage({ threadId: thread.id, content: 'Hello', role: 'user', type: 'text' });
    // const message2 = await memory.addMessage(thread.id, 'World', 'assistant');
    const memoryMessages = await memory.getMessages({ threadId: thread.id });
    const messages = memoryMessages.messages;

    expect(messages[0]?.content).toEqual(message1.content);
  });

  it('should update a thread', async () => {
    const thread = await memory.createThread({ title: 'Initial Thread Title', resourceId });
    const updatedThread = await memory.updateThread({
      id: thread.id,
      title: 'Updated Thread Title',
      metadata: { test: true, updated: true },
    });

    expect(updatedThread.title).toEqual('Updated Thread Title');
    expect(updatedThread.metadata).toEqual({ test: true, updated: true });
  });

  it('should delete a thread', async () => {
    const thread = await memory.createThread({ title: 'Thread to Delete', resourceId });
    await memory.deleteThread(thread.id);

    const retrievedThread = await memory.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeNull();
  });

  it.skip('should delete a message', async () => {
    const thread = await memory.createThread({ title: 'Thread with Message', resourceId });
    const message = await memory.addMessage({
      threadId: thread.id,
      content: 'Message to Delete',
      role: 'user',
      type: 'text',
    });
    // @ts-ignore TODO: implement deleteMessage
    await memory.deleteMessage(message.id);

    const memoryMessages = await memory.getMessages({ threadId: thread.id });
    const messages = memoryMessages.messages;
    expect(messages.length).toEqual(0);
  });
});
