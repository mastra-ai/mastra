import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { RequestContext } from '../request-context';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

// A history subscription resolves dynamic memory. Every path that binds a thread
// on the caller's behalf must resolve it with that caller, not a context carrying
// only the controller's own entries.
describe('AgentController history subscriptions', () => {
  async function setup() {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const storage = new InMemoryStore();
    const users: unknown[] = [];
    const memoryFactory = vi.fn().mockImplementation(({ requestContext }) => {
      users.push(requestContext.get('user'));
      return new MockMemory({ storage });
    });
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'x',
      model: { provider: 'openai', name: 'gpt-4o' } as any,
    });
    const subscribe = vi.spyOn(agent, 'subscribeToThread');
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage,
      memory: memoryFactory as any,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    const memoryStore = await storage.getStore('memory');
    for (const id of ['existing', 'other']) {
      await memoryStore!.saveThread({
        thread: { id, resourceId: 'controller-resource', createdAt: now, updatedAt: now, metadata: {} },
      });
    }
    const requestContext = new RequestContext();
    requestContext.set('user', { id: 'user-1' });
    const subscribedUser = (threadId: string) =>
      subscribe.mock.calls.findLast(([opts]) => opts.threadId === threadId)?.[0].requestContext?.get('user');
    return { controller, requestContext, subscribedUser, users };
  }

  it('opens a session on an existing thread with the caller', async () => {
    const { controller, requestContext, subscribedUser } = await setup();
    await controller.createSession({ id: 's', ownerId: 'o', threadId: 'existing', requestContext });
    expect(subscribedUser('existing')).toEqual({ id: 'user-1' });
  });

  it('resumes the most recent thread with the caller', async () => {
    const { controller, requestContext, subscribedUser } = await setup();
    const session = await controller.createSession({ id: 's', ownerId: 'o', requestContext });
    const threadId = session.thread.getId()!;
    expect(subscribedUser(threadId)).toEqual({ id: 'user-1' });
  });

  it('switches and creates threads with the caller', async () => {
    const { controller, requestContext, subscribedUser } = await setup();
    const session = await controller.createSession({ id: 's', ownerId: 'o' });

    await session.thread.switch({ threadId: 'other', requestContext });
    expect(subscribedUser('other')).toEqual({ id: 'user-1' });

    const created = await session.thread.create({ requestContext });
    expect(subscribedUser(created.id)).toEqual({ id: 'user-1' });
  });
});
