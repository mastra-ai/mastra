import { PROVIDER_DEFAULT_MODELS } from '@mastra/code-sdk/auth/storage';
import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { describe, expect, it, vi } from 'vitest';

import {
  invalidateTenantCredentialSnapshots,
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../routes/tenant-credentials.js';
import { SessionBranchHeldError } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  createSourceControlSessionLookup,
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactorySessionModel,
  resolveFactorySourceControl,
  resolvePrimaryEnvironmentRepository,
} from './factory-session.js';

type FactorySessionHandle = Parameters<typeof hydrateFactorySession>[0];

async function seedLinkedRepository(options?: { pinnedBranch?: string; integrationId?: string }) {
  const seeded = await createFactoryStorageForTests();
  const sourceControl = seeded.sourceControl.forIntegration(options?.integrationId ?? 'github');
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
    state: { get: () => ({}), set: vi.fn(async () => void calls.push('state')) },
    mode: { resolve: () => ({ defaultModelId: 'openai/gpt-5.5' }) },
    model: { switch: vi.fn(async () => void calls.push('model')) },
    subagents: { model: { set: vi.fn(async () => void calls.push('subagent')) } },
  };
  return { session: session as unknown as FactorySessionHandle, double: session, calls };
}

describe('provider-aware source-control resolution', () => {
  it("chooses the Factory's linked GitLab repository even when GitHub is also registered", async () => {
    const { seeded, sourceControl: gitlab, project } = await seedLinkedRepository({ integrationId: 'gitlab' });
    const github = seeded.sourceControl.forIntegration('github');

    await expect(
      resolveFactorySourceControl({
        sourceControls: [github, gitlab],
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
    ).resolves.toBe(gitlab);
  });

  it('finds a GitLab session through the cross-provider lookup', async () => {
    const {
      seeded,
      sourceControl: gitlab,
      project,
      repository,
    } = await seedLinkedRepository({ integrationId: 'gitlab' });
    const github = seeded.sourceControl.forIntegration('github');
    const session = await ensureFactorySourceSession({
      sourceControl: gitlab,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/gitlab-issue',
    });
    const sessions = createSourceControlSessionLookup([github, gitlab]);

    await expect(sessions.getBySessionId(session.sessionId)).resolves.toMatchObject({
      sessionId: session.sessionId,
      orgId: 'org-1',
    });
  });

  it('propagates connection-list storage failures instead of selecting another provider', async () => {
    const { seeded, sourceControl: gitlab, project } = await seedLinkedRepository({ integrationId: 'gitlab' });
    const github = seeded.sourceControl.forIntegration('github');
    vi.spyOn(github.connections, 'list').mockRejectedValueOnce(new Error('connection storage unavailable'));

    await expect(
      resolveFactorySourceControl({
        sourceControls: [github, gitlab],
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
    ).rejects.toThrow('connection storage unavailable');
  });

  it('propagates repository-list storage failures', async () => {
    const { sourceControl, project } = await seedLinkedRepository({ integrationId: 'gitlab' });
    vi.spyOn(sourceControl.projectRepositories, 'list').mockRejectedValueOnce(
      new Error('repository storage unavailable'),
    );

    await expect(
      resolveFactorySourceControl({
        sourceControls: [sourceControl],
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
    ).rejects.toThrow('repository storage unavailable');
  });
});

describe('ensureFactorySourceSession', () => {
  it('creates a source-control session on the requested branch', async () => {
    const { sourceControl, project, repository, projectRepository } = await seedLinkedRepository();

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
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
        // The session row carries its factory directly, so readers no longer walk link -> connection.
        factoryProjectId: project.id,
        userId: 'user-1',
        branch: 'factory/issue-49',
        baseBranch: 'main',
        // Autonomous runs are org-visible by default.
        visibility: 'org',
      }),
    );
  });

  it('passes a chosen session id, visibility and origin through to the row', async () => {
    const { sourceControl, project } = await seedLinkedRepository();
    const sessionId = '00000000-0000-4000-8000-0000000000a1';

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      sessionId,
      branch: `user/session-${sessionId}`,
      attributeToUserId: 'user-2',
      visibility: 'private',
      origin: { sessionId: 'parent-session', threadId: 'parent-thread' },
    });

    expect(result).toMatchObject({ sessionId, userId: 'user-2' });
    await expect(sourceControl.sessions.getBySessionId(sessionId)).resolves.toMatchObject({
      userId: 'user-2',
      visibility: 'private',
      originSessionId: 'parent-session',
      originThreadId: 'parent-thread',
    });
  });

  it('leaves the default visibility and no origin when neither is passed', async () => {
    const { sourceControl, project } = await seedLinkedRepository();
    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-50',
    });
    await expect(sourceControl.sessions.getBySessionId(result.sessionId)).resolves.toMatchObject({
      visibility: 'org',
      originSessionId: null,
      originThreadId: null,
    });
  });

  it('files every session under the position-1 environment link and still rejects a cross-link branch collision', async () => {
    const { sourceControl, project, repository, projectRepository } = await seedLinkedRepository();
    const other = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: repository.installationId,
        externalId: '457',
        slug: 'mastra-ai/mastra-website',
        defaultBranch: 'main',
      },
    });
    const otherLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: other.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/mastra-website',
    });
    const first = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-7',
    });
    expect(first.projectRepositoryId).toBe(projectRepository.id);
    // Session start no longer picks a repository: a second session lands on
    // the same position-1 link (D1), whatever was linked later.
    const second = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-8',
    });
    expect(second.projectRepositoryId).toBe(projectRepository.id);

    // Branches are unique per (factory, user, branch); a session on the second link cannot reuse one.
    await expect(
      sourceControl.sessions.create({
        sessionId: globalThis.crypto.randomUUID(),
        projectRepositoryId: otherLink.id,
        factoryProjectId: project.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'factory/issue-7',
        baseBranch: 'main',
        visibility: 'org',
      }),
    ).rejects.toBeInstanceOf(SessionBranchHeldError);
  });

  it('files the session under the position-1 environment link', async () => {
    const { sourceControl, project, projectRepository } = await seedLinkedRepository();

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-1',
    });

    expect(result.projectRepositoryId).toBe(projectRepository.id);
  });

  it("prefers the project repository's pinned branch as the base", async () => {
    const { sourceControl, project, repository } = await seedLinkedRepository({ pinnedBranch: 'develop' });

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      branch: 'factory/issue-7',
    });

    expect(result.baseBranch).toBe('develop');
  });

  it('attributes the session to attributeToUserId over the repo connector', async () => {
    const { sourceControl, project, repository } = await seedLinkedRepository();

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
    const { seeded, project, repository } = await seedLinkedRepository();
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

  it('rejects when no linked repository is in the environment', async () => {
    const { sourceControl, project, projectRepository } = await seedLinkedRepository();
    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: projectRepository.id,
      input: { inEnvironment: false },
    });

    await expect(
      ensureFactorySourceSession({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
        branch: 'factory/issue-9',
      }),
    ).rejects.toThrow('Factory source-control repository not found.');
  });

  it('files the session under the named environment link, with that repository as the base', async () => {
    const { sourceControl, project, projectRepository, repository } = await seedLinkedRepository();
    const other = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: repository.installationId,
        externalId: '789',
        slug: 'mastra-ai/other',
        defaultBranch: 'dev',
      },
    });
    const otherLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: other.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/other',
    });

    const result = await ensureFactorySourceSession({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
      projectRepositoryId: otherLink.id,
      branch: 'factory/issue-3',
    });

    expect(result).toEqual(expect.objectContaining({ projectRepositoryId: otherLink.id, baseBranch: 'dev' }));
  });

  it('rejects a named link that is not in the environment', async () => {
    const { sourceControl, project, projectRepository, repository } = await seedLinkedRepository();
    const other = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: repository.installationId,
        externalId: '789',
        slug: 'mastra-ai/other',
        defaultBranch: 'dev',
      },
    });
    const otherLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: other.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/other',
    });
    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: otherLink.id,
      input: { inEnvironment: false },
    });

    await expect(
      ensureFactorySourceSession({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
        projectRepositoryId: otherLink.id,
        branch: 'factory/issue-3',
      }),
    ).rejects.toThrow('Factory source-control repository not found.');
  });
});

