import { stateSchema } from '@mastra/code-sdk/schema';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { prepareSessionRunContext } from '../integrations/subscription-session.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryBackgroundNoticeDelivery } from './background-notices.js';
import { createWakeSessionResolver } from './session-threads.js';

const signal = {
  id: 'background-process:7:call-1',
  type: 'notification' as const,
  tagName: 'notification',
  contents: 'Background command exited with code 0: pnpm dev',
};

async function setup() {
  const seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
  const sourceControl = seed.sourceControl.forIntegration('github');
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '456', slug: 'acme/web', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/web',
  });
  const { sessions } = sourceControl;
  for (const sessionId of ['session-a', 'session-b']) {
    await sessions.create({
      sessionId,
      projectRepositoryId: link.id,
      factoryProjectId: project.id,
      orgId: 'org-1',
      userId: 'user-1',
      branch: `user/${sessionId}`,
      baseBranch: 'main',
      visibility: 'org',
    });
  }
  const controller = new AgentController<MastraCodeState>({
    id: 'factory-background-notices',
    stateSchema,
    storage: new InMemoryStore({ id: 'factory-background-notices' }),
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        agent: new Agent({
          id: 'test-agent',
          name: 'Test agent',
          instructions: 'Test.',
          model: { id: 'openai/gpt-5.5' },
        }),
      },
    ],
  });
  await controller.init();
  // A shared session runs on its Factory's resource; the threads it opens carry its id as a stamp.
  const session = await controller.createSession({ id: 'session-a', resourceId: project.id, threadId: 'session-a' });
  const second = await session.thread.create();
  await session.thread.setSettingOn({ threadId: second.id, key: 'factorySessionId', value: 'session-a' });
  const resolveWakeSession = createWakeSessionResolver({
    controller: () => controller,
    sessions,
    runs: seed.workItems,
  });
  const delivery = createFactoryBackgroundNoticeDelivery({
    getController: () => controller,
    resolveWakeSession,
    // As Factory prepares every wake: the owner of the session the thread belongs to.
    prepareWakeRequestContext: async ({ requestContext, resourceId, threadId }) => {
      const { sessionId, row } = await resolveWakeSession({ resourceId, threadId });
      if (!row) throw new Error('no owner');
      await prepareSessionRunContext(requestContext, sessionId, { sessions });
    },
  });
  const woken = vi.spyOn(session, 'sendSignal').mockReturnValue({
    id: signal.id,
    type: 'notification',
    accepted: Promise.resolve({ accepted: true, action: 'wake' }),
  });
  const saved = vi.spyOn(session, 'sendSignalToThread');
  return { project, controller, session, second, delivery, woken, saved };
}

describe('Factory background notices', () => {
  // Factory registers sessions by session id; a session's other threads only name it in their stamp.
  it("reaches a session from a command on one of its other threads, waking it as the session's owner", async () => {
    const { project, session, second, delivery, woken, saved } = await setup();
    const target = { resourceId: project.id, threadId: second.id };
    expect(session.thread.getId()).toBe(second.id);

    await delivery.deliver(target, signal);
    expect(woken).toHaveBeenCalledTimes(1);
    const { requestContext } = woken.mock.calls[0]![1] as { requestContext: RequestContext };
    expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });

    // Once the session moved to another thread, the notice waits on the thread that ran the command.
    await session.thread.switch({ threadId: 'session-a' });
    await delivery.deliver(target, signal);
    expect(woken).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledWith(signal, target);
  });

  it('holds a notice for a session that is offline, and drops the ones no session owns so they cannot crowd it out', async () => {
    const { project, controller, session, delivery, woken, saved } = await setup();
    const offline = { resourceId: project.id, threadId: 'session-b' };
    await delivery.deliver(offline, signal, { wake: false });
    // A stamp naming a session, on a thread under a resource that session doesn't run on.
    const forged = await session.thread.create();
    await session.thread.setSettingOn({ threadId: forged.id, key: 'factorySessionId', value: 'session-a' });
    for (let i = 0; i < 100; i++) {
      await delivery.deliver({ resourceId: 'user-attacker', threadId: forged.id }, { ...signal, id: `junk-${i}` });
    }
    expect(woken).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();

    const back = await controller.createSession({ id: 'session-b', resourceId: project.id, threadId: 'session-b' });
    const delivered = vi.spyOn(back, 'sendSignalToThread');
    await delivery.flush();

    expect(delivered).toHaveBeenCalledTimes(1);
    expect(delivered).toHaveBeenCalledWith(signal, offline);
  });
});
