import { randomUUID } from 'node:crypto';
import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackgroundTasksLibSQL } from './index';

function task(id: string): BackgroundTask {
  return {
    id,
    status: 'running',
    toolName: 'execute_command',
    toolCallId: 'tool-call-1',
    args: {},
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    runId: 'run-1',
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 180_000,
    createdAt: new Date(),
    startedAt: new Date(),
  };
}

describe('BackgroundTasksLibSQL', () => {
  let client: Client;
  let store: BackgroundTasksLibSQL;

  beforeEach(async () => {
    client = createClient({ url: 'file::memory:' });
    store = new BackgroundTasksLibSQL({ client });
    await store.init();
  });

  afterEach(() => {
    client.close();
  });

  it.each([
    ['multiline string', '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n'],
    ['plain string', 'command completed'],
    ['number', 42],
    ['boolean', true],
  ])('persists a completed %s result as JSON', async (_label, result) => {
    const input = task(randomUUID());
    await store.createTask(input);

    await store.updateTask(input.id, { status: 'completed', result, completedAt: new Date() });

    await expect(store.getTask(input.id)).resolves.toMatchObject({ status: 'completed', result });
  });
});
