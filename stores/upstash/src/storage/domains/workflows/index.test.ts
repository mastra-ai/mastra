import { randomUUID } from 'node:crypto';
import { createSampleWorkflowSnapshot } from '@internal/storage-test-utils';
import type { Redis } from '@upstash/redis';
import { describe, expect, it } from 'vitest';

import { WorkflowsUpstash } from './index';

function createInMemoryRedisClient(): Redis {
  const store = new Map<string, unknown>();

  const matchKeys = (pattern: string) => {
    const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return [...store.keys()].filter(key => regex.test(key));
  };

  return {
    set: async (key: string, value: unknown) => {
      store.set(key, value);
      return 'OK';
    },
    get: async <T>(key: string) => (store.has(key) ? (store.get(key) as T) : null),
    del: async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
      }
      return deleted;
    },
    scan: async (_cursor: string, opts?: { match?: string }) => ['0', matchKeys(opts?.match ?? '*')] as [string, string[]],
    pipeline: () => {
      const commands: Array<() => Promise<unknown>> = [];
      return {
        get: (key: string) => {
          commands.push(async () => store.get(key) ?? null);
        },
        exec: async () => Promise.all(commands.map(command => command())),
      };
    },
    eval: async () => null,
  } as unknown as Redis;
}

describe('WorkflowsUpstash.persistWorkflowSnapshot', () => {
  it('preserves createdAt across subsequent upserts when caller omits it', async () => {
    const workflows = new WorkflowsUpstash({ client: createInMemoryRedisClient() });
    const { snapshot, runId } = createSampleWorkflowSnapshot('running');
    const workflowName = `wf-${randomUUID()}`;
    const originalCreatedAt = new Date('2024-01-15T10:00:00.000Z');

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot,
      createdAt: originalCreatedAt,
      updatedAt: originalCreatedAt,
    });

    await workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      snapshot: { ...snapshot, status: 'success' },
      updatedAt: new Date('2024-06-01T12:00:00.000Z'),
    });

    const fetched = await workflows.getWorkflowRunById({ runId, workflowName });
    expect(fetched?.createdAt.getTime()).toBe(originalCreatedAt.getTime());
    expect(fetched?.updatedAt.getTime()).toBe(new Date('2024-06-01T12:00:00.000Z').getTime());
  });
});
