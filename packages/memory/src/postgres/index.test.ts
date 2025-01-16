import dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import { PgMemory } from './';

dotenv.config();

const connectionString = process.env.DB_URL! || 'postgres://postgres:password@localhost:5434/mastra';
const resourceid = 'resource';

describe('PgMastraMemory', () => {
  let memory: PgMemory;

  beforeAll(async () => {
    memory = new PgMemory({ connectionString });
  });

  afterAll(async () => {
    await memory.drop();
  });

  it('should create and retrieve a thread', async () => {
    const thread = await memory.createThread({ title: 'Test thread', resourceid });
    const retrievedThread = await memory.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toEqual(thread);
  });

  it('should save and retrieve messages', async () => {
    const thread = await memory.createThread({ title: 'Test thread 2', resourceid });
    const message1 = await memory.addMessage({ threadId: thread.id, content: 'Hello', role: 'user', type: 'text' });
    // const message2 = await memory.addMessage(thread.id, 'World', 'assistant');
    const memoryMessages = await memory.getMessages({ threadId: thread.id });
    const messages = memoryMessages.messages;

    console.log(messages);
    expect(messages[0]?.content).toEqual(message1.content);
  });

  it('should update a thread', async () => {
    const thread = await memory.createThread({ title: 'Initial Thread Title', resourceid });
    const updatedThread = await memory.updateThread(thread.id, 'Updated Thread Title', { test: true, updated: true });

    expect(updatedThread.title).toEqual('Updated Thread Title');
    expect(updatedThread.metadata).toEqual({ test: true, updated: true });
  });

  it('should delete a thread', async () => {
    const thread = await memory.createThread({ title: 'Thread to Delete', resourceid });
    await memory.deleteThread(thread.id);

    const retrievedThread = await memory.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeNull();
  });

  it('should delete a message', async () => {
    const thread = await memory.createThread({ title: 'Thread with Message', resourceid });
    const message = await memory.addMessage({
      threadId: thread.id,
      content: 'Message to Delete',
      role: 'user',
      type: 'text',
    });
    await memory.deleteMessage(message.id);

    const memoryMessages = await memory.getMessages({ threadId: thread.id });
    const messages = memoryMessages.messages;
    expect(messages.length).toEqual(0);
  });
});
