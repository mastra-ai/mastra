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
      setEnvironmentVariable: mocks.setEnvironmentVariable,
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
  setEnvironmentVariable: vi.fn(),
  /** Org GitHub PATs surfaced via integration settings; null = not configured. */
  githubPat: null as string | null,
  githubReviewerPat: null as string | null,
  /** Run-binding role resolved for the session; null = no binding found. */
  runBindingRole: null as string | null,
  findRunBindingBySession: vi.fn(async () =>
    mocks.runBindingRole ? { role: mocks.runBindingRole, orgId: 'org-1' } : null,
  ),
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
  mocks.setEnvironmentVariable.mockClear();
  mocks.githubPat = null;
  mocks.githubReviewerPat = null;
  mocks.runBindingRole = null;
  mocks.findRunBindingBySession.mockClear();
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
  projectId: string,
  sessionId: string,
  user: Record<string, unknown> = { organizationId: 'org-1', workosId: 'user-1' },
) {
  const requestContext = createRequestContext('/unused');
  requestContext.set('controller', {
    modeId: 'build',
    resourceId: sessionId,
    threadId: sessionId,
    getState: () => ({ factoryProjectId: projectId }),
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
    integrationStorage: {
      settings: {
        get: vi.fn(async () =>
          mocks.githubPat || mocks.githubReviewerPat
            ? {
                ...(mocks.githubPat ? { pat: mocks.githubPat } : {}),
                ...(mocks.githubReviewerPat ? { reviewerPat: mocks.githubReviewerPat } : {}),
              }
            : null,
        ),
      },
    },
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

    expect(assetNames).toEqual(['configure-factory-rules', 'factory-plan', 'factory-review', 'factory-triage']);
    await Promise.all(
      assetNames.map(skillName => expect(fs.stat(path.join(assetRoot, skillName, 'SKILL.md'))).resolves.toBeDefined()),
    );
  });

  it('keeps the autonomous Factory skills on the terminal-handoff contract', async () => {
    const assetRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'factory-skills');
    const read = (skillName: string) => fs.readFile(path.join(assetRoot, skillName, 'SKILL.md'), 'utf8');

    for (const skillName of ['factory-triage', 'factory-plan', 'factory-review']) {
      const prose = await read(skillName);
      // Terminal batched handoff + governed transition, never a mid-run human gate.
      expect(prose).toContain('factory_transition_work_item');
      expect(prose).toContain('as an assumption');
      expect(prose).toContain('Never wait for or solicit human input mid-run');
      expect(prose).not.toContain('ask_user');
    }

    const plan = await read('factory-plan');
    expect(plan).toContain('if this conversation already contains a triage/understanding pass');
    expect(plan).toContain('Do not call `submit_plan`');

    const review = await read('factory-review');
    expect(review).toContain('Verdict: approve');
    expect(review).toContain('Verdict: request changes');
  });

  it('adds read-only Web Factory skills and keeps them authoritative over project shadows', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastracode-web-factory-skills-'));
    tempDirs.push(projectPath);
    const shadowDir = path.join(projectPath, '.mastracode', 'skills', 'factory-triage');
    await fs.mkdir(shadowDir, { recursive: true });
    await fs.writeFile(
      path.join(shadowDir, 'SKILL.md'),
      '---\nname: factory-triage\ndescription: Project shadow\n---\n\n# Shadowed Project Skill',
    );

    const workspace = await getFactoryWorkspace({ requestContext: createRequestContext(projectPath) });
    const configureRules = await workspace.skills?.get('configure-factory-rules');
    const factoryTriage = await workspace.skills?.get('factory-triage');
    const factoryReview = await workspace.skills?.get('factory-review');
    const filesystem = workspace.filesystem as LocalFilesystem;

    expect(workspace.id).toContain('-web-factory');
    expect(configureRules?.instructions).toContain('# Configure Factory Rules');
    expect(factoryTriage?.instructions).toContain('# Factory Triage');
    expect(factoryTriage?.instructions).not.toContain('# Shadowed Project Skill');
    expect(factoryReview?.instructions).toContain('# Factory Review');
    expect(filesystem.allowedPaths).not.toContain('/__mastracode_factory_skills__');
    await expect(filesystem.writeFile(path.join(factoryTriage!.path, 'SKILL.md'), 'mutated')).rejects.toMatchObject({
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
        workItems: { findRunBindingBySession: mocks.findRunBindingBySession } as any,
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

  it('installs a configured org PAT as GH_TOKEN while git keeps the repository-scoped token', async () => {
    mocks.githubPat = 'ghp_org_pat';
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });

    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });

    // gh CLI env gets the PAT…
    expect(mocks.ensureSandbox).toHaveBeenCalledWith(
      expect.any(Object),
      { GH_TOKEN: 'ghp_org_pat' },
      undefined,
      expect.any(Object),
    );
    // …but git materialization keeps the installation-scoped token.
    expect(mocks.materializeRepo).toHaveBeenCalledWith(expect.objectContaining({ token: 'repo-token-repository-1' }));
  });

  it('installs the reviewer PAT for review-board sessions', async () => {
    mocks.githubPat = 'ghp_worker';
    mocks.githubReviewerPat = 'ghp_reviewer';
    mocks.runBindingRole = 'review';
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });

    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });

    expect(mocks.ensureSandbox).toHaveBeenCalledWith(
      expect.any(Object),
      { GH_TOKEN: 'ghp_reviewer' },
      undefined,
      expect.any(Object),
    );
  });

  it('falls back to the worker PAT for review sessions without a reviewer token', async () => {
    mocks.githubPat = 'ghp_worker';
    mocks.runBindingRole = 'review';
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });

    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });

    expect(mocks.ensureSandbox).toHaveBeenCalledWith(
      expect.any(Object),
      { GH_TOKEN: 'ghp_worker' },
      undefined,
      expect.any(Object),
    );
  });

  it('keeps the worker PAT for non-review sessions even when a reviewer token exists', async () => {
    mocks.githubPat = 'ghp_worker';
    mocks.githubReviewerPat = 'ghp_reviewer';
    mocks.runBindingRole = 'triage';
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });

    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });

    expect(mocks.ensureSandbox).toHaveBeenCalledWith(
      expect.any(Object),
      { GH_TOKEN: 'ghp_worker' },
      undefined,
      expect.any(Object),
    );
  });

  it('registers a runtime injector for refreshing GH_TOKEN in the active sandbox', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    const requestContext = createGithubRequestContext('project-1', 'session-a');

    await workspace({ requestContext });
    injectGithubToken(requestContext, 'fresh-token');

    expect(mocks.setEnvironmentVariable).toHaveBeenCalledWith('GH_TOKEN', 'fresh-token');
  });

  it('re-registers the token injector when reusing a workspace on a later request', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });
    const requestContext = createGithubRequestContext('project-1', 'session-a');

    await workspace({
      requestContext,
      mastra: { getWorkspaceById: vi.fn(() => ({ setToolsConfig: vi.fn() })) } as any,
    });
    injectGithubToken(requestContext, 'later-token');

    expect(mocks.setEnvironmentVariable).toHaveBeenCalledWith('GH_TOKEN', 'later-token');
  });

  it('installs a PAT saved after provisioning into the running sandbox on the next reuse', async () => {
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });
    expect(mocks.setEnvironmentVariable).not.toHaveBeenCalled();

    // The org pastes a PAT in Settings while the sandbox is already running —
    // it must take effect without a server restart.
    mocks.githubPat = 'ghp_saved_later';
    await workspace({
      requestContext: createGithubRequestContext('project-1', 'session-a'),
      mastra: { getWorkspaceById: vi.fn(() => ({ setToolsConfig: vi.fn() })) } as any,
    });

    expect(mocks.setEnvironmentVariable).toHaveBeenCalledWith('GH_TOKEN', 'ghp_saved_later');
  });

  it('does not re-inject an unchanged PAT on workspace reuse', async () => {
    mocks.githubPat = 'ghp_org_pat';
    const { workspace } = await createLocalFactory();
    addProject();
    addSession({ id: 'session-a' });
    await workspace({ requestContext: createGithubRequestContext('project-1', 'session-a') });
    mocks.setEnvironmentVariable.mockClear();

    await workspace({
      requestContext: createGithubRequestContext('project-1', 'session-a'),
      mastra: { getWorkspaceById: vi.fn(() => ({ setToolsConfig: vi.fn() })) } as any,
    });

    expect(mocks.setEnvironmentVariable).not.toHaveBeenCalled();
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
