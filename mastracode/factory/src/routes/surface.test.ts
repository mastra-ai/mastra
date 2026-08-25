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
  await sourceControl.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'local',
    sandboxWorkdir: '/sandbox/mastra',
  });
  const github = { id: 'github', sourceControlStorage: sourceControl } as unknown as GithubIntegration;
  return { seeded, sourceControl, project, github };
}

function bindingInput(factoryProjectId: string, stages = ['triage']): FactoryBindingPreparationInput {
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
    role: 'triage',
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

  it('rejects invalid stages before creating a source-control session', async () => {
    const { seeded, sourceControl, project, github } = await seedFactoryWithRepository();
    const createSession = vi.spyOn(sourceControl.sessions, 'create');
    const prepare = vi.fn<FactoryStartCoordinator['prepare']>();

    const error = await prepareFactoryRuleBinding(
      github,
      { prepare },
      seeded.projects,
      bindingInput(project.id, ['review', 'done']),
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
