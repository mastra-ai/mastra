import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { listFactorySessionThreads } from './session-threads.js';

const SESSION = { sessionId: 'session-1', userId: 'user-1', factoryProjectId: 'project-1' };

async function controllerWith(threads: { id: string; resourceId: string; metadata?: Record<string, unknown> }[]) {
  const storage = new InMemoryStore();
  const memory = (await storage.getStore('memory'))!;
  const now = new Date('2026-10-01T00:00:00.000Z');
  for (const thread of threads) {
    await memory.saveThread({ thread: { ...thread, title: thread.id, createdAt: now, updatedAt: now } });
  }
  return new AgentController({
    id: 'code',
    storage,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({ id: 'agent', name: 'agent', instructions: 'test', model: {} as any }),
      },
    ],
  });
}

describe('listFactorySessionThreads', () => {
  it("lists the session's own, stamped and pre-migration threads", async () => {
    const controller = await controllerWith([
      { id: 'session-1', resourceId: 'project-1' },
      { id: 'opened-later', resourceId: 'project-1', metadata: { factorySessionId: 'session-1' } },
      { id: 'owner-thread', resourceId: 'user-1', metadata: { factorySessionId: 'session-1' } },
      { id: 'legacy', resourceId: 'session-1' },
      { id: 'neighbour', resourceId: 'project-1', metadata: { factorySessionId: 'session-2' } },
    ]);

    const threads = await listFactorySessionThreads(controller, SESSION);

    expect(threads.map(thread => thread.id).sort()).toEqual(['legacy', 'opened-later', 'owner-thread', 'session-1']);
  });

  it("leaves out a thread another resource stamped with the session's id", async () => {
    const controller = await controllerWith([
      { id: 'session-1', resourceId: 'project-1' },
      { id: 'forged', resourceId: 'user-atk', metadata: { factorySessionId: 'session-1' } },
    ]);

    const threads = await listFactorySessionThreads(controller, SESSION);

    expect(threads.map(thread => thread.id)).toEqual(['session-1']);
  });
});
