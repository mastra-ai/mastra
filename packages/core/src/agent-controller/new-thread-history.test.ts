import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

// Like @mastra/memory, recall rejects for a thread it doesn't hold.
class StrictMemory extends MockMemory {
  override async recall(args: Parameters<MockMemory['recall']>[0]) {
    if (!(await this.getThreadById({ threadId: args.threadId }))) {
      throw new Error(`No thread found with id ${args.threadId}`);
    }
    return super.recall(args);
  }
}

describe('AgentController history subscription on a new thread', () => {
  it('creates a session whose thread memory does not hold yet', async () => {
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'test-controller',
      resourceId: 'controller-resource',
      storage: new InMemoryStore(),
      // Separate storage: the controller's new thread is not in this memory.
      memory: new StrictMemory({ storage: new InMemoryStore() }),
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: new Agent({
            name: 'test-agent',
            instructions: 'You are a test agent.',
            model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
          }),
        },
      ],
    });
    await controller.init();

    const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });

    expect(session.thread.getId()).toBeTruthy();
  });
});
