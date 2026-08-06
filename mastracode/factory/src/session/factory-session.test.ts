import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { ensureFactorySourceSession, hydrateFactorySession, resolveFactoryDefaultModelId } from './factory-session.js';

type StarterSession = Parameters<typeof hydrateFactorySession>[0];

async function seedLinkedRepository(options?: { pinnedBranch?: string }) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration('github');
  const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
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
    ...(options?.pinnedBranch ? { branch: options.pinnedBranch } : {}),
  });
  return { seeded, sourceControl, project, repository, projectRepository };
}

function createSessionDouble() {
  const calls: string[] = [];
  const session = {
    om: {
      observer: { switchModel: vi.fn(async () => void calls.push('observer')) },
      reflector: { switchModel: vi.fn(async () => void calls.push('reflector')) },
    },
    state: { set: vi.fn(async () => void calls.push('state')) },
    model: { switch: vi.fn(async () => void calls.push('model')) },
  };
  return { session: session as unknown as StarterSession, double: session, calls };
}

describe('ensureFactorySourceSession', () => {
  it('creates a source-control session on the requested branch', async () => {
    const { sourceControl, project, repository, projectRepository } = await seedLinkedRepository();

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      repositorySlug: repository.slug,
      branch: 'factory/issue-49',
    });

    expect(result).toMatchObject({
      userId: 'user-1',
      projectRepositoryId: projectRepository.id,
      branch: 'factory/issue-49',
      baseBranch: 'main',
    });
    await expect(sourceControl.sessions.getBySessionId(result.sessionId)).resolves.toEqual(
      expect.objectContaining({
        projectRepositoryId: projectRepository.id,
        userId: 'user-1',
        branch: 'factory/issue-49',
        baseBranch: 'main',
      }),
    );
  });

  it('defaults to the first linked repository when no slug is given', async () => {
    const { sourceControl, project, projectRepository } = await seedLinkedRepository();

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'slack/thread-1',
    });

    expect(result.projectRepositoryId).toBe(projectRepository.id);
  });

  it("prefers the project repository's pinned branch as the base", async () => {
    const { sourceControl, project } = await seedLinkedRepository({ pinnedBranch: 'develop' });

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-7',
    });

    expect(result.baseBranch).toBe('develop');
  });

  it('rejects a factory project with no connection for this integration', async () => {
    const { seeded, project } = await seedLinkedRepository();
    const otherIntegration = seeded.sourceControl.forIntegration('gitlab');

    await expect(
      ensureFactorySourceSession({
        sourceControl: otherIntegration,
        orgId: 'org-1',
        factoryProjectId: project.id,
        branch: 'factory/issue-9',
      }),
    ).rejects.toThrow('Factory source-control connection not found.');
  });

  it('rejects when the requested repository slug is not linked', async () => {
    const { sourceControl, project } = await seedLinkedRepository();

    await expect(
      ensureFactorySourceSession({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
        repositorySlug: 'mastra-ai/not-linked',
        branch: 'factory/issue-9',
      }),
    ).rejects.toThrow('Factory source-control repository not found.');
  });
});

describe('hydrateFactorySession', () => {
  it('applies stored memory settings and the factory default model', async () => {
    const { session, double } = createSessionDouble();
    const memorySettings = {
      get: vi.fn(async () => ({
        observerModelId: 'anthropic/claude-fable-5',
        reflectorModelId: 'anthropic/claude-opus-5',
        observationThreshold: 3,
        reflectionThreshold: 7,
        observeAttachments: true,
      })),
    };

    await hydrateFactorySession(session, {
      orgId: 'org-1',
      userId: 'user-1',
      defaultModelId: 'anthropic/claude-opus-5',
      memorySettings: memorySettings as never,
    });

    expect(memorySettings.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'user-1' });
    expect(double.om.observer.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-fable-5' });
    expect(double.om.reflector.switchModel).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5' });
    expect(double.state.set).toHaveBeenCalledWith({
      observationThreshold: 3,
      reflectionThreshold: 7,
      observeAttachments: true,
    });
    expect(double.model.switch).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5' });
  });

  it('leaves the session on its default model when the project has none', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, { orgId: 'org-1', userId: 'user-1' });

    expect(double.model.switch).not.toHaveBeenCalled();
    expect(double.state.set).not.toHaveBeenCalled();
  });

  it('keeps going when the default model is unknown', async () => {
    const { session, double } = createSessionDouble();
    double.model.switch.mockRejectedValueOnce(new Error('unknown model'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      hydrateFactorySession(session, { orgId: 'org-1', userId: 'user-1', defaultModelId: 'openai/retired' }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply factory default model', {
      modelId: 'openai/retired',
      error: 'unknown model',
    });
    warn.mockRestore();
  });

  it('still applies the default model when memory settings fail to load', async () => {
    const { session, double } = createSessionDouble();
    const memorySettings = { get: vi.fn(async () => Promise.reject(new Error('storage down'))) };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await hydrateFactorySession(session, {
      orgId: 'org-1',
      userId: 'user-1',
      defaultModelId: 'anthropic/claude-opus-5',
      memorySettings: memorySettings as never,
    });

    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply observational-memory settings', {
      error: 'storage down',
    });
    expect(double.model.switch).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5' });
    warn.mockRestore();
  });
});

describe('resolveFactoryDefaultModelId', () => {
  it("reads the project's default model", async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    await seeded.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { defaultModelId: 'anthropic/claude-opus-5' },
    });

    await expect(resolveFactoryDefaultModelId(seeded.projects, project.id)).resolves.toBe('anthropic/claude-opus-5');
  });

  it('returns undefined without a projects domain or a project id', async () => {
    const seeded = await createFactoryStorageForTests();

    await expect(resolveFactoryDefaultModelId(undefined, 'project-1')).resolves.toBeUndefined();
    await expect(resolveFactoryDefaultModelId(seeded.projects, undefined)).resolves.toBeUndefined();
    await expect(resolveFactoryDefaultModelId(seeded.projects, 'missing-project')).resolves.toBeUndefined();
  });
});
