import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactoryDefaultModelId,
  resolveFactoryProjectForSession,
  resolveFactorySourceRepository,
} from './factory-session.js';
import { DEFAULT_OBSERVATION_THRESHOLD, DEFAULT_REFLECTION_THRESHOLD } from './memory-settings-hydration.js';

type FactorySessionHandle = Parameters<typeof hydrateFactorySession>[0];

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
      observer: { modelId: () => undefined, switchModel: vi.fn(async () => void calls.push('observer')) },
      reflector: { modelId: () => undefined, switchModel: vi.fn(async () => void calls.push('reflector')) },
    },
    state: { get: () => ({}), set: vi.fn(async () => void calls.push('state')) },
    model: { switch: vi.fn(async () => void calls.push('model')) },
  };
  return { session: session as unknown as FactorySessionHandle, double: session, calls };
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
        // Autonomous runs are org-visible by default.
        visibility: 'org',
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

  it('attributes the session to attributeToUserId over the repo connector', async () => {
    const { sourceControl, project } = await seedLinkedRepository();

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-22254',
      attributeToUserId: 'approver-1',
    });

    expect(result.userId).toBe('approver-1');
    await expect(sourceControl.sessions.getBySessionId(result.sessionId)).resolves.toEqual(
      expect.objectContaining({ userId: 'approver-1' }),
    );
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
  it("applies the factory project's stored memory settings and the factory default model", async () => {
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
      factoryProjectId: 'proj-1',
      defaultModelId: 'anthropic/claude-opus-5',
      memorySettings: memorySettings as never,
    });

    expect(memorySettings.get).toHaveBeenCalledWith({ orgId: 'org-1', userId: 'factory-project:proj-1' });
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

    await hydrateFactorySession(session, { orgId: 'org-1', factoryProjectId: 'proj-1' });

    expect(double.model.switch).not.toHaveBeenCalled();
    // The org seed is the one state write that always happens: knowledge
    // capture scopes on it, and it must land even when nothing else does.
    expect(double.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('resets to the built-in memory defaults when memory settings are omitted', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, { orgId: 'org-1', factoryProjectId: 'proj-1' });

    expect(double.om.observer.switchModel).toHaveBeenCalledWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(double.om.reflector.switchModel).toHaveBeenCalledWith({ modelId: DEFAULT_OM_MODEL_ID });
    expect(double.state.set).toHaveBeenCalledWith({
      observationThreshold: DEFAULT_OBSERVATION_THRESHOLD,
      reflectionThreshold: DEFAULT_REFLECTION_THRESHOLD,
    });
  });

  it('marks the session unresolved when the caller has no organization', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, { orgId: '  ', factoryProjectId: 'proj-1' });

    expect(double.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
    expect(double.state.set).not.toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: expect.anything() }));
  });

  it('keeps going when the default model is unknown', async () => {
    const { session, double } = createSessionDouble();
    double.model.switch.mockRejectedValueOnce(new Error('unknown model'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      hydrateFactorySession(session, { orgId: 'org-1', factoryProjectId: 'proj-1', defaultModelId: 'openai/retired' }),
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
      factoryProjectId: 'proj-1',
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

/**
 * Repo resolution encodes real policy — which connection counts, which
 * repository, and what the base branch is. It backs both the autonomous
 * entry points and the Slack wiring, so it is tested directly against seeded
 * storage rather than through either caller.
 */
describe('resolveFactorySourceRepository', () => {
  it('resolves the repository linked to the owner-owned connection, defaulting the base branch to the repo default', async () => {
    const { sourceControl, project, projectRepository } = await seedLinkedRepository();

    const result = await resolveFactorySourceRepository({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(result).toEqual({
      found: true,
      projectRepositoryId: projectRepository.id,
      baseBranch: 'main',
      connectedByUserId: 'user-1',
    });
  });

  it('prefers the branch pinned on the project repository over the repository default', async () => {
    const { sourceControl, project } = await seedLinkedRepository({ pinnedBranch: 'develop' });

    const result = await resolveFactorySourceRepository({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(result).toMatchObject({ found: true, baseBranch: 'develop' });
  });

  // A project can carry connections for several integrations; only the one
  // belonging to this owner can back a session.
  it('ignores connections belonging to other integrations', async () => {
    const { seeded, project } = await seedLinkedRepository();

    const result = await resolveFactorySourceRepository({
      sourceControl: seeded.sourceControl.forIntegration('linear'),
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(result).toEqual({ found: false, reason: 'connection' });
  });

  it('reports a missing repository apart from a missing connection', async () => {
    const { seeded, sourceControl, project } = await seedLinkedRepository();
    const bareProject = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'No repos' },
    });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: '123',
    });
    await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: bareProject.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });

    await expect(
      resolveFactorySourceRepository({ sourceControl, orgId: 'org-1', factoryProjectId: bareProject.id }),
    ).resolves.toEqual({ found: false, reason: 'repository' });
    // The seeded project still resolves, so the miss is about this project.
    await expect(
      resolveFactorySourceRepository({ sourceControl, orgId: 'org-1', factoryProjectId: project.id }),
    ).resolves.toMatchObject({ found: true });
  });

  // A provider-app reinstall deletes the installation but leaves the old
  // connection row behind. That stale connection must not shadow the healthy
  // one created for the new installation.
  it('skips a stale connection whose installation was deleted and resolves through the healthy one', async () => {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('github');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });

    const staleInstallation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'old-install',
    });
    const staleRepository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: staleInstallation.id,
        externalId: '456',
        slug: 'mastra-ai/mastra',
        defaultBranch: 'main',
      },
    });
    const staleConnection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: staleInstallation.id,
      createdByUserId: 'user-1',
    });
    await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: staleConnection.id,
      repositoryId: staleRepository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra',
    });
    // The reinstall: the installation row goes away, the connection stays.
    await sourceControl.installations.delete({ orgId: 'org-1', id: staleInstallation.id });

    const freshInstallation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-2',
      externalId: 'new-install',
    });
    const freshRepository = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: freshInstallation.id,
        externalId: '456',
        slug: 'mastra-ai/mastra',
        defaultBranch: 'main',
      },
    });
    const freshConnection = await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: freshInstallation.id,
      createdByUserId: 'user-2',
    });
    const freshProjectRepository = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: freshConnection.id,
      repositoryId: freshRepository.id,
      createdByUserId: 'user-2',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra',
    });

    await expect(
      resolveFactorySourceRepository({ sourceControl, orgId: 'org-1', factoryProjectId: project.id }),
    ).resolves.toEqual({
      found: true,
      projectRepositoryId: freshProjectRepository.id,
      baseBranch: 'main',
      connectedByUserId: 'user-2',
    });
  });

  it('reports a repository miss instead of throwing when every connection is stale', async () => {
    const seeded = await createFactoryStorageForTests();
    const sourceControl = seeded.sourceControl.forIntegration('github');
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    const installation = await sourceControl.installations.upsert({
      orgId: 'org-1',
      connectedByUserId: 'user-1',
      externalId: 'old-install',
    });
    await sourceControl.connections.create({
      orgId: 'org-1',
      factoryProjectId: project.id,
      installationId: installation.id,
      createdByUserId: 'user-1',
    });
    await sourceControl.installations.delete({ orgId: 'org-1', id: installation.id });

    await expect(
      resolveFactorySourceRepository({ sourceControl, orgId: 'org-1', factoryProjectId: project.id }),
    ).resolves.toEqual({ found: false, reason: 'repository' });
  });
});

/**
 * A repo-backed channel thread is keyed by its Factory session id, and that id
 * is the only handle a session-start hook receives. This is the walk back to
 * the project whose configuration the session should adopt.
 */
describe('resolveFactoryProjectForSession', () => {
  it('walks a session id back to its project, org, and owner', async () => {
    const { sourceControl, project, repository } = await seedLinkedRepository();
    const created = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      repositorySlug: repository.slug,
      branch: 'slack/1700-42',
    });

    await expect(resolveFactoryProjectForSession({ sourceControl, sessionId: created.sessionId })).resolves.toEqual({
      factoryProjectId: project.id,
      orgId: 'org-1',
      userId: 'user-1',
    });
  });

  it('resolves nothing for a session id that does not exist', async () => {
    const { sourceControl } = await seedLinkedRepository();

    await expect(resolveFactoryProjectForSession({ sourceControl, sessionId: 'not-a-session' })).resolves.toBeNull();
  });
});
