import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { hydrateSessionDefaultModel } from './default-model-hydration.js';

async function mountController(
  storage = new InMemoryStore({ id: 'default-model-hydration' }),
  existingSeed?: FactoryStorageTestSeed,
  modelScope: 'factory' | 'user' | 'hybrid' = 'user',
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
        defaultModelId: 'openai/gpt-5.5',
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
  const project =
    (await seed.projects.list({ orgId: 'org-1' }))[0] ??
    (await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Personal models' } }));
  await seed.projects.update({ orgId: 'org-1', id: project.id, input: { modelScope } });
  controller.onSessionCreated(
    session =>
      hydrateSessionDefaultModel(session, {
        sourceControl: {
          getBySessionId: async sessionId =>
            ({ sessionId, orgId: 'org-1', userId: 'user-1', factoryProjectId: project.id }) as never,
        },
        projects: seed.projects,
        workItems: seed.workItems,
        modelDefaults: seed.modelDefaults,
      }),
    { blocking: true },
  );
  return { seed, storage, controller, project };
}

describe('scenario: a new user session starts on its owner default model', () => {
  it('runs the personal default model, not the mode default', async () => {
    const { seed, controller } = await mountController();
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'anthropic/claude-opus-4-6' });

    const session = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });

    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('given a thread-agnostic request opens the session first, when the UI binds the conventional thread, then that thread runs the personal default', async () => {
    const { seed, controller } = await mountController();
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'anthropic/claude-opus-4-6' });

    // Server read routes (SSE, messages) get-or-create the session without a thread id.
    await controller.createSession({ resourceId: 'session-1', id: 'session-1', ownerId: 'code' });
    // The Factory UI then binds the session's conventional thread (threadId === sessionId).
    const session = await controller.createSession({
      resourceId: 'session-1',
      id: 'session-1',
      ownerId: 'code',
      threadId: 'session-1',
    });

    expect(session.thread.getId()).toBe('session-1');
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('given a chat holding only coordinator signals, when the server restarts, then it starts on the current default', async () => {
    const { seed, storage, controller } = await mountController();
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'anthropic/claude-opus-4-6' });
    const first = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });
    const threadId = first.thread.requireId();
    const memory = await storage.getStore('memory');
    await memory!.saveMessages({
      messages: [
        {
          id: 'signal-1',
          threadId,
          resourceId: 'session-1',
          role: 'signal',
          createdAt: new Date(),
          content: { format: 2, parts: [{ type: 'text', text: 'skill loaded' }] },
        },
      ],
    });

    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'openai/gpt-5.6' });
    const restarted = await mountController(storage, seed);
    const reopened = await restarted.controller.createSession({ resourceId: 'session-1', ownerId: 'user-1', threadId });

    expect(reopened.model.get()).toBe('openai/gpt-5.6');
  });
});

describe('scenario: a hybrid Factory splits sessions from work-item runs', () => {
  it("starts an interactive session on the owner's default and personal scope", async () => {
    const { seed, controller } = await mountController(undefined, undefined, 'hybrid');
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'anthropic/claude-opus-4-6' });

    const session = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });

    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
    expect(session.state.get()).toMatchObject({ factoryModelScope: 'user', factoryOwnerUserId: 'user-1' });
  });

  it('stamps organization scope on a run-bound thread and leaves its model to the run', async () => {
    const { seed, controller, project } = await mountController(undefined, undefined, 'hybrid');
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'anthropic/claude-opus-4-6' });
    await seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'run-1' },
          title: 'Run',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: 'session-1', branch: 'run-1', threadId: 'run-thread' },
      resourceId: 'session-1',
      kickoffKey: 'run-1',
      kickoffMessage: null,
    });

    const session = await controller.createSession({
      resourceId: 'session-1',
      ownerId: 'user-1',
      threadId: 'run-thread',
    });

    expect(session.model.get()).toBe('openai/gpt-5.5');
    expect(session.state.get()).toMatchObject({ factoryModelScope: 'factory', factoryOwnerUserId: 'user-1' });
  });
});
