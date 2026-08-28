import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ProjectRoutes } from './projects.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';

/**
 * Composition scenario for `POST /web/factory/projects/:id/apply-default-model`.
 *
 * The unit tests in `projects.test.ts` mock the session, so they can only prove
 * the route *calls* `setSettingOn` with some key. The half that matters —
 * whether a live run then actually adopts that model — lives in core's
 * `SessionModel.syncFromPersisted`, which reads the same key back at run start.
 *
 * Nothing asserts those two halves agree. That seam is the whole feature: the
 * route deliberately does not touch the session's in-memory selection, so if
 * the persisted key ever drifts from what core reads, the action silently
 * becomes a no-op and every mock-based test stays green.
 *
 * These tests wire the real route to a real `AgentController` over real storage
 * and assert the outcome the user actually wants, never the key itself.
 */

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

describe('scenario: apply-default-model reaches a live run', () => {
  it('a bound run adopts the project default at its next start', async () => {
    const storage = new InMemoryStore({ id: 'apply-default-model' });
    const { seed, project } = await seedProject('anthropic/claude-opus-4-6');

    // A live board run: a session bound to a work item, on its own thread,
    // currently running some other model.
    const controller = await buildController(storage, 'code');
    const session = await controller.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });
    const thread = await session.thread.create();
    await session.model.switch({ modelId: 'openai/gpt-5.2-codex' });

    const bound = await seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:1' },
          title: 'Issue 1',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: session.identity.getId(), branch: 'factory/issue-1', threadId: thread.id },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-1',
      kickoffMessage: null,
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
    expect(await response.json()).toMatchObject({
      applied: [{ workItemId: bound.item.id, role: 'work', threadId: thread.id }],
    });

    // The live session is deliberately left stale — the route never touches
    // its in-memory selection.
    expect(session.model.get()).toBe('openai/gpt-5.2-codex');

    // ...and the run adopts the default when it next starts, which is the
    // reconciliation every run performs before it streams.
    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });

  it('does not disturb another thread sharing the same session', async () => {
    const storage = new InMemoryStore({ id: 'apply-default-model-sibling' });
    const { seed, project } = await seedProject('anthropic/claude-opus-4-6');

    const controller = await buildController(storage, 'code');
    const session = await controller.createSession({ resourceId: 'resource-1', ownerId: 'user-1' });

    // Two threads on one shared session: only the first is a bound board run.
    const boundThread = await session.thread.create();
    await session.model.switch({ modelId: 'openai/gpt-5.2-codex' });
    const siblingThread = await session.thread.create();
    await session.model.switch({ modelId: 'openai/gpt-5.5' });

    await seed.workItems.prepareRunStart({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      workItem: {
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: 'github-issue:2' },
          title: 'Issue 2',
          stages: ['execute'],
          sessions: {},
          metadata: {},
        },
      },
      role: 'work',
      session: { sessionId: session.identity.getId(), branch: 'factory/issue-2', threadId: boundThread.id },
      resourceId: 'resource-1',
      kickoffKey: 'kickoff-2',
      kickoffMessage: null,
    });

    const app = mount({
      auth: fakeRouteAuth(),
      projects: seed.projects,
      sourceControl: seed.sourceControl,
      workItems: seed.workItems,
      controller,
    });

    await app.request(`/web/factory/projects/${project.id}/apply-default-model`, { method: 'POST' });

    // The session is still pointed at the sibling thread, and that thread's
    // model survived the sweep untouched.
    expect(session.thread.getId()).toBe(siblingThread.id);
    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    expect(session.model.get()).toBe('openai/gpt-5.5');

    // The bound thread did get the default.
    await session.thread.switch({ threadId: boundThread.id });
    await session.model.syncFromPersisted({ modeId: session.mode.get() });
    expect(session.model.get()).toBe('anthropic/claude-opus-4-6');
  });
});