describe('hydrateFactorySession', () => {
  it('applies only the factory default model and leaves memory settings invocation-scoped', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, {
      orgId: 'org-1',
      modelScope: 'factory',
      ownerUserId: 'user-1',
      defaultModelId: 'anthropic/claude-opus-5',
    });

    expect(double.model.switch).toHaveBeenCalledWith('anthropic/claude-opus-5');
    for (const agentType of ['explore', 'plan', 'execute']) {
      expect(double.subagents.model.set).toHaveBeenCalledWith({ modelId: 'anthropic/claude-opus-5', agentType });
    }
    expect(double.om.observer.switchModel).not.toHaveBeenCalled();
    expect(double.om.reflector.switchModel).not.toHaveBeenCalled();
    expect(double.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
    expect(double.state.set).toHaveBeenCalledWith({
      factoryModelScope: 'factory',
      factoryOwnerUserId: 'user-1',
    });
    expect(double.state.set).not.toHaveBeenCalledWith(
      expect.objectContaining({ observationThreshold: expect.any(Number) }),
    );
  });

  it('applies the SDK mode default when the selected scope has no configured model', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, { orgId: 'org-1', modelScope: 'factory', ownerUserId: 'user-1' });

    expect(double.model.switch).toHaveBeenCalledWith('openai/gpt-5.5');
    for (const agentType of ['explore', 'plan', 'execute']) {
      expect(double.subagents.model.set).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.5', agentType });
    }
    // The org seed is the one state write that always happens: knowledge
    // capture scopes on it, and it must land even when nothing else does.
    expect(double.state.set).toHaveBeenCalledWith({ factoryOrgId: 'org-1' });
  });

  it('marks the session unresolved when the caller has no organization', async () => {
    const { session, double } = createSessionDouble();

    await hydrateFactorySession(session, { orgId: '  ', modelScope: 'user', ownerUserId: 'user-1' });

    expect(double.state.set).toHaveBeenCalledWith({ factoryOrgUnresolved: true });
    expect(double.state.set).not.toHaveBeenCalledWith(expect.objectContaining({ factoryOrgId: expect.anything() }));
  });

  it("runs on a connected provider's default model when no default was chosen and the mode default has no credential", async () => {
    const seeded = await createFactoryStorageForTests();
    registerTenantCredentialResolver(seeded.credentials);
    try {
      await seeded.credentials.setCredential({ orgId: 'org-1' }, 'anthropic', { type: 'api_key', key: 'org-key' });
      const { session, double } = createSessionDouble();
      const args = { orgId: 'org-1', modelScope: 'factory', ownerUserId: 'user-1' } as const;

      await expect(hydrateFactorySession(session, args)).resolves.toBe(PROVIDER_DEFAULT_MODELS.anthropic);
      expect(double.model.switch).toHaveBeenCalledExactlyOnceWith(PROVIDER_DEFAULT_MODELS.anthropic);

      // Once the mode default's provider is connected too, the mode default stays.
      await seeded.credentials.setCredential({ orgId: 'org-1' }, 'openai-codex', {
        type: 'api_key',
        key: 'org-openai',
      });
      invalidateTenantCredentialSnapshots({ orgId: 'org-1' });
      const fresh = createSessionDouble();
      await expect(hydrateFactorySession(fresh.session, args)).resolves.toBe('openai/gpt-5.5');
    } finally {
      resetTenantCredentialResolverForTests();
    }
  });

  it('keeps going but reports no selected model when the default model is unknown', async () => {
    const { session, double } = createSessionDouble();
    double.model.switch.mockRejectedValueOnce(new Error('unknown model'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      hydrateFactorySession(session, {
        orgId: 'org-1',
        modelScope: 'factory',
        ownerUserId: 'user-1',
        defaultModelId: 'openai/retired',
      }),
    ).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply scoped default model', {
      modelId: 'openai/retired',
      error: 'unknown model',
    });
    warn.mockRestore();
  });

  it('applies the remaining subagent models when one fails', async () => {
    const { session, double } = createSessionDouble();
    double.subagents.model.set.mockRejectedValueOnce(new Error('explore unavailable'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await hydrateFactorySession(session, {
      orgId: 'org-1',
      modelScope: 'user',
      ownerUserId: 'user-1',
      defaultModelId: 'openai/gpt-5.6',
    });

    expect(double.subagents.model.set).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.6', agentType: 'plan' });
    expect(double.subagents.model.set).toHaveBeenCalledWith({ modelId: 'openai/gpt-5.6', agentType: 'execute' });
    expect(warn).toHaveBeenCalledWith('[Factory Start] Failed to apply scoped default subagent model', {
      agentType: 'explore',
      modelId: 'openai/gpt-5.6',
      error: 'explore unavailable',
    });
    warn.mockRestore();
  });
});

