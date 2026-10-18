import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';

const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

describe('background task JSONB storage', () => {
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ id: `background-json-${randomUUID()}`, connectionString });
    await store.init();
  }, 60000);

  afterAll(async () => {
    await store?.close();
  });

  it('repairs task arguments and updated results without losing literal escapes', async () => {
    const tasks = await store.getStore('backgroundTasks');
    const id = randomUUID();
    const data = { path: 'C:\\path\\\uD800-end', literal: String.raw`literal\uD800`, nul: 'a\0b' };
    const expected = { path: 'C:\\path\\�-end', literal: data.literal, nul: 'ab' };

    await tasks.createTask({
      id,
      toolCallId: randomUUID(),
      toolName: 'test',
      agentId: 'agent',
      runId: randomUUID(),
      status: 'pending',
      args: data,
      retryCount: 0,
      maxRetries: 1,
      timeoutMs: 1000,
      createdAt: new Date(),
    });
    expect((await tasks.getTask(id))?.args).toEqual(expected);

    await tasks.updateTask(id, { result: data });
    expect((await tasks.getTask(id))?.result).toEqual(expected);
  });
});
