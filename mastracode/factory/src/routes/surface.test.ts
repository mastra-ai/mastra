import { describe, expect, it, vi } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
import { createTestBoard } from '../boards/test-utils.js';
import type { GithubIntegration } from '../integrations/github/integration.js';
import { FactoryDispatchError } from '../rules/dispatch-errors.js';
import type { FactoryBindingPreparationInput } from '../rules/dispatcher.js';
import type { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { prepareFactoryRuleBinding } from './surface.js';

async function seedFactoryWithRepository(options?: { defaultModelId?: string }) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
  if (options?.defaultModelId) {
    await seeded.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { defaultModelId: options.defaultModelId },
    });
  }
  const installation = await sourceControl.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '123',
  });
  const repository = await sourceControl.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '456', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
  });
  const connection = await sourceControl.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const projectRepository = await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  const github = { id: 'github', sourceControlStorage: sourceControl } as unknown as GithubIntegration;
  return { seeded, sourceControl, project, projectRepository, installation, github };
}

function bindingInput(
  factoryProjectId: string,
  stages = ['triage'],
  { role = 'triage', board }: { role?: string; board?: string } = {},
): FactoryBindingPreparationInput {
  return {
    record: { id: 'decision-1', orgId: 'org-1', factoryProjectId },
    item: {
      id: 'item-1',
      title: 'Broken login',
      board: board ?? null,
      stages,
      sessions: [],
      externalSource: { integrationId: 'github', type: board === 'review' ? 'pull-request' : 'issue' },
      metadata: { githubIssueNumber: 49, repository: 'mastra-ai/mastra' },
    },
    role,
  } as unknown as FactoryBindingPreparationInput;
}

const boards = createBoardRegistry();

