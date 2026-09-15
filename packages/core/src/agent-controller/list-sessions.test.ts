import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createController() {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
  return new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'build', name: 'Build', default: true, agent, defaultModelId: 'openai/gpt-4o' }],
  });
}

describe('AgentController.listSessions', () => {
  it('returns the live sessions and forgets a deleted one', async () => {
    const controller = createController();
    await controller.init();
    const a = await controller.createSession({ id: 'session-a', ownerId: 'owner', resourceId: 'user-a' });
    const b = await controller.createSession({ id: 'session-b', ownerId: 'owner', resourceId: 'user-b' });

    expect(await controller.listSessions()).toEqual(expect.arrayContaining([a, b]));
    expect(await controller.listSessions()).toHaveLength(2);

    await controller.deleteSession({ resourceId: 'user-a' });

    expect(await controller.listSessions()).toEqual([b]);
  });
});
