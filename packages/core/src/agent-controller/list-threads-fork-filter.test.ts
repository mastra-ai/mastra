import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createController(resourceId: string) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    resourceId,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
}

async function writeThreadDirect(
  controller: AgentController,
  thread: {
    id: string;
    resourceId: string;
    title?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const storage = (controller as unknown as { config: { storage: InMemoryStore } }).config.storage;
  const memory = await storage.getStore('memory');
  if (!memory) throw new Error('memory store missing');
  const now = new Date();
  await memory.saveThread({
    thread: {
      id: thread.id,
      resourceId: thread.resourceId,
      title: thread.title,
      metadata: thread.metadata,
      createdAt: now,
      updatedAt: now,
    },
  });
}

describe('AgentController listThreads — forked subagent filter', () => {
  it('hides forkedSubagent threads by default', async () => {
    const controller = createController('rid-1');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // Drop the auto-created starter thread so assertions see only seeded threads.
    await session.thread.delete({ threadId: session.thread.getId()! });

    await writeThreadDirect(controller, { id: 'normal-1', resourceId: 'rid-1', title: 'Normal' });
    await writeThreadDirect(controller, {
      id: 'fork-1',
      resourceId: 'rid-1',
      title: 'Fork: Explore subagent',
      metadata: { forkedSubagent: true, parentThreadId: 'normal-1' },
    });

    const threads = await session.thread.list();

    expect(threads.map(t => t.id)).toEqual(['normal-1']);
  });

  it('includes forks when includeForkedSubagents=true', async () => {
    const controller = createController('rid-2');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // Drop the auto-created starter thread so assertions see only seeded threads.
    await session.thread.delete({ threadId: session.thread.getId()! });

    await writeThreadDirect(controller, { id: 'normal-2', resourceId: 'rid-2' });
    await writeThreadDirect(controller, {
      id: 'fork-2',
      resourceId: 'rid-2',
      metadata: { forkedSubagent: true, parentThreadId: 'normal-2' },
    });

    const threads = await session.thread.list({ includeForkedSubagents: true });

    expect(threads.map(t => t.id).sort()).toEqual(['fork-2', 'normal-2']);
  });

  it('default filter still applies when allResources=true', async () => {
    // Cross-resource debug listing should still hide transient forks unless
    // explicitly requested.
    const controller = createController('rid-3');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // Drop the auto-created starter thread so assertions see only seeded threads.
    await session.thread.delete({ threadId: session.thread.getId()! });

    await writeThreadDirect(controller, { id: 'a-normal', resourceId: 'rid-other' });
    await writeThreadDirect(controller, {
      id: 'a-fork',
      resourceId: 'rid-other',
      metadata: { forkedSubagent: true },
    });

    const threads = await session.thread.list({ allResources: true });

    expect(threads.map(t => t.id)).toEqual(['a-normal']);
  });

  it('does not filter threads where forkedSubagent is falsy or missing', async () => {
    // Defensive: only `forkedSubagent === true` should hide a thread.
    const controller = createController('rid-4');
    await controller.init();
    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
    // Drop the auto-created starter thread so assertions see only seeded threads.
    await session.thread.delete({ threadId: session.thread.getId()! });

    await writeThreadDirect(controller, { id: 't-undef', resourceId: 'rid-4' });
    await writeThreadDirect(controller, { id: 't-false', resourceId: 'rid-4', metadata: { forkedSubagent: false } });
    await writeThreadDirect(controller, {
      id: 't-string',
      resourceId: 'rid-4',
      metadata: { forkedSubagent: 'true' as unknown as boolean },
    });

    const threads = await session.thread.list();
    expect(threads.map(t => t.id).sort()).toEqual(['t-false', 't-string', 't-undef']);
  });
});
