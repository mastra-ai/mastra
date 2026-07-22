import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDynamicWorkspace } from '@mastra/code-sdk/agents/workspace';
import { RequestContext } from '@mastra/core/request-context';
import { LocalSandbox } from '@mastra/core/workspace';
import type { LocalFilesystem } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  projects: [] as any[],
  sessions: [] as any[],
  updates: [] as Array<{ set: Record<string, unknown>; where: unknown }>,
  ensureSandbox: vi.fn(async (binding: { sandboxId: string | null; setSandboxId: (id: string) => Promise<void> }) => {
    if (!binding.sandboxId) await binding.setSandboxId('sandbox-1');
    return {
      id: 'sandbox-1',
      start: vi.fn(async () => {}),
      getInfo: vi.fn(async () => ({ metadata: { sandboxId: 'sandbox-1' } })),
      executeCommand: vi.fn(async () => ({ exitCode: 0, stdout: '', stderr: '' })),
    };
  }),
  materializeRepo: vi.fn(async (_input: unknown) => {}),
  checkoutSessionBranch: vi.fn(async () => {}),
  runWorktreeSetup: vi.fn(async () => {}),
  getRepositoryAccess: vi.fn(async ({ repositoryId }: { repositoryId: string }) => ({
    cloneUrl: 'https://github.com/octocat/hello.git',
    authorization: { scheme: 'bearer' as const, token: `repo-token-${repositoryId}` },
  })),
  mintInstallationToken: vi.fn(async () => 'gh-token'),
}));

vi.mock('./integrations/github/sandbox', () => ({
  materializeRepo: (...args: unknown[]) => (mocks.materializeRepo as any)(...args),
  checkoutSessionBranch: (...args: unknown[]) => (mocks.checkoutSessionBranch as any)(...args),
  runWorktreeSetup: (...args: unknown[]) => (mocks.runWorktreeSetup as any)(...args),
}));

import { injectGithubToken } from './integrations/github/token-refresh.js';
import { SandboxFleet } from './sandbox/fleet.js';
import { checkpointNameForSession, createWorkspaceFactory, getFactoryWorkspace } from './workspace.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(tempDir => fs.rm(tempDir, { recursive: true, force: true })));
  mocks.projects.splice(0);
  mocks.sessions.splice(0);
  mocks.updates.splice(0);
  mocks.ensureSandbox.mockClear();
  mocks.materializeRepo.mockClear();
  mocks.checkoutSessionBranch.mockClear();
  mocks.runWorktreeSetup.mockClear();
  mocks.getRepositoryAccess.mockClear();
  mocks.mintInstallationToken.mockClear();
});

function createRequestContext(projectPath: string) {
  const requestContext = new RequestContext();
  const getState = () => ({
    projectPath,
    homeDir: projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    getState,
    session: { id: 'local-session', state: { get: getState } },
  });
  return requestContext;
}

function createGithubRequestContext(
  _projectId: string,
  sessionId: string,
  user: Record<string, unknown> = { organizationId: 'org-1', workosId: 'user-1' },
) {
  const requestContext = createRequestContext('/unused');
  requestContext.set('controller', {
    modeId: 'build',
    resourceId: sessionId,
    session: { id: sessionId },
  });
  requestContext.set('user', user);
  return requestContext;
}

function createUnscopedGithubRequestContext(projectId: string, projectPath: string) {
  const requestContext = createRequestContext(projectPath);
  const getState = () => ({
    projectPath,
    homeDir: projectPath,
    sandboxAllowedPaths: [],
  });
  requestContext.set('controller', {
    modeId: 'build',
    resourceId: projectId,
    getState,
    session: { id: projectId, state: { get: getState } },
  });
  requestContext.set('user', { organizationId: 'org-1', workosId: 'user-1' });
  return requestContext;
}

