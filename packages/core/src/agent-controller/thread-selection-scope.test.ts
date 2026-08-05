import { describe, expect, it } from 'vitest';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace, createTestAgent } from './test-utils';
import type { AgentControllerRequestContext } from './types';

const SERVER_ROOT = '/srv/mastra-code';
const SESSION_WORKDIR = '/srv/sandboxes/session-1';

/**
 * Mirrors the Factory's workspace factory: it pins the session's `projectPath`
 * to that session's sandbox workdir before the session is built, so the
 * controller-global `projectPath` is never the session's own scope.
 */
function createSessionScopedWorkspaceFactory(workdir: string) {
  return async ({ requestContext }: { requestContext: any }) => {
    const ctx = requestContext.get('controller') as AgentControllerRequestContext<{ projectPath?: string }> | undefined;
    if (ctx && ctx.getState()?.projectPath !== workdir) {
      await ctx.setState({ projectPath: workdir });
    }
    return createMockWorkspace();
  };
}

function createController(
  storage: InMemoryStore,
  options: { workspace?: unknown; initialState?: Record<string, unknown> } = {},
) {
  return new AgentController({
    id: 'test-controller',
    storage,
    workspace: (options.workspace ?? createMockWorkspace()) as any,
    initialState: options.initialState ?? { projectPath: SERVER_ROOT },
    modes: [{ id: 'default', name: 'Default', default: true, agent: createTestAgent() }],
  });
}

describe('AgentController thread selection — session scope', () => {
  it('resumes the thread of a session whose workspace rewrote its projectPath', async () => {
    const storage = new InMemoryStore();
    const workspace = createSessionScopedWorkspaceFactory(SESSION_WORKDIR);

    const first = createController(storage, { workspace });
    await first.init();
    const firstSession = await first.createSession({ id: 'session-1', ownerId: 'owner', resourceId: 'session-1' });
    const threadId = firstSession.thread.requireId();

    const restarted = createController(storage, { workspace });
    await restarted.init();
    const resumed = await restarted.createSession({ id: 'session-1', ownerId: 'owner', resourceId: 'session-1' });

    expect(resumed.thread.requireId()).toBe(threadId);
    expect(await resumed.thread.list()).toHaveLength(1);
  });

  // Worktrees of one repo share a resourceId, so a thread carrying no scope is
  // exactly the one a worktree session must leave alone.
  it('does not resume an unscoped thread from a scoped session', async () => {
    const storage = new InMemoryStore();

    const unscoped = createController(storage, { initialState: {} });
    await unscoped.init();
    const untagged = await unscoped.createSession({ id: 'a', ownerId: 'owner', resourceId: 'shared' });

    const worktree = createController(storage, { initialState: { projectPath: '/wt/current' } });
    await worktree.init();
    const scoped = await worktree.createSession({ id: 'b', ownerId: 'owner', resourceId: 'shared' });

    expect(scoped.thread.requireId()).not.toBe(untagged.thread.requireId());
  });

  it('keeps worktrees on their own thread when the caller tags the scope', async () => {
    const storage = new InMemoryStore();
    const controller = createController(storage, { initialState: {} });
    await controller.init();

    const a = await controller.createSession({
      id: 'a',
      ownerId: 'owner',
      resourceId: 'shared',
      scope: '/wt/a',
      tags: { projectPath: '/wt/a' },
    });
    const b = await controller.createSession({
      id: 'b',
      ownerId: 'owner',
      resourceId: 'shared',
      scope: '/wt/b',
      tags: { projectPath: '/wt/b' },
    });

    expect(b.thread.requireId()).not.toBe(a.thread.requireId());
  });

  it('does not let an inferred scope claim a thread another scope tagged', async () => {
    const storage = new InMemoryStore();
    const controller = createController(storage, { initialState: {} });
    await controller.init();

    const tagged = await controller.createSession({
      id: 'a',
      ownerId: 'owner',
      resourceId: 'shared',
      scope: '/wt/a',
      tags: { projectPath: '/wt/a' },
    });

    const inferred = createController(storage, { initialState: { projectPath: '/wt/b' } });
    await inferred.init();
    const other = await inferred.createSession({ id: 'b', ownerId: 'owner', resourceId: 'shared' });

    expect(other.thread.requireId()).not.toBe(tagged.thread.requireId());
  });
});