describe('prepareFactoryRuleBinding', () => {
  it("starts the run on the factory's default model", async () => {
    const { seeded, project, github } = await seedFactoryWithRepository({
      defaultModelId: 'anthropic/claude-opus-5',
    });
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      bindingInput(project.id),
    );

    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({ defaultModelId: 'anthropic/claude-opus-5', destinationStage: 'triage' }),
    );
  });

  it('leaves the model unset when the factory has no default', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      bindingInput(project.id),
    );

    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ defaultModelId: undefined }));
  });

  it('creates the source-control session the coordinator requires', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      bindingInput(project.id),
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('user-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ branch: 'factory/issue-49', baseBranch: 'main', userId: 'user-1' }),
    );
  });

  it('keeps automation as the run starter while using the source-control owner for credentials', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    input.record.actor = { type: 'system', id: 'factory-external-orchestrator' };

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const request = prepare.mock.calls[0]![0] as unknown as {
      userId: string;
      starter: { type: string; id: string };
      sessionId: string;
    };
    expect(request).toMatchObject({
      userId: 'user-1',
      starter: { type: 'system', id: 'factory-rule-dispatcher' },
    });
    await expect(sourceControl.sessions.getBySessionId(request.sessionId)).resolves.toMatchObject({ userId: 'user-1' });
  });

  it('preserves a human actor as the run starter without making the repository connector the actor', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    input.record.actor = {
      type: 'human',
      id: 'user-1',
      initiator: { userId: 'user-1', displayName: 'Ada Lovelace' },
    };

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    expect(prepare.mock.calls[0]![0]).toMatchObject({
      userId: 'user-1',
      starter: { type: 'human', id: 'user-1' },
      requestContext: expect.objectContaining({ get: expect.any(Function) }),
    });
    expect(
      (prepare.mock.calls[0]![0] as unknown as { requestContext: { get(key: string): unknown } }).requestContext.get(
        'user',
      ),
    ).toMatchObject({ workosId: 'user-1', name: 'Ada Lovelace' });
  });

  it('preserves a human initiator on a system deferred decision when they own the credentials', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    input.record.actor = {
      type: 'system',
      id: 'factory-rule-dispatcher',
      initiator: { userId: 'user-1', displayName: 'Ada Lovelace' },
    };

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    expect(prepare.mock.calls[0]![0]).toMatchObject({
      userId: 'user-1',
      starter: { type: 'human', id: 'user-1' },
    });
  });

  it('rehydrates the matching persisted human profile for autonomous binding preparation', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = 'user-1';
    input.record.actor = {
      type: 'system',
      id: 'factory-rule-dispatcher',
      initiator: { userId: 'original-user', displayName: 'Original Initiator' },
      approvedByProfile: { userId: 'user-1', displayName: 'Ada Lovelace' },
    };

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const request = prepare.mock.calls[0]![0] as unknown as {
      starter: { type: string; id: string };
      requestContext: { get(key: string): unknown };
    };
    expect(request.starter).toEqual({ type: 'human', id: 'user-1' });
    expect(request.requestContext.get('user')).toEqual({
      workosId: 'user-1',
      organizationId: 'org-1',
      name: 'Ada Lovelace',
    });
  });

  it('does not trust an approver profile that disagrees with the approval record', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = 'user-1';
    input.record.actor = {
      type: 'system',
      id: 'factory-rule-dispatcher',
      approvedByProfile: { userId: 'different-user', displayName: 'Wrong Person' },
    };

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const request = prepare.mock.calls[0]![0] as unknown as { requestContext?: unknown };
    expect(request.requestContext).toBeUndefined();
  });

  it("keeps a run an agent pre-approved on the repo connector, never on the agent's id", async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = 'agent:binding-1';

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('user-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ userId: 'user-1' }),
    );
  });

  it('reuses the role session the work item already holds instead of minting a replacement', async () => {
    const { seeded, sourceControl, project, projectRepository, github } = await seedFactoryWithRepository();
    const existing = await sourceControl.sessions.create({
      sessionId: 'sess-existing',
      projectRepositoryId: projectRepository.id,
      orgId: 'org-1',
      userId: 'original-owner',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      visibility: 'org',
    });
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.item as { sessions: unknown }).sessions = {
      triage: {
        sessionId: existing.sessionId,
        branch: existing.branch,
        threadId: 'thread-existing',
        startedBy: 'original-owner',
        startedByDisplayName: 'Original Owner',
      },
    };
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId, requestContext } = prepare.mock.calls[0]![0] as unknown as {
      sessionId: string;
      userId: string;
      requestContext: { get(key: string): unknown };
    };
    expect(sessionId).toBe(existing.sessionId);
    expect(userId).toBe('original-owner');
    expect(requestContext.get('user')).toEqual({
      workosId: 'original-owner',
      organizationId: 'org-1',
      name: 'Original Owner',
    });
    await expect(
      sourceControl.sessions.listByProjectRepository({ projectRepositoryId: projectRepository.id }),
    ).resolves.toHaveLength(1);
  });

  async function planOwnedSession(branch = 'factory/issue-49') {
    const setup = await seedFactoryWithRepository();
    const planSession = await setup.sourceControl.sessions.create({
      sessionId: 'sess-plan',
      projectRepositoryId: setup.projectRepository.id,
      orgId: 'org-1',
      userId: 'plan-owner',
      branch,
      baseBranch: 'main',
      visibility: 'org',
    });
    return { ...setup, planSession };
  }

  function withPlanSession(input: FactoryBindingPreparationInput, branch = 'factory/issue-49') {
    (input.item as { sessions: unknown }).sessions = {
      plan: { sessionId: 'sess-plan', branch, threadId: 'thread-plan', startedBy: 'plan-owner' },
    };
    (input.item as { stageHistory: unknown }).stageHistory = [
      { stage: 'intake', enteredAt: 't0', exitedAt: 't1', by: 'plan-owner' },
      { stage: 'planning', enteredAt: 't1', exitedAt: 't2', by: 'plan-owner' },
      { stage: 'execute', enteredAt: 't2', exitedAt: null, by: 'approver-1' },
    ];
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';
    return input;
  }

  it("continues a build approved by someone else in the plan owner's session", async () => {
    const { seeded, sourceControl, project, projectRepository, github, planSession } = await planOwnedSession();
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      withPlanSession(bindingInput(project.id, ['execute'], { role: 'work' })),
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).toBe(planSession.sessionId);
    expect(userId).toBe('plan-owner');
    await expect(
      sourceControl.sessions.listByProjectRepository({ projectRepositoryId: projectRepository.id }),
    ).resolves.toHaveLength(1);
  });

  it("never runs review in an earlier role's session", async () => {
    const { seeded, project, github, planSession } = await planOwnedSession();
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      withPlanSession(bindingInput(project.id, ['review'], { role: 'review' })),
    );

    const { sessionId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string };
    expect(sessionId).not.toBe(planSession.sessionId);
  });

  it('does not inherit an earlier session on a different branch', async () => {
    const { seeded, project, github, planSession } = await planOwnedSession('factory/other');
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      withPlanSession(bindingInput(project.id, ['execute'], { role: 'work' }), 'factory/other'),
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).not.toBe(planSession.sessionId);
    expect(userId).toBe('approver-1');
  });

  it("does not inherit an earlier session on another of the card's repositories", async () => {
    const { seeded, sourceControl, project, projectRepository, github } = await seedFactoryWithRepository();
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const otherRepository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '789', slug: 'mastra-ai/other', defaultBranch: 'main' },
    });
    const otherLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: otherRepository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/other',
    });
    const planSession = await sourceControl.sessions.create({
      sessionId: 'sess-plan',
      projectRepositoryId: otherLink.id,
      orgId: 'org-1',
      userId: 'plan-owner',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      visibility: 'org',
    });
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      withPlanSession(bindingInput(project.id, ['execute'], { role: 'work' })),
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).not.toBe(planSession.sessionId);
    expect(userId).toBe('approver-1');
  });

  it('mints a fresh session when the held ref no longer resolves to the project', async () => {
    const { seeded, sourceControl, project, projectRepository, github } = await seedFactoryWithRepository();
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const doomedRepository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '789', slug: 'mastra-ai/old', defaultBranch: 'main' },
    });
    const doomedLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: doomedRepository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/old',
    });
    const orphaned = await sourceControl.sessions.create({
      sessionId: 'sess-orphaned',
      projectRepositoryId: doomedLink.id,
      orgId: 'org-1',
      userId: 'original-owner',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      visibility: 'org',
    });
    await sourceControl.projectRepositories.unlink({ orgId: 'org-1', id: doomedLink.id });
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.item as { sessions: unknown }).sessions = {
      triage: {
        sessionId: orphaned.sessionId,
        branch: orphaned.branch,
        threadId: 'thread-orphaned',
        startedBy: 'original-owner',
      },
    };
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).not.toBe(orphaned.sessionId);
    expect(userId).toBe('approver-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ projectRepositoryId: projectRepository.id }),
    );
  });

  it('mints a fresh session when the held ref lives in another factory project', async () => {
    const { seeded, sourceControl, project, projectRepository, github } = await seedFactoryWithRepository();
    const otherProject = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Other' } });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    const otherRepository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: '999', slug: 'mastra-ai/other', defaultBranch: 'main' },
    });
    const otherConnection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: otherProject.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    const otherLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: otherConnection.id,
      repositoryId: otherRepository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/other',
    });
    const foreign = await sourceControl.sessions.create({
      sessionId: 'sess-foreign',
      projectRepositoryId: otherLink.id,
      orgId: 'org-1',
      userId: 'original-owner',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      visibility: 'org',
    });
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.item as { sessions: unknown }).sessions = {
      triage: {
        sessionId: foreign.sessionId,
        branch: foreign.branch,
        threadId: 'thread-foreign',
        startedBy: 'original-owner',
      },
    };
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).not.toBe(foreign.sessionId);
    expect(userId).toBe('approver-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ projectRepositoryId: projectRepository.id }),
    );
  });

  it("attributes an approved decision's run to the approver, not the repo connector", async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);

    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('approver-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ userId: 'approver-1' }),
    );
  });

  it("opens a card_action run under the clicker's id", async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const { item } = await seeded.workItems.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId: project.id,
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: '49', url: 'https://github.test/i/49' },
        title: 'Broken login',
        stages: ['intake'],
        sessions: {},
        metadata: { githubIssueNumber: 49, repository: 'mastra-ai/mastra', authorTrusted: true },
      },
    });
    const transitions = new FactoryTransitionService({
      storage: seeded.workItems,
      configVersion: 'factory-config-v1',
    });
    await transitions.transition({
      orgId: 'org-1',
      factoryProjectId: project.id,
      workItemId: item.id,
      actor: { type: 'human', id: 'clicker-1' },
      board: 'work',
      stage: 'triage',
      expectedRevision: item.revision,
      ingress: { type: 'human', identity: 'click-1' },
      cause: 'card_action',
    });
    const [decision] = await seeded.workItems.listDeferredDecisions('org-1', project.id);
    expect(decision).toMatchObject({ decision: { type: 'invokeSkill' }, approvedBy: 'clicker-1' });

    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = decision!.approvedBy;
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      input,
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('clicker-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ userId: 'clicker-1' }),
    );
  });

  it('blocks autonomous dispatch on an unattributed multi-repository item before creating a session', async () => {
    const { seeded, sourceControl, project, projectRepository, installation, github } =
      await seedFactoryWithRepository();
    const second = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: '789',
        slug: 'internetburrito/hydra',
        defaultBranch: 'main',
      },
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: second.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/hydra',
    });
    const createSession = vi.spyOn(sourceControl.sessions, 'create');
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();
    const input = bindingInput(project.id);
    (input.item as { metadata: Record<string, unknown> | null }).metadata = null;

    const error = await prepareFactoryRuleBinding(github, { prepare }, seeded.projects, boards, input).catch(
      failure => failure,
    );

    expect(error).toBeInstanceOf(FactoryDispatchError);
    expect(error).toMatchObject({ code: 'source_repository_ambiguous' });
    expect(error.message).toContain('internetburrito/hydra');
    expect(createSession).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('retries an unattributed role in its existing linked repository without choosing the first', async () => {
    const { seeded, sourceControl, project, projectRepository, installation, github } =
      await seedFactoryWithRepository();
    const second = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: installation.id,
        externalId: '789',
        slug: 'internetburrito/hydra',
        defaultBranch: 'main',
      },
    });
    const link = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: second.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/hydra',
    });
    const existing = await sourceControl.sessions.create({
      sessionId: 'sess-hydra',
      projectRepositoryId: link.id,
      orgId: 'org-1',
      userId: 'original-owner',
      branch: 'factory/issue-49',
      baseBranch: 'main',
      visibility: 'org',
    });
    const input = bindingInput(project.id);
    (input.item as { metadata: Record<string, unknown> | null }).metadata = null;
    (input.item as { sessions: unknown }).sessions = {
      triage: { sessionId: existing.sessionId, branch: existing.branch, threadId: 'thread-existing' },
    };
    const prepare = vi.fn(async () => ({}) as never);

    await prepareFactoryRuleBinding(github, { prepare }, seeded.projects, boards, input);

    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ sessionId: existing.sessionId }));
    await expect(
      sourceControl.sessions.listByProjectRepository({ projectRepositoryId: projectRepository.id }),
    ).resolves.toHaveLength(0);
  });

  it('classifies a missing source-control connection', async () => {
    const { seeded, github } = await seedFactoryWithRepository();
    const disconnected = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Disconnected' },
    });
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();

    const error = await prepareFactoryRuleBinding(
      github,
      { prepare },
      seeded.projects,
      boards,
      bindingInput(disconnected.id),
    ).catch(failure => failure);

    expect(error).toBeInstanceOf(FactoryDispatchError);
    expect(error).toMatchObject({ code: 'source_control_missing' });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('moves a card out of Intake into its role lane, and nowhere else', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);

    // A rule-started review on a Review-board card still sitting in Intake enters
    // Reviewing, exactly like a manual click on the same action would.
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      bindingInput(project.id, ['intake'], { role: 'review', board: 'review' }),
    );
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ destinationStage: 'review' }));

    // Each Work seat leaves Intake for the lane the board assigns it.
    for (const [role, lane] of [
      ['triage', 'triage'],
      ['plan', 'planning'],
      ['work', 'execute'],
    ] as const) {
      await prepareFactoryRuleBinding(
        github,
        { prepare } as unknown as FactoryStartCoordinator,
        seeded.projects,
        boards,
        bindingInput(project.id, ['intake'], { role }),
      );
      expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStage: lane }));
    }

    // Roles don't own lanes: the Done close-out runs in the triage seat, and
    // starting it must not drag the finished card back to Triage.
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      boards,
      bindingInput(project.id, ['done'], { role: 'triage' }),
    );
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStage: 'done' }));
  });

  it('leaves a custom resting phase for the lane its board assigns the role', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const custom = createBoardRegistry({ boards: [createTestBoard()] });

    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      custom,
      bindingInput(project.id, ['queued'], { role: 'release', board: 'release' }),
    );
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStage: 'shipping' }));

    // Work's roles mean nothing on this board: from rest they have no lane.
    const error = await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      custom,
      bindingInput(project.id, ['queued'], { role: 'work', board: 'release' }),
    ).catch(failure => failure);
    expect(error).toMatchObject({ code: 'unsupported_provider_item' });

    // Already working: the run stays where the card is.
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      custom,
      bindingInput(project.id, ['shipping'], { role: 'release', board: 'release' }),
    );
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStage: 'shipping' }));
  });

  it('rejects runs with no lane before creating a source-control session', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const createSession = vi.spyOn(sourceControl.sessions, 'create');
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();

    const error = await prepareFactoryRuleBinding(
      github,
      { prepare },
      seeded.projects,
      boards,
      // From Intake the lane comes from the role; an unmapped role fails loud.
      bindingInput(project.id, ['intake'], { role: 'spectator' }),
    ).catch(failure => failure);

    expect(error).toBeInstanceOf(FactoryDispatchError);
    expect(error).toMatchObject({ code: 'unsupported_provider_item' });
    expect(createSession).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('starts a manual card run on its id-derived branch', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();
    const input = bindingInput(project.id);
    input.item.externalSource = null;

    await prepareFactoryRuleBinding(github, { prepare }, seeded.projects, boards, input);

    const { sessionId } = prepare.mock.calls[0]![0];
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ branch: 'factory/item-item-1', baseBranch: 'main' }),
    );
  });
});
