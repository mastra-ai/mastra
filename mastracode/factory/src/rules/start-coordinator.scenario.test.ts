import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { createTriageWorkRegistry } from '../boards/test-utils.js';
import type { GithubIntegration } from '../integrations/github/integration.js';
import { prepareFactoryRuleBinding } from '../routes/surface.js';
import { recordRunRepositoryChoice } from '../session/self-review-gate.js';
import { listFactorySessionThreads } from '../session/session-threads.js';
import { observeSessionThreadStamp } from '../session/thread-session-stamp.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryDispatchError } from './dispatch-errors.js';
import type { FactoryBindingPreparationInput } from './dispatcher.js';
import { FactoryStartCoordinator } from './start-coordinator.js';

const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const runSession = (sessionId: string) => ({
  sessionId,
  orgId: 'org-1',
  userId: 'user-1',
  factoryProjectId: PROJECT_ID,
});
// Both sessions are runs, so their run bindings let them claim the Factory's resource.
const RUNS = { hasRunBindingForSession: async () => true };

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
      expect(
        (await listFactorySessionThreads(controller, runSession('run-a'), RUNS)).map(thread => thread.id).sort(),
      ).toEqual([extra.id, 'run-a'].sort()),
    );
    expect((await listFactorySessionThreads(controller, runSession('run-b'), RUNS)).map(thread => thread.id)).toEqual([
      'run-b',
    ]);
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

