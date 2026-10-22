import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { AgentControllerMode } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { buildMode } from './build.js';
import { planMode } from './plan.js';

const withTestAgent = (mode: AgentControllerMode): AgentControllerMode => ({
  ...mode,
  agent: new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'Test agent.',
    model: { id: 'openai/gpt-4o' },
  }),
});

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

describe('modeless hosts (`modes: false`)', () => {
  it('given a thread saved in Plan mode, when a modeless host reopens it with only Build, then the session runs in Build', async () => {
    const storage = new InMemoryStore({ id: 'modeless' });
    const before = await startController(storage, [buildMode, planMode].map(withTestAgent));
    const planningSession = await before.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    const thread = await planningSession.thread.create();
    await planningSession.mode.switch({ modeId: 'plan' });

    const after = await startController(storage, [buildMode].map(withTestAgent));
    const session = await after.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    await session.thread.switch({ threadId: thread.id });

    expect(session.mode.get()).toBe('build');
  });
});