function addProject(overrides: Record<string, unknown> = {}) {
  const project = {
    id: 'project-1',
    orgId: 'org-1',
    userId: 'creator-1',
    installationId: 123,
    repoFullName: 'octocat/hello',
    repoId: 456,
    defaultBranch: 'main',
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/octocat/hello',
    setupCommand: null,
    createdAt: new Date(),
    ...overrides,
  };
  mocks.projects.push(project);
  return project;
}

function addSession(overrides: Record<string, unknown> = {}) {
  const session = {
    id: String(overrides.id ?? 'session-1'),
    sessionId: String(overrides.sessionId ?? overrides.id ?? 'session-1'),
    orgId: 'org-1',
    userId: 'user-1',
    projectRepositoryId: 'project-1',
    branch: 'feature-a',
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  mocks.sessions.push(session);
  return session;
}

function fakeGithubIntegration() {
  const setSandbox = vi.fn(async ({ id, sandboxId, sandboxWorkdir }) => {
    const session = mocks.sessions.find(row => row.id === id);
    if (session) Object.assign(session, { sandboxId, sandboxWorkdir, updatedAt: new Date() });
    mocks.updates.push({ set: { sandboxId, sandboxWorkdir }, where: { id } });
  });
  return {
    id: 'github',
    versionControl: {
      getRepositoryAccess: mocks.getRepositoryAccess,
    },
    mintInstallationToken: (...args: unknown[]) => mocks.mintInstallationToken(...(args as [])),
    getInstallationOctokit: vi.fn(),
    sourceControlStorage: {
      sessions: {
        getBySessionId: vi.fn(async (id: string) => mocks.sessions.find(session => session.sessionId === id) ?? null),
        setSandbox,
        markMaterialized: vi.fn(async () => {}),
      },
      projectRepositories: {
        get: vi.fn(async ({ orgId, id }) => {
          const project = mocks.projects.find(candidate => candidate.orgId === orgId && candidate.id === id);
          return project
            ? {
                id: project.id,
                connectionId: 'connection-1',
                repositoryId: 'repository-1',
                branch: project.defaultBranch,
                sandboxWorkdir: project.sandboxWorkdir,
                setupCommand: project.setupCommand,
              }
            : null;
        }),
      },
      connections: { get: vi.fn(async () => ({ id: 'connection-1', installationId: 'installation-1' })) },
      repositories: {
        get: vi.fn(async () => {
          const project = mocks.projects[0];
          return project
            ? { id: 'repository-1', slug: project.repoFullName, defaultBranch: project.defaultBranch }
            : null;
        }),
      },
      installations: { get: vi.fn(async () => ({ id: 'installation-1', externalId: '123' })) },
    },
  };
}

describe('getFactoryWorkspace', () => {
  it('derives unique stable checkpoint names from session ids', () => {
    expect(checkpointNameForSession('session-a')).toBe('mastracode-session-session-a');
    expect(checkpointNameForSession('session-b')).toBe('mastracode-session-session-b');
    expect(checkpointNameForSession('session-a')).not.toBe(checkpointNameForSession('session-b'));
  });

  it('keeps Factory and default workspace cache identities separate', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-factory-cache-'));
    tempDirs.push(projectPath);
    const requestContext = createRequestContext(projectPath);

    const defaultWorkspace = await getDynamicWorkspace({ requestContext });
    const factoryWorkspace = await getFactoryWorkspace({ requestContext });

    expect(defaultWorkspace.id).toBe(`mastra-code-workspace-${projectPath}`);
    expect(factoryWorkspace.id).toBe(`mastra-code-workspace-${projectPath}-web-factory`);
    expect(factoryWorkspace.id).not.toBe(defaultWorkspace.id);
  });

  it('keeps the reserved skill list aligned with packaged Factory assets', async () => {
    const assetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'factory-skills');
    const assetNames = (await fs.readdir(assetRoot)).sort();

    expect(assetNames).toEqual(['configure-factory-rules', 'understand-issue', 'understand-pr']);
    await Promise.all(
      assetNames.map(skillName => expect(fs.stat(path.join(assetRoot, skillName, 'SKILL.md'))).resolves.toBeDefined()),
    );
  });

  it('adds read-only Web Factory skills and keeps them authoritative over project shadows', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-factory-skills-'));
    tempDirs.push(projectPath);
    const shadowDir = path.join(projectPath, '.mastracode', 'skills', 'understand-issue');
    await fs.mkdir(shadowDir, { recursive: true });
    await fs.writeFile(
      path.join(shadowDir, 'SKILL.md'),
      '---\nname: understand-issue\ndescription: Project shadow\n---\n\n# Shadowed Project Skill',
    );

    const workspace = await getFactoryWorkspace({ requestContext: createRequestContext(projectPath) });
    const configureRules = await workspace.skills?.get('configure-factory-rules');
    const understandIssue = await workspace.skills?.get('understand-issue');
    const understandPr = await workspace.skills?.get('understand-pr');
    const filesystem = workspace.filesystem as LocalFilesystem;

    expect(workspace.id).toContain('-web-factory');
    expect(configureRules?.instructions).toContain('# Configure Factory Rules');
    expect(understandIssue?.instructions).toContain('# Understand Issue');
    expect(understandIssue?.instructions).not.toContain('# Shadowed Project Skill');
    expect(understandIssue?.metadata).toMatchObject({ goal: true });
    expect(understandPr?.instructions).toContain('# Understand PR');
    expect(understandPr?.metadata).toMatchObject({ goal: true });
    expect(filesystem.allowedPaths).not.toContain('/__mastracode_factory_skills__');
    await expect(filesystem.writeFile(path.join(understandIssue!.path, 'SKILL.md'), 'mutated')).rejects.toMatchObject({
      name: 'PermissionError',
      code: 'EACCES',
    });
  });
});

