import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BackgroundTasksLibSQL } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

function createTask(id: string): BackgroundTask {
  return {
    id,
    status: 'running',
    toolName: 'view',
    toolCallId: `call-${id}`,
    args: { path: 'package.json' },
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    runId: `run-${id}`,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 30_000,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('BackgroundTasksLibSQL', () => {
  let client: Client;
  let store: BackgroundTasksLibSQL;

  beforeEach(async () => {
    client = createClient({ url: TEST_DB_URL });
    store = new BackgroundTasksLibSQL({ client, maxRetries: 1, initialBackoffMs: 10 });
    await store.init();
    await store.dangerouslyClearAll();
  });

  afterEach(() => {
    client.close();
  });

  it('persists primitive and structured task results as JSON', async () => {
    await store.createTask(createTask('string-result'));
    await store.updateTask('string-result', {
      status: 'completed',
      result: 'package.json contents',
      completedAt: new Date('2026-01-01T00:01:00.000Z'),
    });

    expect(await store.getTask('string-result')).toMatchObject({
      status: 'completed',
      result: 'package.json contents',
    });

    await store.createTask(createTask('object-result'));
    await store.updateTask('object-result', {
      status: 'completed',
      result: { files: 3, ok: true },
      completedAt: new Date('2026-01-01T00:02:00.000Z'),
    });

    expect(await store.getTask('object-result')).toMatchObject({
      status: 'completed',
      result: { files: 3, ok: true },
    });
  });
});
