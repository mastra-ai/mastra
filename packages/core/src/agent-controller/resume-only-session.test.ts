import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { isSessionNotStartedError } from './errors';
import { createMockWorkspace } from './test-utils';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

async function createController(storage: InMemoryStore, workspace = createMockWorkspace()) {
  const controller = new AgentController({
    workspace,
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
  });
  await controller.init();
  return controller;
}

describe('AgentController createSession({ resumeOnly })', () => {
  it('refuses to start a session that was never started, without creating a thread or a workspace', async () => {
    const storage = new InMemoryStore();
    const workspaceFactory = vi.fn(() => createMockWorkspace());
    const controller = new AgentController({
      workspace: workspaceFactory,
      id: 'test-controller',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
    });
    await controller.init();

    const error = await controller.createSession({ resourceId: 'r-1', id: 'r-1', resumeOnly: true }).catch(e => e);

    expect(isSessionNotStartedError(error)).toBe(true);
    expect(await controller.queryThreads({ resourceId: 'r-1' })).toEqual([]);
    expect(await controller.getSessionByResource('r-1')).toBeUndefined();
    expect(workspaceFactory).not.toHaveBeenCalled();
  });

  it('returns the live session on its thread', async () => {
    const controller = await createController(new InMemoryStore());
    const started = await controller.createSession({ resourceId: 'r-1', id: 'r-1', threadId: 'thread-1' });

    const resumed = await controller.createSession({ resourceId: 'r-1', id: 'r-1', resumeOnly: true });

    expect(resumed).toBe(started);
    expect(resumed.thread.getId()).toBe('thread-1');
  });

  it('recovers a session lost to a restart onto its stored thread instead of creating one', async () => {
    const storage = new InMemoryStore();
    const before = await createController(storage);
    await before.createSession({ resourceId: 'r-1', id: 'r-1', threadId: 'thread-1' });

    const after = await createController(storage);
    const recovered = await after.createSession({ resourceId: 'r-1', id: 'r-1', resumeOnly: true });

    expect(recovered.thread.getId()).toBe('thread-1');
    expect((await after.queryThreads({ resourceId: 'r-1' })).map(t => t.id)).toEqual(['thread-1']);
  });

  it('does not recover onto a stored thread outside the session scope', async () => {
    const storage = new InMemoryStore();
    const before = await createController(storage);
    await before.createSession({
      resourceId: 'r-1',
      id: 'r-1::/repo-a',
      scope: '/repo-a',
      tags: { projectPath: '/repo-a' },
    });

    const after = await createController(storage);
    const error = await after
      .createSession({
        resourceId: 'r-1',
        id: 'r-1::/repo-b',
        scope: '/repo-b',
        tags: { projectPath: '/repo-b' },
        resumeOnly: true,
      })
      .catch(e => e);

    expect(isSessionNotStartedError(error)).toBe(true);
    expect(await after.queryThreads({ resourceId: 'r-1' })).toHaveLength(1);
  });
});