describe('GitHub session workspace preparation', () => {
  async function createLocalFactory(rootPrefix = 'mastracode-web-local-sessions-') {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), rootPrefix));
    tempDirs.push(root);
    const machine = new LocalSandbox({ workingDirectory: root });
    const fleet = new SandboxFleet({ machine, workdirBase: root });
    (fleet as any).ensureSandbox = mocks.ensureSandbox;
    return {
      root,
      workspace: createWorkspaceFactory({
        sandbox: { machine, workdir: root },
        github: fakeGithubIntegration() as any,
        fleet,
      }),
    };
  }

  it('prepares distinct local session checkouts and branches through the factory', async () => {
    const { root, workspace } = await createLocalFactory();
    addProject({ setupCommand: 'pnpm i' });
    addSession({ id: 'session-a', branch: 'feature-a' });
    addSession({ id: 'session-b', branch: 'feature-b' });

    const workspaceA = await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });
    const workspaceB = await workspace({ requestContext: createGithubRequestContext('project-1', 'session-b') });

    const workdirA = path.join(root, 'github-sessions', 'octocat', 'hello', 'session-a');
    const workdirB = path.join(root, 'github-sessions', 'octocat', 'hello', 'session-b');
    expect(workspaceA.id).toContain('project-1-session-a');
    expect(workspaceB.id).toContain('project-1-session-b');
    expect(mocks.ensureSandbox).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      { GH_TOKEN: 'repo-token-repository-1' },
      undefined,
      {
        workingDirectory: workdirA,
      },
    );
    expect(mocks.ensureSandbox).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      { GH_TOKEN: 'repo-token-repository-1' },
      undefined,
      {
        workingDirectory: workdirB,
      },
    );
    expect(mocks.materializeRepo).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        row: expect.objectContaining({ id: 'session-a', sandboxWorkdir: workdirA }),
        repoInfo: expect.objectContaining({ repoFullName: 'octocat/hello' }),
        token: 'repo-token-repository-1',
      }),
    );
    expect(mocks.checkoutSessionBranch).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      workdirB,
      expect.objectContaining({ branch: 'feature-b', baseBranch: 'main' }),
    );
    expect(mocks.runWorktreeSetup).toHaveBeenCalledTimes(2);
    expect(mocks.sessions.find(session => session.id === 'session-a')?.sandboxWorkdir).toBe(workdirA);
    expect(mocks.sessions.find(session => session.id === 'session-b')?.sandboxWorkdir).toBe(workdirB);
  });

  it('uses repository-scoped access when materializing a Factory session', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });

    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });

    expect(mocks.getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'repository-1' });
    expect(mocks.mintInstallationToken).not.toHaveBeenCalled();
    expect(mocks.materializeRepo).toHaveBeenCalledWith(expect.objectContaining({ token: 'repo-token-repository-1' }));
  });

  it('registers a runtime injector for refreshing GH_TOKEN in the active sandbox', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    const requestContext = createGithubRequestContext('project-1', 'session-a');

    await workspace({ requestContext });
    const environment = mocks.ensureSandbox.mock.calls[0]![1] as Record<string, string>;
    injectGithubToken(requestContext, 'fresh-token');

    expect(environment.GH_TOKEN).toBe('fresh-token');
  });

  it('re-registers the token injector when reusing a workspace on a later request', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });
    const environment = mocks.ensureSandbox.mock.calls[0]![1] as Record<string, string>;
    const requestContext = createGithubRequestContext('project-1', 'session-a');

    await workspace({
      requestContext,
      mastra: { getWorkspaceById: vi.fn(() => ({ setToolsConfig: vi.fn() })) } as any,
    });
    injectGithubToken(requestContext, 'later-token');

    expect(environment.GH_TOKEN).toBe('later-token');
  });

  it('reuses an already registered workspace for the exact GitHub session', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    const existing = { id: 'existing', setToolsConfig: vi.fn() };

    const result = await workspace({
      requestContext: createGithubRequestContext('project-1', 'session-a'),
      mastra: { getWorkspaceById: vi.fn(() => existing) } as any,
    });

    expect(result).toBe(existing);
    expect(existing.setToolsConfig).toHaveBeenCalled();
    expect(mocks.ensureSandbox).not.toHaveBeenCalled();
    expect(mocks.materializeRepo).not.toHaveBeenCalled();
  });

  it('accepts provider users whose stable identity is exposed as id', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    const requestContext = createGithubRequestContext('project-1', 'session-a');
    requestContext.set('user', { organizationId: 'org-1', id: 'user-1' });

    await expect(workspace({ requestContext })).resolves.toBeDefined();
  });

  it('enforces exact session scope ownership', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a', userId: 'someone-else' });

    await expect(workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') })).rejects.toThrow(
      /Factory session session-a is not available/,
    );
  });

  it('accepts session owners identified by provider-neutral id instead of workosId', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    const existing = { id: 'existing', setToolsConfig: vi.fn() };

    const result = await workspace({
      requestContext: createGithubRequestContext('project-1', 'session-a', {
        organizationId: 'org-1',
        id: 'user-1',
      }),
      mastra: { getWorkspaceById: vi.fn(() => existing) } as any,
    });

    expect(result).toBe(existing);
  });

  it('keeps ordinary local-folder projects on the dynamic workspace resolver', async () => {
    const { workspace } = await createLocalFactory();
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-local-folder-'));
    tempDirs.push(projectPath);

    const result = await workspace({ requestContext: createRequestContext(projectPath) });

    expect(result.id).toBe(`mastra-code-workspace-${projectPath}-web-factory`);
    expect(mocks.ensureSandbox).not.toHaveBeenCalled();
  });

  it('does not require a GitHub session scope for unscoped project-level requests', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-unscoped-github-'));
    tempDirs.push(projectPath);

    const result = await workspace({ requestContext: createUnscopedGithubRequestContext('project-1', projectPath) });

    expect(result.id).toBe(`mastra-code-workspace-${projectPath}-web-factory`);
    expect(mocks.ensureSandbox).not.toHaveBeenCalled();
    expect(mocks.materializeRepo).not.toHaveBeenCalled();
  });
});