describe('resolveFactorySessionModel', () => {
  it('resolves the Factory model for a run and the owner default for a session in hybrid scope', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Mastra', modelScope: 'hybrid', defaultModelId: 'anthropic/factory-model' },
    });
    await seeded.modelDefaults.set({ orgId: 'org-1', userId: 'owner-1', modelId: 'openai/owner-model' });
    const resolve = (context: 'run' | 'session') =>
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId: project.id,
        orgId: 'org-1',
        ownerUserId: 'owner-1',
        context,
      });

    await expect(resolve('run')).resolves.toEqual({ modelScope: 'factory', modelId: 'anthropic/factory-model' });
    await expect(resolve('session')).resolves.toEqual({ modelScope: 'user', modelId: 'openai/owner-model' });
  });

  it('ignores the context outside hybrid scope', async () => {
    const seeded = await createFactoryStorageForTests();
    const factory = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Org', modelScope: 'factory', defaultModelId: 'anthropic/factory-model' },
    });
    const user = await seeded.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Mine', modelScope: 'user', defaultModelId: 'anthropic/factory-model' },
    });
    await seeded.modelDefaults.set({ orgId: 'org-1', userId: 'owner-1', modelId: 'openai/owner-model' });
    const resolve = (factoryProjectId: string, context: 'run' | 'session') =>
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId,
        orgId: 'org-1',
        ownerUserId: 'owner-1',
        context,
      });

    await expect(resolve(factory.id, 'session')).resolves.toEqual({
      modelScope: 'factory',
      modelId: 'anthropic/factory-model',
    });
    await expect(resolve(user.id, 'run')).resolves.toEqual({ modelScope: 'user', modelId: 'openai/owner-model' });
  });

  it("uses the project's model under factory scope", async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    await seeded.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { modelScope: 'factory', defaultModelId: 'anthropic/claude-opus-5' },
    });

    await expect(
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId: project.id,
        orgId: 'org-1',
        ownerUserId: 'user-1',
        context: 'session',
      }),
    ).resolves.toEqual({ modelScope: 'factory', modelId: 'anthropic/claude-opus-5' });
  });

  it("uses only the owner's default under user scope", async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    await seeded.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { modelScope: 'user', defaultModelId: 'anthropic/factory-model' },
    });
    await seeded.modelDefaults.set({ orgId: 'org-1', userId: 'owner-1', modelId: 'openai/owner-model' });

    await expect(
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId: project.id,
        orgId: 'org-1',
        ownerUserId: 'owner-1',
        context: 'session',
      }),
    ).resolves.toEqual({ modelScope: 'user', modelId: 'openai/owner-model' });
  });

  it('does not fall back to the factory model when the owner has no default', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    await seeded.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { modelScope: 'user', defaultModelId: 'anthropic/factory-model' },
    });

    await expect(
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId: project.id,
        orgId: 'org-1',
        ownerUserId: 'owner-1',
        context: 'session',
      }),
    ).resolves.toEqual({ modelScope: 'user' });
  });

  it('keeps user scope when the owner default lookup fails', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Mastra' } });
    await seeded.projects.update({ orgId: 'org-1', id: project.id, input: { modelScope: 'user' } });
    vi.spyOn(seeded.modelDefaults, 'get').mockRejectedValueOnce(new Error('storage unavailable'));

    await expect(
      resolveFactorySessionModel({
        projects: seeded.projects,
        modelDefaults: seeded.modelDefaults,
        factoryProjectId: project.id,
        orgId: 'org-1',
        ownerUserId: 'owner-1',
        context: 'session',
      }),
    ).resolves.toEqual({ modelScope: 'user' });
  });

  it('refuses missing, unavailable, and cross-org project policy', async () => {
    const seeded = await createFactoryStorageForTests();
    const project = await seeded.projects.create({ orgId: 'org-1', userId: 'owner-1', input: { name: 'Mastra' } });
    await seeded.projects.update({ orgId: 'org-1', id: project.id, input: { modelScope: 'user' } });
    const args = {
      projects: seeded.projects,
      modelDefaults: seeded.modelDefaults,
      factoryProjectId: project.id,
      orgId: 'org-1',
      ownerUserId: 'owner-1',
      context: 'session' as const,
    };
    await expect(resolveFactorySessionModel({ ...args, projects: undefined })).rejects.toThrow('policy is unavailable');
    await expect(resolveFactorySessionModel({ ...args, factoryProjectId: undefined })).rejects.toThrow(
      'policy is unavailable',
    );
    await expect(resolveFactorySessionModel({ ...args, factoryProjectId: 'missing' })).rejects.toThrow(
      'policy is unavailable',
    );
    await expect(resolveFactorySessionModel({ ...args, orgId: 'other-org' })).rejects.toThrow('policy is unavailable');
    vi.spyOn(seeded.projects, 'getById').mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(resolveFactorySessionModel(args)).rejects.toThrow('storage unavailable');
  });
});

