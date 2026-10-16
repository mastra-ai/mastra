import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { listFactorySessionThreads } from '../session/session-threads.js';
import { observeSessionThreadStamp } from '../session/thread-session-stamp.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryStartCoordinator } from './start-coordinator.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';

function sourceControl() {
  const row = (sessionId: string) => ({
    id: `source-${sessionId}`,
    sessionId,
    projectRepositoryId: 'project-repository-1',
    orgId: 'org-1',
    userId: 'user-1',
    branch: `factory/${sessionId}`,
    baseBranch: 'main',
  });
  return {
    integrationId: 'github',
    sessions: { getBySessionId: vi.fn(async (sessionId: string) => row(sessionId)) },
    projectRepositories: {
      get: vi.fn(async ({ id }: { id: string }) => ({
        id,
        connectionId: 'connection-1',
        repositoryId: 'repository-1',
      })),
      list: vi.fn(async () => [{ id: 'project-repository-1', repositoryId: 'repository-1' }]),
    },
    repositories: { get: vi.fn(async ({ id }: { id: string }) => ({ id, externalId: '1', slug: 'owner/repo' })) },
    connections: {
      get: vi.fn(async () => ({ factoryProjectId: PROJECT_ID })),
      list: vi.fn(async () => [{ id: 'connection-1', integrationId: 'github' }]),
    },
  };
}

function runRequest(
  sessionId: string,
  externalId: string,
  source: { type?: 'issue' | 'pull-request'; authorTrusted?: boolean } = {},
) {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: PROJECT_ID,
    sessionId,
    threadTitle: `Run ${externalId}`,
    kickoffKey: `kickoff-${externalId}`,
    modelScope: 'factory' as const,
    workItem: {
      role: 'work',
      input: {
        externalSource: { integrationId: 'github', type: source.type ?? 'issue', externalId },
        title: `Issue ${externalId}`,
        stages: ['intake'],
        sessions: {},
        metadata: { authorTrusted: source.authorTrusted ?? true },
      },
    },
  };
}

async function setup() {
  const controller = new AgentController({
    id: 'code',
    storage: new InMemoryStore({ id: 'concurrent-runs' }),
    stateSchema: undefined,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        defaultModelId: 'openai/gpt-5.5',
        agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'Test.', model: 'openai/gpt-5.5' }),
      },
    ],
  });
  await controller.init();
  controller.onSessionCreated(session => observeSessionThreadStamp(session));
  const seed = await createFactoryStorageForTests();
  const coordinator = new FactoryStartCoordinator(
    controller as never,
    seed.workItems,
    undefined,
    sourceControl() as never,
  );

  return { controller, coordinator };
}

describe('scenario: concurrent runs in one Factory', () => {
  it('keeps two runs live side by side under the Factory resource (#19357)', async () => {
    const { controller, coordinator } = await setup();
    const first = await coordinator.prepare(runRequest('run-a', '1'));
    const runA = await controller.getSession('run-a');
    const abortA = vi.spyOn(runA!, 'abort');
    const second = await coordinator.prepare(runRequest('run-b', '2'));
    const runB = await controller.getSession('run-b');

    expect(first).toMatchObject({ sessionId: 'run-a', threadId: 'run-a', resourceId: PROJECT_ID });
    expect(second).toMatchObject({ sessionId: 'run-b', threadId: 'run-b', resourceId: PROJECT_ID });
    // Starting the second run neither replaced nor stopped the first.
    expect(runB).not.toBe(runA);
    expect(await controller.getSession('run-a')).toBe(runA);
    expect(abortA).not.toHaveBeenCalled();
    expect(runA!.thread.getId()).toBe('run-a');
    expect(runB!.thread.getId()).toBe('run-b');
    expect(runA!.identity.getResourceId()).toBe(PROJECT_ID);
    expect(runB!.identity.getResourceId()).toBe(PROJECT_ID);
    // Both run threads belong to the Factory, each stamped with its own session.
    const threads = await controller.queryThreads({ resourceId: PROJECT_ID });
    expect(threads.map(thread => [thread.id, thread.metadata?.factorySessionId]).sort()).toEqual([
      ['run-a', 'run-a'],
      ['run-b', 'run-b'],
    ]);

    // A session's own listing leaves out the other run's threads on the shared resource.
    const extra = await runA!.thread.create();
    await vi.waitFor(async () =>
      expect((await listFactorySessionThreads(controller, 'run-a')).map(thread => thread.id).sort()).toEqual(
        [extra.id, 'run-a'].sort(),
      ),
    );
    expect((await listFactorySessionThreads(controller, 'run-b')).map(thread => thread.id)).toEqual(['run-b']);
  });

  it('keeps a run on untrusted content off the shared Factory memory', async () => {
    const { controller, coordinator } = await setup();

    const trusted = await coordinator.prepare(runRequest('run-trusted', '1'));
    const pullRequest = await coordinator.prepare(runRequest('run-pr', '2', { type: 'pull-request' }));
    const outsiderIssue = await coordinator.prepare(runRequest('run-outsider', '3', { authorTrusted: false }));

    expect(trusted.resourceId).toBe(PROJECT_ID);
    expect(pullRequest.resourceId).toBe('run-pr');
    expect(outsiderIssue.resourceId).toBe('run-outsider');
    expect((await controller.getSession('run-pr'))!.identity.getResourceId()).toBe('run-pr');
    expect((await controller.getSession('run-outsider'))!.identity.getResourceId()).toBe('run-outsider');
    // Resource-scoped memory follows the resource: only the trusted run sits on the Factory's.
    expect((await controller.queryThreads({ resourceId: PROJECT_ID })).map(thread => thread.id)).toEqual([
      'run-trusted',
    ]);
  });

  it('keeps an isolated session isolated, and refuses untrusted work in a shared one', async () => {
    const { controller, coordinator } = await setup();

    await coordinator.prepare(runRequest('run-a', '1', { authorTrusted: false }));
    // The author is later stamped as a collaborator; the session keeps its own memory.
    const again = await coordinator.prepare(runRequest('run-a', '1'));
    expect(again.resourceId).toBe('run-a');
    expect((await controller.getSession('run-a'))!.identity.getResourceId()).toBe('run-a');

    await coordinator.prepare(runRequest('run-b', '2'));
    await expect(coordinator.prepare(runRequest('run-b', '3', { type: 'pull-request' }))).rejects.toThrow(
      'already shares memory with this Factory',
    );
  });
});
