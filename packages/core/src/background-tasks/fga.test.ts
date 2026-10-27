import { describe, expect, it } from 'vitest';
import { FGADeniedError } from '../auth/ee/fga-check';
import type { IFGAProvider } from '../auth/ee/interfaces/fga';
import { Mastra } from '../mastra';
import { InMemoryStore } from '../storage';

// Policy-backed provider: denies anything not explicitly granted.
function createPolicyFGAProvider(grants: string[]): IFGAProvider {
  const allowed = new Set(grants);
  const key = (user: any, resource: { type: string; id: string }, permission: unknown) =>
    `${user?.id}:${resource.type}:${resource.id}:${String(permission)}`;
  return {
    check: async (user, { resource, permission }) => allowed.has(key(user, resource, permission)),
    require: async (user, { resource, permission }) => {
      if (!allowed.has(key(user, resource, permission))) throw new FGADeniedError(user, resource, permission);
    },
    filterAccessible: async (_user, resources) => resources,
  };
}

describe('background tasks with FGA configured', () => {
  // Background tasks run on internal scheduler workflows with no end user in the
  // request context. Their nested attempt workflow used to be FGA-checked and
  // denied ("authenticated user is required"), so every task ended `failed`.
  it('completes an enqueued task instead of failing with an FGA denial', async () => {
    const mastra = new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      backgroundTasks: { enabled: true },
      server: { fga: createPolicyFGAProvider([]) },
    });
    const manager = mastra.backgroundTaskManager!;
    manager.registerStaticExecutor('lookup', { execute: async () => ({ found: 42 }) });

    try {
      const { task } = await manager.enqueue({
        toolName: 'lookup',
        toolCallId: 'call-1',
        args: {},
        agentId: 'agent-1',
        runId: 'run-1',
      });
      const done = await manager.waitForNextTask([task.id], { timeoutMs: 5000 });

      expect(done.error).toBeUndefined();
      expect(done.status).toBe('completed');
      expect(done.result).toEqual({ found: 42 });
    } finally {
      await mastra.stopWorkers();
    }
  });
});
