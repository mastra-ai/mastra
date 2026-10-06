import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ProjectRoutes } from './projects.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

const testAgent = () =>
  new Agent({
    id: 'test-agent',
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { id: 'openai/gpt-4o' },
  });

async function buildController(storage: InMemoryStore, id: string) {
  const controller = new AgentController({
    workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
    id,
    storage,
    stateSchema: undefined,
    modes: [
      { id: 'build', name: 'Build', default: true, defaultModelId: 'openai/gpt-5.5', agent: testAgent() },
      { id: 'plan', name: 'Plan', defaultModelId: 'openai/gpt-5.2-codex', agent: testAgent() },
    ],
  });
  await controller.init();
  return controller;
}

async function seedProject(defaultModelId: string) {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
  await seed.projects.update({ orgId: 'org-1', id: project.id, input: { defaultModelId } });
  return { seed, project };
}

function mount(deps: ConstructorParameters<typeof ProjectRoutes>[0]) {
  const app = new Hono();
  app.use('*', async (context, next) => {
    context.set('factoryAuthUser' as never, { workosId: 'user-1', organizationId: 'org-1' } as never);
    await next();
  });
  mountApiRoutes(app as never, new ProjectRoutes(deps).routes());
  return app;
}

async function bindRun({
  seed,
  projectId,
  sessionId,
  threadId,
  resourceId,
  externalId,
}: {
  seed: Awaited<ReturnType<typeof createFactoryStorageForTests>>;
  projectId: string;
  sessionId: string;
  threadId: string;
  resourceId: string;
  externalId: string;
}) {
  return seed.workItems.prepareRunStart({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: projectId,
    workItem: {
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId },
        title: externalId,
        stages: ['execute'],
        sessions: {},
        metadata: {},
      },
    },
    role: 'work',
    session: { sessionId, branch: `factory/${externalId}`, threadId },
    resourceId,
    kickoffKey: `kickoff-${externalId}`,
    kickoffMessage: null,
  });
}

describe('scenario: apply-default-model reaches a live run', () => {
  it('a bound run adopts the project default at its next start', async () => {
    const storage = new InMemoryStore({ id: 'apply-default-model' });
    const { seed, project } = await seedProject('anthropic/claude-opus-4-6');
    const controller = await buildController(storage, 'code');
    const session = await controller.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    const thread = await session.thread.create();
    await session.model.switch({ modelId: 'openai/gpt-5.2-codex' });

    await bindRun({
      seed,
      projectId: project.id,
      sessionId: session.identity.getId(),
      threadId: thread.id,
      resourceId: 'resource-1',
      externalId: 'github-issue:1',
    });

    const app = mount({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      sourceControl: seed.sourceControl,
      workItems: seed.workItems,
      controller,
    });

    const response = await app.request(`/web/factory/projects/${project.id}/apply-default-model`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ applied: [thread.id], skipped: [] });
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');

    await session.model.syncFromPersisted();
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('updates the bound thread without changing a sibling thread', async () => {
    const storage = new InMemoryStore({ id: 'apply-default-model-sibling' });
    const { seed, project } = await seedProject('anthropic/claude-opus-4-6');
    const controller = await buildController(storage, 'code');
    const session = await controller.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });

    await session.mode.switch({ modeId: 'plan' });
    const boundThread = await session.thread.create();
    await session.model.switch({ modelId: 'openai/gpt-5.2-codex' });

    const siblingThread = await session.thread.create();
    await session.mode.switch({ modeId: 'build' });
    await session.model.switch({ modelId: 'openai/gpt-5.5' });

    await bindRun({
      seed,
      projectId: project.id,
      sessionId: session.identity.getId(),
      threadId: boundThread.id,
      resourceId: 'resource-1',
      externalId: 'github-issue:2',
    });

    const app = mount({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      sourceControl: seed.sourceControl,
      workItems: seed.workItems,
      controller,
    });

    const response = await app.request(`/web/factory/projects/${project.id}/apply-default-model`, { method: 'POST' });
    expect(await response.json()).toMatchObject({ applied: [boundThread.id], skipped: [] });

    expect(session.thread.getId()).toBe(siblingThread.id);
    await session.model.syncFromPersisted();
    expect(session.model.get()).toBe('openai/gpt-5.5');

    await session.thread.switch({ threadId: boundThread.id });
    await session.model.syncFromPersisted();
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });
});