describe('scenario: a card that names no repository in a multi-repository Factory', () => {
  async function seedMultiRepositoryFactory() {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('github');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const connection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const link = async (externalId: string, slug: string) => {
      const repository = await sourceControl.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId, slug, defaultBranch: 'main' },
      });
      return sourceControl.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'user-1',
        sandboxProvider: 'local',
        sandboxWorkdir: `/sandbox/${slug}`,
      });
    };
    const mastra = await link('456', 'mastra-ai/mastra');
    const hydra = await link('789', 'internetburrito/hydra');
    // A hand-filed card: nothing on it says which repository it belongs to.
    const { item } = await seeded.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: { title: 'Speed up the hydra build', stages: ['triage'], sessions: {}, metadata: {} },
    });

    const controller = new AgentController({
      id: 'code',
      storage: new InMemoryStore({ id: 'repository-choice' }),
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
    const coordinator = new FactoryStartCoordinator(controller, seeded.workItems, undefined, sourceControl);
    const github = { id: 'github', sourceControlStorage: sourceControl } as unknown as GithubIntegration;

    const dispatch = async (decisionId: string) => {
      const card = await seeded.workItems.get({ orgId: 'org-1', id: item.id });
      await prepareFactoryRuleBinding(github, coordinator, seeded.projects, boards, {
        record: { id: decisionId, orgId: 'org-1', factoryProjectId: project.id },
        item: card,
        role: 'triage',
      } as unknown as FactoryBindingPreparationInput);
      const refreshed = await seeded.workItems.get({ orgId: 'org-1', id: item.id });
      const sessionId = refreshed!.sessions.triage!.sessionId;
      const session = (await controller.getSession(sessionId))!;
      return { card: refreshed!, sessionId, session };
    };
    /** What source_control_push_branch records after a push from the run's session. */
    const pushFrom = async (sessionId: string, slug: string, ownRepository: boolean) => {
      const session = (await controller.getSession(sessionId))!;
      const requestContext = new RequestContext();
      requestContext.set('user', { workosId: 'user-1', organizationId: 'org-1' });
      requestContext.set('controller', {
        sessionId,
        threadId: session.thread.requireId(),
        resourceId: session.identity.getResourceId(),
        getState: () => session.state.get(),
      });
      await recordRunRepositoryChoice({
        requestContext,
        workItems: seeded.workItems,
        sourceControl,
        target: { slug, ownRepository },
      });
    };
    return { seeded, sourceControl, project, item, mastra, hydra, dispatch, pushFrom };
  }

  const boards = createTriageWorkRegistry();

  it('starts the run in the first environment repository and tells the agent to choose among them', async () => {
    const { sourceControl, mastra, dispatch } = await seedMultiRepositoryFactory();

    const { sessionId, session } = await dispatch('decision-1');

    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      projectRepositoryId: mastra.id,
    });
    expect(session.state.get()).toMatchObject({ projectRepositoryId: mastra.id });
    const instructions = session.state.get()?.pluginInstructions ?? [];
    expect(instructions.filter(instruction => instruction.includes('repository'))).toEqual([
      expect.stringContaining(
        "This card names no repository. This session's sandbox holds mastra-ai/mastra, internetburrito/hydra.",
      ),
    ]);
    expect(instructions.some(instruction => instruction.startsWith('Target repository:'))).toBe(false);
  });

  it('records the repository the run pushes to, and keeps the run in it on retry', async () => {
    const { seeded, item, mastra, hydra, dispatch, pushFrom } = await seedMultiRepositoryFactory();
    const first = await dispatch('decision-1');

    await pushFrom(first.sessionId, 'internetburrito/hydra', false);

    const recorded = await seeded.workItems.get({ orgId: 'org-1', id: item.id });
    expect(recorded!.metadata).toMatchObject({
      repository: 'internetburrito/hydra',
      repositoryChoice: { slug: 'internetburrito/hydra' },
    });
    // A later push elsewhere does not change the card's repository.
    await pushFrom(first.sessionId, 'mastra-ai/mastra', true);
    expect((await seeded.workItems.get({ orgId: 'org-1', id: item.id }))!.metadata).toMatchObject({
      repository: 'internetburrito/hydra',
    });

    const retry = await dispatch('decision-2');

    expect(retry.sessionId).toBe(first.sessionId);
    expect(retry.session.state.get()).toMatchObject({ projectRepositoryId: mastra.id });
    expect(retry.session.state.get()?.pluginInstructions?.filter(text => text.includes('repository'))).toEqual([
      "Target repository: internetburrito/hydra. Before editing files or creating a pull request, verify this session's checkout matches the target repository. This session is filed under mastra-ai/mastra, so pass `repository: internetburrito/hydra` to the source_control_* tools.",
    ]);
    expect(hydra.id).not.toBe(mastra.id);
  });

  it('keeps a role session working once another session records the repository', async () => {
    const { seeded, item, mastra, dispatch } = await seedMultiRepositoryFactory();
    const triage = await dispatch('decision-1');
    // Another session on the card (its chat, a review on another branch) pushed to hydra, so
    // recordRunRepositoryChoice wrote the card's repository under that session's binding.
    const card = await seeded.workItems.get({ orgId: 'org-1', id: item.id });
    await seeded.workItems.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'agent:other-binding',
      expectedRevision: card!.revision,
      patch: {
        metadata: { repository: 'internetburrito/hydra', repositoryChoice: { slug: 'internetburrito/hydra' } },
      },
    });

    const retriage = await dispatch('decision-2');

    expect(retriage.sessionId).toBe(triage.sessionId);
    expect(retriage.session.state.get()).toMatchObject({ projectRepositoryId: mastra.id });
    expect(retriage.session.state.get()?.pluginInstructions?.filter(text => text.includes('repository'))).toEqual([
      "Target repository: internetburrito/hydra. Before editing files or creating a pull request, verify this session's checkout matches the target repository. This session is filed under mastra-ai/mastra, so pass `repository: internetburrito/hydra` to the source_control_* tools.",
    ]);
  });

  it('still refuses a session filed elsewhere when a person sets the repository', async () => {
    const { seeded, item, dispatch } = await seedMultiRepositoryFactory();
    await dispatch('decision-1');
    const card = await seeded.workItems.get({ orgId: 'org-1', id: item.id });
    await seeded.workItems.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'user-1',
      patch: { metadata: { ...card!.metadata, repository: 'internetburrito/hydra' } },
    });

    const error = await dispatch('decision-2').catch(failure => failure);

    expect(error).toBeInstanceOf(FactoryDispatchError);
    expect(error).toMatchObject({ code: 'source_repository_ambiguous' });
    expect(error.message).toContain('bound to a different repository than internetburrito/hydra');
  });

  it('files a card that names its repository there, as before', async () => {
    const { seeded, sourceControl, item, hydra, dispatch } = await seedMultiRepositoryFactory();
    await seeded.workItems.update({
      orgId: 'org-1',
      id: item.id,
      userId: 'user-1',
      patch: { metadata: { repository: 'internetburrito/hydra' } },
    });

    const { sessionId, session } = await dispatch('decision-1');

    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      projectRepositoryId: hydra.id,
    });
    expect(session.state.get()?.pluginInstructions?.filter(text => text.includes('repository'))).toEqual([
      "Target repository: internetburrito/hydra. Before editing files or creating a pull request, verify this session's checkout matches the target repository.",
    ]);
  });
});
