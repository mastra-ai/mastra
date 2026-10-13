import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerMode } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

const testAgent = () =>
  new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'Test agent.', model: { id: 'openai/gpt-4o' } });

const buildMode: AgentControllerMode = { id: 'build', name: 'Build', default: true, agent: testAgent() };
const planMode: AgentControllerMode = { id: 'plan', name: 'Plan', agent: testAgent() };

async function startController(storage: InMemoryStore, modes: AgentControllerMode[]) {
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage,
    stateSchema: undefined,
    modes,
  });
  await controller.init();
  return controller;
}

describe('Factory sessions without modes', () => {
  it('given a thread saved in Plan mode, when Factory reopens it with only Build, then the session runs in Build', async () => {
    const storage = new InMemoryStore({ id: 'build-only-mode' });
    const before = await startController(storage, [buildMode, planMode]);
    const planningSession = await before.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    const thread = await planningSession.thread.create();
    await planningSession.mode.switch({ modeId: 'plan' });

    const after = await startController(storage, [buildMode]);
    const session = await after.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    await session.thread.switch({ threadId: thread.id });

    expect(session.mode.get()).toBe('build');
  });
});
