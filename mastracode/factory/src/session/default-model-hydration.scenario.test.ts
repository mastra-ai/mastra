import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { hydrateSessionDefaultModel } from './default-model-hydration.js';

const MODE_DEFAULT_MODEL_ID = 'openai/gpt-5.5';

async function mountController(
  storage = new InMemoryStore({ id: 'default-model-hydration' }),
  existingSeed?: FactoryStorageTestSeed,
) {
  const seed = existingSeed ?? (await createFactoryStorageForTests());
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id: 'code',
    storage,
    stateSchema: undefined,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        defaultModelId: MODE_DEFAULT_MODEL_ID,
        agent: new Agent({
          id: 'test-agent',
          name: 'test-agent',
          instructions: 'Test.',
          model: { id: 'openai/gpt-4o' },
        }),
      },
    ],
  });
  await controller.init();
  controller.onSessionCreated(
    session =>
      hydrateSessionDefaultModel(session, {
        sourceControl: {
          sessions: {
            getBySessionId: async sessionId => ({ sessionId, orgId: 'org-1', userId: 'user-1' }) as never,
            getSourceControlBySessionId: async () => null,
          },
        },
        workItems: seed.workItems,
        modelDefaults: seed.modelDefaults,
        projects: seed.projects,
      }),
    { blocking: true },
  );
  return { seed, storage, controller };
}

describe('scenario: a new user session starts on its owner default pair', () => {
  it('runs the personal default model and thinking level, not the mode default', async () => {
    const { seed, controller } = await mountController();
    await seed.modelDefaults.set({
      orgId: 'org-1',
      userId: 'user-1',
      modelId: 'anthropic/claude-opus-4-6',
      thinkingLevel: 'high',
    });

    const session = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });

    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(session.state.get()).toMatchObject({ thinkingLevel: 'high' });
  });

  it('given a seeded chat, when the owner changes their default and the server restarts, then the chat keeps its original pair', async () => {
    const { seed, storage, controller } = await mountController();
    await seed.modelDefaults.set({
      orgId: 'org-1',
      userId: 'user-1',
      modelId: 'anthropic/claude-opus-4-6',
      thinkingLevel: 'high',
    });
    const first = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });
    const threadId = first.thread.requireId();

    await seed.modelDefaults.set({
      orgId: 'org-1',
      userId: 'user-1',
      modelId: 'openai/gpt-5.6',
      thinkingLevel: 'xhigh',
    });
    const restarted = await mountController(storage, seed);
    const reopened = await restarted.controller.createSession({ resourceId: 'session-1', ownerId: 'user-1', threadId });

    expect(reopened.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(reopened.state.get()).toMatchObject({ thinkingLevel: 'high' });
  });
});
