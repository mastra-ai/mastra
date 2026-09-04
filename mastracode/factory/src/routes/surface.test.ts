import { describe, expect, it, vi } from 'vitest';

import type { GithubIntegration } from '../integrations/github/integration.js';
import { FactoryDispatchError } from '../rules/dispatch-errors.js';
import type { FactoryBindingPreparationInput } from '../rules/dispatcher.js';
import type { FactoryStartCoordinator } from '../rules/start-coordinator.js';
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
  return { seeded, sourceControl, project, projectRepository, github };
}

function bindingInput(
  factoryProjectId: string,
  stages = ['triage'],
  { role = 'triage' }: { role?: string } = {},
): FactoryBindingPreparationInput {
  return {
    record: { id: 'decision-1', orgId: 'org-1', factoryProjectId },
    item: {
      id: 'item-1',
      title: 'Broken login',
      stages,
      sessions: [],
      externalSource: { integrationId: 'github', type: 'issue' },
      metadata: { githubIssueNumber: 49, repository: 'mastra-ai/mastra' },
    },
    role,
  } as unknown as FactoryBindingPreparationInput;
}

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
      bindingInput(project.id),
    );

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('user-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ branch: 'factory/issue-49', baseBranch: 'main', userId: 'user-1' }),
    );
  });

  it("keeps a run an agent pre-approved on the repo connector, never on the agent's id", async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);
    const input = bindingInput(project.id);
    (input.record as { approvedBy?: string | null }).approvedBy = 'agent:binding-1';

    await prepareFactoryRuleBinding(github, { prepare } as unknown as FactoryStartCoordinator, seeded.projects, input);

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
      },
    };
    (input.record as { approvedBy?: string | null }).approvedBy = 'approver-1';

    await prepareFactoryRuleBinding(github, { prepare } as unknown as FactoryStartCoordinator, seeded.projects, input);

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(sessionId).toBe(existing.sessionId);
    expect(userId).toBe('original-owner');
    await expect(
      sourceControl.sessions.listByProjectRepository({ projectRepositoryId: projectRepository.id }),
    ).resolves.toHaveLength(1);
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

    await prepareFactoryRuleBinding(github, { prepare } as unknown as FactoryStartCoordinator, seeded.projects, input);

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

    await prepareFactoryRuleBinding(github, { prepare } as unknown as FactoryStartCoordinator, seeded.projects, input);

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
    await prepareFactoryRuleBinding(github, { prepare } as unknown as FactoryStartCoordinator, seeded.projects, input);

    const { sessionId, userId } = prepare.mock.calls[0]![0] as unknown as { sessionId: string; userId: string };
    expect(userId).toBe('approver-1');
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ userId: 'approver-1' }),
    );
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
      bindingInput(disconnected.id),
    ).catch(failure => failure);

    expect(error).toBeInstanceOf(FactoryDispatchError);
    expect(error).toMatchObject({ code: 'source_control_missing' });
    expect(prepare).not.toHaveBeenCalled();
  });

  it('moves a card out of Intake into its role lane, and nowhere else', async () => {
    const { seeded, project, github } = await seedFactoryWithRepository();
    const prepare = vi.fn(async () => ({}) as never);

    // A rule-started review on a card still sitting in Intake enters Reviewing,
    // exactly like a manual click on the same action would.
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      bindingInput(project.id, ['intake'], { role: 'review' }),
    );
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ destinationStage: 'review' }));

    // Roles don't own lanes: the Done close-out runs in the triage seat, and
    // starting it must not drag the finished card back to Triage.
    await prepareFactoryRuleBinding(
      github,
      { prepare } as unknown as FactoryStartCoordinator,
      seeded.projects,
      bindingInput(project.id, ['done'], { role: 'triage' }),
    );
    expect(prepare).toHaveBeenLastCalledWith(expect.objectContaining({ destinationStage: 'done' }));
  });

  it('rejects runs with no lane before creating a source-control session', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const createSession = vi.spyOn(sourceControl.sessions, 'create');
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();

    const error = await prepareFactoryRuleBinding(
      github,
      { prepare },
      seeded.projects,
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

    await prepareFactoryRuleBinding(github, { prepare }, seeded.projects, input);

    const { sessionId } = prepare.mock.calls[0]![0];
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toEqual(
      expect.objectContaining({ branch: 'factory/item-item-1', baseBranch: 'main' }),
    );
  });
});