/**
 * Repo resolution encodes real policy — which connection counts, which
 * repository, and what the base branch is. It backs both the autonomous
 * entry points and the Slack wiring, so it is tested directly against seeded
 * storage rather than through either caller.
 */
describe('resolvePrimaryEnvironmentRepository', () => {
  it('resolves the position-1 environment link of the owner-owned connection, defaulting the base branch to the repo default', async () => {
    const { sourceControl, project, projectRepository } = await seedLinkedRepository();

    const result = await resolvePrimaryEnvironmentRepository({
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

    const result = await resolvePrimaryEnvironmentRepository({
      sourceControl,
      orgId: 'org-1',
      factoryProjectId: project.id,
    });

    expect(result).toMatchObject({ found: true, baseBranch: 'develop' });
  });

  it('follows position order and skips links out of the environment', async () => {
    const { sourceControl, project, repository, projectRepository } = await seedLinkedRepository();
    const docs = await sourceControl.repositories.upsert({
      orgId: 'org-1',
      input: {
        installationId: repository.installationId,
        externalId: '457',
        slug: 'mastra-ai/template-docs-expert',
        defaultBranch: 'main',
      },
    });
    const docsLink = await sourceControl.projectRepositories.link({
      orgId: 'org-1',
      connectionId: projectRepository.connectionId,
      repositoryId: docs.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'local',
      sandboxWorkdir: '/sandbox/docs',
    });
    // The FACT-334 shape: docs-expert first, mastra second.
    await sourceControl.projectRepositories.update({ orgId: 'org-1', id: docsLink.id, input: { position: 1 } });
    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: projectRepository.id,
      input: { position: 2 },
    });

    await expect(
      resolvePrimaryEnvironmentRepository({ sourceControl, orgId: 'org-1', factoryProjectId: project.id }),
    ).resolves.toMatchObject({ found: true, projectRepositoryId: docsLink.id });

    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: docsLink.id,
      input: { inEnvironment: false },
    });
    await expect(
      resolvePrimaryEnvironmentRepository({ sourceControl, orgId: 'org-1', factoryProjectId: project.id }),
    ).resolves.toMatchObject({ found: true, projectRepositoryId: projectRepository.id });
  });

  // A project can carry connections for several integrations; only the one
  // belonging to this owner can back a session.
  it('ignores connections belonging to other integrations', async () => {
    const { seeded, project } = await seedLinkedRepository();

    const result = await resolvePrimaryEnvironmentRepository({
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
      resolvePrimaryEnvironmentRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: bareProject.id,
      }),
    ).resolves.toEqual({ found: false, reason: 'repository' });
    // The seeded project still resolves, so the miss is about this project.
    await expect(
      resolvePrimaryEnvironmentRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
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
    // The same slug linked twice: the dedupe keeps the oldest link in the
    // environment, so the reinstall has to put the fresh link back (the
    // environment PATCH does). The stale link is skipped because its
    // repository no longer resolves.
    await sourceControl.projectRepositories.update({
      orgId: 'org-1',
      id: freshProjectRepository.id,
      input: { inEnvironment: true },
    });

    await expect(
      resolvePrimaryEnvironmentRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
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
      resolvePrimaryEnvironmentRepository({
        sourceControl,
        orgId: 'org-1',
        factoryProjectId: project.id,
      }),
    ).resolves.toEqual({ found: false, reason: 'repository' });
  });
});
