import { spawn } from 'node:child_process';
import type * as FsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');
const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
}));

vi.mock('node:fs', () => ({
  default: { existsSync: fsMocks.existsSync },
}));

vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === CANCEL),
  cancel: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('picocolors', () => ({
  default: {
    green: (value: string) => value,
    cyan: (value: string) => value,
    yellow: (value: string) => value,
  },
}));

vi.mock('../../analytics/index', () => ({
  getAnalytics: vi.fn(() => null),
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: vi.fn(),
}));

vi.mock('../auth/orgs.js', () => ({
  OrgSelectionCancelledError: class OrgSelectionCancelledError extends Error {},
  resolveCurrentOrg: vi.fn(),
}));

vi.mock('../init/observability-provision', () => ({
  provisionObservabilityProject: vi.fn(),
}));

vi.mock('../init/utils.js', () => ({
  writeObservabilityEnv: vi.fn(),
}));

vi.mock('../init/skills-install', () => ({
  installMastraSkills: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  getPackageManager: vi.fn(() => 'npm'),
  isGitInitialized: vi.fn(),
  gitInit: vi.fn(),
}));

vi.mock('./coding-agents', () => ({
  detectCodingAgentSkills: vi.fn(),
}));

vi.mock('./provider-adapter', () => ({
  adaptDefaultTemplate: vi.fn(),
}));

vi.mock('./utils', () => ({
  createOwnedStagingDirectory: vi.fn(),
  cleanupOwnedStagingDirectory: vi.fn(),
  publishStagedProject: vi.fn(),
  writeEmptyScaffold: vi.fn(),
}));

vi.mock('../../utils/template-utils', () => ({
  loadTemplates: vi.fn(),
  selectTemplate: vi.fn(),
  findTemplateByName: vi.fn(),
}));

vi.mock('../../utils/clone-template', () => ({
  cloneTemplate: vi.fn(),
  installDependencies: vi.fn(),
}));

const mockTemplate = {
  githubUrl: 'https://github.com/mastra-ai/template-agent-harness',
  title: 'Agent Harness',
  slug: 'template-agent-harness',
  agents: ['agent'],
  mcp: [],
  tools: ['web-fetch'],
  networks: [],
  workflows: [],
};

function mockValidGitHubProject() {
  vi.mocked(global.fetch).mockImplementation(async input => {
    const url = String(input);
    if (url.endsWith('/package.json')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ dependencies: { '@mastra/core': 'latest' } }),
      } as Response;
    }
    if (url.endsWith('/src/mastra/index.ts')) {
      return { ok: true, text: async () => 'export const mastra = new Mastra({});' } as Response;
    }
    return { ok: false } as Response;
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  fsMocks.existsSync.mockReturnValue(false);
  global.fetch = vi.fn();

  const prompts = await import('@clack/prompts');
  vi.mocked(prompts.text).mockResolvedValue('my-project');
  vi.mocked(prompts.select).mockResolvedValue('skip');
  vi.mocked(prompts.password).mockResolvedValue('secret');

  const credentials = await import('../auth/credentials.js');
  vi.mocked(credentials.getToken).mockResolvedValue('auth-token');
  const orgs = await import('../auth/orgs.js');
  vi.mocked(orgs.resolveCurrentOrg).mockResolvedValue({ orgId: 'org-id', orgName: 'Test Org' });
  const observability = await import('../init/observability-provision');
  vi.mocked(observability.provisionObservabilityProject).mockResolvedValue({
    token: 'platform-token',
    projectId: 'platform-project-id',
    projectSlug: 'my-project',
    projectName: 'my-project',
    orgName: 'Test Org',
  });
  const initUtils = await import('../init/utils.js');
  vi.mocked(initUtils.writeObservabilityEnv).mockResolvedValue();

  const templateUtils = await import('../../utils/template-utils');
  vi.mocked(templateUtils.loadTemplates).mockResolvedValue([mockTemplate]);
  vi.mocked(templateUtils.findTemplateByName).mockReturnValue(mockTemplate);
  vi.mocked(templateUtils.selectTemplate).mockResolvedValue(mockTemplate);

  const clone = await import('../../utils/clone-template');
  vi.mocked(clone.cloneTemplate).mockResolvedValue('/tmp/my-project');
  vi.mocked(clone.installDependencies).mockResolvedValue();

  const codingAgents = await import('./coding-agents');
  vi.mocked(codingAgents.detectCodingAgentSkills).mockResolvedValue([['', 'universal']]);
  const skills = await import('../init/skills-install');
  vi.mocked(skills.installMastraSkills).mockResolvedValue({ success: true, agents: ['universal'] });
  const commandUtils = await import('../utils.js');
  vi.mocked(commandUtils.isGitInitialized).mockResolvedValue(false);
  vi.mocked(commandUtils.gitInit).mockResolvedValue();

  const createUtils = await import('./utils');
  vi.mocked(createUtils.createOwnedStagingDirectory).mockResolvedValue({
    rootPath: '/tmp/.my-project.mastra-create-test',
    projectPath: '/tmp/.my-project.mastra-create-test/my-project',
  });
  vi.mocked(createUtils.cleanupOwnedStagingDirectory).mockResolvedValue();
  vi.mocked(createUtils.publishStagedProject).mockResolvedValue();
  vi.mocked(createUtils.writeEmptyScaffold).mockResolvedValue();

  const adapter = await import('./provider-adapter');
  vi.mocked(adapter.adaptDefaultTemplate).mockResolvedValue({
    displayName: 'OpenAI',
    sdkPackage: '@ai-sdk/openai',
    sdkVersion: 'template-version',
    providerIdentifier: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiKeyPrerequisite: 'An OpenAI API key',
    featureDescription: 'OpenAI web search and direct web page fetching',
  });
});

describe('create preflight and mode orchestration', () => {
  it('uses the default template and an explicit provider skips model prompts', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const { loadTemplates } = await import('../../utils/template-utils');
    const prompts = await import('@clack/prompts');
    const resolveVersionTag = vi.fn().mockResolvedValue('latest');

    await create({ projectName: 'my-project', llmProvider: 'openai', resolveVersionTag });

    expect(resolveVersionTag).toHaveBeenCalledOnce();
    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith({
      template: mockTemplate,
      projectName: 'my-project',
      targetDir: '/tmp/.my-project.mastra-create-test',
      branch: undefined,
      signal: expect.any(AbortSignal),
    });
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    expect(adaptDefaultTemplate).toHaveBeenCalledWith({
      projectPath: '/tmp/.my-project.mastra-create-test/my-project',
      projectName: 'my-project',
      packageManager: 'npm',
      provider: 'openai',
      apiKey: undefined,
      versionTag: 'latest',
    });
  });

  it('prompts for name, provider, then optional API key in managed mode', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const resolveVersionTag = vi.fn().mockResolvedValue('latest');

    vi.mocked(prompts.text).mockResolvedValue('prompted-project');
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('anthropic')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('no');

    await create({ resolveVersionTag });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.select).toHaveBeenCalledTimes(3);
    expect(prompts.text).toHaveBeenCalledBefore(vi.mocked(prompts.select));
    expect(resolveVersionTag).toHaveBeenCalledAfter(vi.mocked(prompts.select));
    expect(prompts.password).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ projectName: 'prompted-project' }));
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    expect(adaptDefaultTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'anthropic', apiKey: undefined }),
    );
  });

  it('retains an explicit API key while prompting only for the missing provider', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');

    vi.mocked(prompts.select).mockResolvedValueOnce('google').mockResolvedValueOnce('no');

    await create({
      projectName: 'my-project',
      llmApiKey: 'provided-key',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.select).toHaveBeenCalledTimes(2);
    expect(prompts.password).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledOnce();
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    expect(adaptDefaultTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', apiKey: 'provided-key' }),
    );
  });

  it('arbitrary template mode never prompts for or applies a provider and skips tag resolution', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const resolveVersionTag = vi.fn();
    const trackEvent = vi.fn();

    await create({
      projectName: 'my-project',
      template: 'agent-harness',
      resolveVersionTag,
      analytics: { trackEvent } as never,
    });

    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ template: mockTemplate }));
    expect(trackEvent).toHaveBeenCalledWith('cli_create_mode_selected', {
      mode: 'template',
      template_slug: mockTemplate.slug,
      skills: true,
      git: true,
    });
    expect(trackEvent).toHaveBeenCalledWith('cli_template_used', { template_slug: mockTemplate.slug });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain(mockTemplate.title);
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain(mockTemplate.githubUrl);
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    expect(adaptDefaultTemplate).not.toHaveBeenCalled();
  });

  it('bare template mode prompts for the project name before loading and selecting templates', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { loadTemplates, selectTemplate } = await import('../../utils/template-utils');

    await create({ template: true });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.text).toHaveBeenCalledBefore(vi.mocked(loadTemplates));
    expect(selectTemplate).toHaveBeenCalledWith([mockTemplate], { signal: expect.any(AbortSignal) });
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('empty mode prompts only for a missing name and resolves the release tag lazily', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { writeEmptyScaffold } = await import('./utils');
    const resolveVersionTag = vi.fn().mockResolvedValue('snapshot');

    await create({ empty: true, resolveVersionTag });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(resolveVersionTag).toHaveBeenCalledOnce();
    expect(resolveVersionTag).toHaveBeenCalledAfter(vi.mocked(prompts.text));
    expect(writeEmptyScaffold).toHaveBeenCalledWith({
      projectPath: '/tmp/.my-project.mastra-create-test/my-project',
      projectName: 'my-project',
      versionTag: 'snapshot',
      packageManager: 'npm',
    });
  });

  it('empty mode with an explicit project name skips every prompt', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');

    await create({
      projectName: 'my-project',
      empty: true,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
  });

  it('rejects conflicting options before prompts or side effects', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { loadTemplates } = await import('../../utils/template-utils');
    const { createOwnedStagingDirectory } = await import('./utils');
    const resolveVersionTag = vi.fn();

    await expect(
      create({ projectName: 'my-project', empty: true, template: 'agent-harness', resolveVersionTag }),
    ).rejects.toThrow(`The --empty and --template options can't be used together`);

    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(createOwnedStagingDirectory).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
  });

  it('rejects an unsafe project name before release-tag lookup or staging', async () => {
    const { create } = await import('./create');
    const { createOwnedStagingDirectory } = await import('./utils');
    const resolveVersionTag = vi.fn();

    await expect(create({ projectName: '../project', empty: true, resolveVersionTag })).rejects.toThrow(
      'Project name must be',
    );
    expect(resolveVersionTag).not.toHaveBeenCalled();
    expect(createOwnedStagingDirectory).not.toHaveBeenCalled();
  });

  it('uses the trimmed project name for the target and scaffold', async () => {
    const { create } = await import('./create');
    const { publishStagedProject, writeEmptyScaffold } = await import('./utils');

    await create({
      projectName: '  valid-project  ',
      empty: true,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(writeEmptyScaffold).toHaveBeenCalledWith(expect.objectContaining({ projectName: 'valid-project' }));
    expect(publishStagedProject).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: 'valid-project', targetPath: path.resolve('valid-project') }),
    );
  });

  it('rejects an existing target before prompts, network access, tag lookup, or staging', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const { loadTemplates } = await import('../../utils/template-utils');
    const { createOwnedStagingDirectory } = await import('./utils');
    const resolveVersionTag = vi.fn();
    fsMocks.existsSync.mockReturnValue(true);

    await expect(create({ projectName: 'existing', resolveVersionTag })).rejects.toThrow(
      'A file or directory named "existing" already exists',
    );

    expect(prompts.select).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(cloneTemplate).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
    expect(createOwnedStagingDirectory).not.toHaveBeenCalled();
  });

  it('uses the beta branch for a managed Mastra template only when the resolved channel is beta', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');

    await create({
      projectName: 'my-project',
      llmProvider: 'openai',
      resolveVersionTag: vi.fn().mockResolvedValue('beta'),
    });

    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ branch: 'beta' }));
  });
});

describe('managed observability', () => {
  it('authenticates during materialization and provisions the prompted project after publish', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const credentials = await import('../auth/credentials.js');
    const orgs = await import('../auth/orgs.js');
    const observability = await import('../init/observability-provision');
    const initUtils = await import('../init/utils.js');
    const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
    const { publishStagedProject } = await import('./utils');
    const trackEvent = vi.fn();
    let finishOrgSelection: ((org: { orgId: string; orgName: string }) => void) | undefined;

    vi.mocked(prompts.text).mockResolvedValue('prompted-project');
    vi.mocked(prompts.select)
      .mockResolvedValueOnce('anthropic')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('yes');
    vi.mocked(orgs.resolveCurrentOrg).mockReturnValueOnce(
      new Promise(resolve => {
        finishOrgSelection = resolve;
      }),
    );
    vi.mocked(observability.provisionObservabilityProject).mockResolvedValueOnce({
      token: 'platform-token',
      projectId: 'platform-project-id',
      projectSlug: 'prompted-project',
      projectName: 'prompted-project',
      orgName: 'Test Org',
    });

    const createPromise = create({
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
      analytics: { trackEvent } as never,
    });

    await vi.waitFor(() => {
      expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ silent: true }));
      expect(installDependencies).toHaveBeenCalledWith(
        expect.any(String),
        'npm',
        60_000,
        expect.any(AbortSignal),
        true,
      );
      expect(publishStagedProject).toHaveBeenCalledOnce();
    });
    expect(observability.provisionObservabilityProject).not.toHaveBeenCalled();
    finishOrgSelection?.({ orgId: 'org-id', orgName: 'Test Org' });
    await createPromise;

    expect(credentials.getToken).toHaveBeenCalledBefore(vi.mocked(cloneTemplate));
    expect(orgs.resolveCurrentOrg).toHaveBeenCalledBefore(vi.mocked(publishStagedProject));
    expect(orgs.resolveCurrentOrg).toHaveBeenCalledWith('auth-token', {
      forcePrompt: true,
      exitOnCancel: false,
      signal: expect.any(AbortSignal),
    });
    expect(observability.provisionObservabilityProject).toHaveBeenCalledWith({
      defaultProjectName: 'prompted-project',
      mode: 'create',
      token: 'auth-token',
      org: { orgId: 'org-id', orgName: 'Test Org' },
    });
    expect(initUtils.writeObservabilityEnv).toHaveBeenCalledWith({
      projectPath: path.resolve('prompted-project'),
      token: 'platform-token',
      projectId: 'platform-project-id',
      endpoint: undefined,
    });
    expect(prompts.note).toHaveBeenCalledWith(expect.stringContaining('Set OPENAI_API_KEY in .env before starting.'));
    expect(prompts.note).not.toHaveBeenCalledWith(expect.stringContaining('Copy .env.example to .env'));
    expect(trackEvent).toHaveBeenCalledWith('cli_observability_selected', {
      command: 'create',
      enabled: true,
      answer: 'yes',
      selection_method: 'interactive',
    });
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('auth-token');
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('org-id');
    expect(JSON.stringify(trackEvent.mock.calls)).not.toContain('platform-project-id');
  });

  it('keeps the published project and writes placeholders when provisioning fails', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const observability = await import('../init/observability-provision');
    const initUtils = await import('../init/utils.js');
    const { publishStagedProject } = await import('./utils');

    vi.mocked(prompts.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('yes');
    vi.mocked(observability.provisionObservabilityProject).mockRejectedValueOnce(new Error('platform unavailable'));

    await expect(
      create({ projectName: 'my-project', resolveVersionTag: vi.fn().mockResolvedValue('latest') }),
    ).resolves.toBeUndefined();

    expect(publishStagedProject).toHaveBeenCalledOnce();
    expect(initUtils.writeObservabilityEnv).toHaveBeenCalledWith({ projectPath: path.resolve('my-project') });
    expect(prompts.note).toHaveBeenCalledWith(expect.stringContaining('platform unavailable'));
    expect(prompts.note).toHaveBeenCalledWith(expect.stringContaining('projects.mastra.ai'));
    expect(prompts.outro).toHaveBeenCalledOnce();
  });

  it('does not offer observability in a prompt-free managed flow', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const credentials = await import('../auth/credentials.js');
    const observability = await import('../init/observability-provision');

    await create({
      projectName: 'my-project',
      llmProvider: 'anthropic',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.select).not.toHaveBeenCalled();
    expect(credentials.getToken).not.toHaveBeenCalled();
    expect(observability.provisionObservabilityProject).not.toHaveBeenCalled();
  });

  it.each([
    { mode: 'empty', options: { empty: true } },
    { mode: 'template', options: { template: 'agent-harness' } },
  ])('does not offer observability in $mode mode', async ({ options }) => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const credentials = await import('../auth/credentials.js');

    await create({
      projectName: 'my-project',
      ...options,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.select).not.toHaveBeenCalled();
    expect(credentials.getToken).not.toHaveBeenCalled();
  });

  it('continues creation when the observability prompt is cancelled', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const credentials = await import('../auth/credentials.js');
    const observability = await import('../init/observability-provision');
    const skills = await import('../init/skills-install');
    const commandUtils = await import('../utils.js');
    const { publishStagedProject } = await import('./utils');
    const trackEvent = vi.fn();

    vi.mocked(prompts.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce(CANCEL as never);

    await expect(
      create({
        projectName: 'my-project',
        resolveVersionTag: vi.fn().mockResolvedValue('latest'),
        analytics: { trackEvent } as never,
      }),
    ).resolves.toBeUndefined();

    expect(prompts.log.info).toHaveBeenCalledWith('Skipping Mastra platform setup.');
    expect(credentials.getToken).not.toHaveBeenCalled();
    expect(observability.provisionObservabilityProject).not.toHaveBeenCalled();
    expect(publishStagedProject).toHaveBeenCalledOnce();
    expect(skills.installMastraSkills).toHaveBeenCalledOnce();
    expect(commandUtils.gitInit).toHaveBeenCalledOnce();
    expect(prompts.cancel).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('cli_observability_selected', {
      command: 'create',
      enabled: false,
      answer: 'no',
      selection_method: 'interactive',
    });
  });

  it('continues creation when Ctrl+C cancels platform authentication before materialization', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const credentials = await import('../auth/credentials.js');
    const observability = await import('../init/observability-provision');
    const { publishStagedProject } = await import('./utils');
    let finishVersionResolution: ((tag: string) => void) | undefined;
    let authSignal: AbortSignal | undefined;

    vi.mocked(prompts.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('yes');
    vi.mocked(credentials.getToken).mockImplementationOnce(
      signal =>
        new Promise((_resolve, reject) => {
          authSignal = signal;
          signal?.addEventListener('abort', () => reject(new Error('authentication aborted')), { once: true });
        }),
    );

    const createPromise = create({
      projectName: 'my-project',
      resolveVersionTag: () =>
        new Promise(resolve => {
          finishVersionResolution = resolve;
        }),
    });

    await vi.waitFor(() => expect(credentials.getToken).toHaveBeenCalledOnce());
    process.emit('SIGINT');
    expect(authSignal?.aborted).toBe(true);
    finishVersionResolution?.('latest');

    await expect(createPromise).resolves.toBeUndefined();
    expect(prompts.log.info).toHaveBeenCalledWith('Skipping Mastra platform setup.');
    expect(publishStagedProject).toHaveBeenCalledOnce();
    expect(observability.provisionObservabilityProject).not.toHaveBeenCalled();
    expect(prompts.cancel).not.toHaveBeenCalled();
    expect(prompts.outro).toHaveBeenCalledOnce();
  });

  it('continues materialization when Ctrl+C cancels Mastra platform setup', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const orgs = await import('../auth/orgs.js');
    const observability = await import('../init/observability-provision');
    const initUtils = await import('../init/utils.js');
    const skills = await import('../init/skills-install');
    const commandUtils = await import('../utils.js');
    const { installDependencies } = await import('../../utils/clone-template');
    const { publishStagedProject } = await import('./utils');
    let finishInstall: (() => void) | undefined;

    vi.mocked(prompts.select)
      .mockResolvedValueOnce('openai')
      .mockResolvedValueOnce('skip')
      .mockResolvedValueOnce('yes');
    vi.mocked(orgs.resolveCurrentOrg).mockImplementationOnce(
      (_token, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('platform setup aborted')), { once: true });
        }),
    );
    vi.mocked(installDependencies).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishInstall = resolve;
        }),
    );

    const createPromise = create({
      projectName: 'my-project',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    await vi.waitFor(() => {
      expect(orgs.resolveCurrentOrg).toHaveBeenCalledOnce();
      expect(installDependencies).toHaveBeenCalledOnce();
    });
    process.emit('SIGINT');
    finishInstall?.();

    await expect(createPromise).resolves.toBeUndefined();
    expect(prompts.log.info).toHaveBeenCalledWith('Skipping Mastra platform setup.');
    expect(publishStagedProject).toHaveBeenCalledOnce();
    expect(skills.installMastraSkills).toHaveBeenCalledOnce();
    expect(commandUtils.gitInit).toHaveBeenCalledOnce();
    expect(observability.provisionObservabilityProject).not.toHaveBeenCalled();
    expect(initUtils.writeObservabilityEnv).not.toHaveBeenCalled();
    expect(prompts.cancel).not.toHaveBeenCalled();
    expect(prompts.outro).toHaveBeenCalledOnce();
  });
});

describe('create materialization lifecycle', () => {
  it('installs in staging with the configured timeout before publishing and cleans staging last', async () => {
    const { create } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const { cleanupOwnedStagingDirectory, publishStagedProject, writeEmptyScaffold } = await import('./utils');

    await create({
      projectName: 'my-project',
      empty: true,
      timeout: 12_345,
      resolveVersionTag: vi.fn().mockResolvedValue('snapshot'),
    });

    expect(writeEmptyScaffold).toHaveBeenCalledBefore(vi.mocked(installDependencies));
    expect(installDependencies).toHaveBeenCalledWith(
      '/tmp/.my-project.mastra-create-test/my-project',
      'npm',
      12_345,
      expect.any(AbortSignal),
    );
    expect(installDependencies).toHaveBeenCalledBefore(vi.mocked(publishStagedProject));
    expect(publishStagedProject).toHaveBeenCalledWith({
      projectPath: '/tmp/.my-project.mastra-create-test/my-project',
      targetPath: path.resolve('my-project'),
      projectName: 'my-project',
    });
    expect(publishStagedProject).toHaveBeenCalledBefore(vi.mocked(cleanupOwnedStagingDirectory));
  });

  it('cleans owned staging and does not publish when managed adaptation fails', async () => {
    const { create } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    const { cleanupOwnedStagingDirectory, publishStagedProject } = await import('./utils');
    vi.mocked(adaptDefaultTemplate).mockRejectedValueOnce(new Error('compatibility failure'));

    await expect(
      create({
        projectName: 'my-project',
        llmProvider: 'openai',
        resolveVersionTag: vi.fn().mockResolvedValue('latest'),
      }),
    ).rejects.toThrow('compatibility failure');

    expect(installDependencies).not.toHaveBeenCalled();
    expect(publishStagedProject).not.toHaveBeenCalled();
    expect(cleanupOwnedStagingDirectory).toHaveBeenCalledWith('/tmp/.my-project.mastra-create-test');
  });

  it('keeps install failures fatal, cleans staging, and never publishes the target', async () => {
    const { create } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const { cleanupOwnedStagingDirectory, publishStagedProject } = await import('./utils');
    vi.mocked(installDependencies).mockRejectedValueOnce(new Error('install failed'));

    await expect(
      create({ projectName: 'my-project', empty: true, resolveVersionTag: vi.fn().mockResolvedValue('latest') }),
    ).rejects.toThrow('install failed');

    expect(publishStagedProject).not.toHaveBeenCalled();
    expect(cleanupOwnedStagingDirectory).toHaveBeenCalledWith('/tmp/.my-project.mastra-create-test');
  });

  it('aborts dependency installation and cleans staging on SIGINT', async () => {
    const { create, CreateCancelledError } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const { cleanupOwnedStagingDirectory, publishStagedProject } = await import('./utils');
    const prompts = await import('@clack/prompts');
    vi.mocked(installDependencies).mockImplementationOnce(async (_projectPath, _packageManager, _timeout, signal) => {
      process.emit('SIGINT');
      expect(signal?.aborted).toBe(true);
      signal?.throwIfAborted();
    });

    await expect(
      create({ projectName: 'my-project', empty: true, resolveVersionTag: vi.fn().mockResolvedValue('latest') }),
    ).rejects.toBeInstanceOf(CreateCancelledError);

    expect(publishStagedProject).not.toHaveBeenCalled();
    expect(cleanupOwnedStagingDirectory).toHaveBeenCalledWith('/tmp/.my-project.mastra-create-test');
    expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled');
  });

  it('aborts dependency installation and cleans staging on SIGTERM without reporting successful cancellation', async () => {
    const { create } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const { cleanupOwnedStagingDirectory, publishStagedProject } = await import('./utils');
    const prompts = await import('@clack/prompts');
    vi.mocked(installDependencies).mockImplementationOnce(async (_projectPath, _packageManager, _timeout, signal) => {
      process.emit('SIGTERM');
      expect(signal?.aborted).toBe(true);
      signal?.throwIfAborted();
    });

    await expect(
      create({ projectName: 'my-project', empty: true, resolveVersionTag: vi.fn().mockResolvedValue('latest') }),
    ).rejects.toThrow('Operation terminated by SIGTERM');

    expect(publishStagedProject).not.toHaveBeenCalled();
    expect(cleanupOwnedStagingDirectory).toHaveBeenCalledWith('/tmp/.my-project.mastra-create-test');
    expect(prompts.cancel).not.toHaveBeenCalled();
  });

  it('restores the invocation cwd even when a materializer changes it', async () => {
    const { create } = await import('./create');
    const { installDependencies } = await import('../../utils/clone-template');
    const invocationCwd = process.cwd();
    vi.mocked(installDependencies).mockImplementationOnce(async () => {
      process.chdir(os.tmpdir());
    });

    try {
      await create({ projectName: 'my-project', empty: true, resolveVersionTag: vi.fn().mockResolvedValue('latest') });
      expect(process.cwd()).toBe(invocationCwd);
    } finally {
      process.chdir(invocationCwd);
    }
  });

  it('names the selected provider environment key in the completion note when the key is skipped', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { adaptDefaultTemplate } = await import('./provider-adapter');
    vi.mocked(adaptDefaultTemplate).mockResolvedValueOnce({
      displayName: 'Anthropic',
      sdkPackage: '@ai-sdk/anthropic',
      sdkVersion: 'configured-version',
      providerIdentifier: 'anthropic',
      apiKeyEnv: 'ANTHROPIC_API_KEY',
      apiKeyPrerequisite: 'An Anthropic API key',
      featureDescription: 'Anthropic web search and direct web page fetching',
    });

    await create({
      projectName: 'my-project',
      llmProvider: 'anthropic',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.note).toHaveBeenCalledWith(expect.stringContaining('.env.example'));
    expect(prompts.note).toHaveBeenCalledWith(expect.stringContaining('ANTHROPIC_API_KEY'));
  });
});

describe('create skills and git automation', () => {
  it('installs detected skills in the published project before initializing git', async () => {
    const { create } = await import('./create');
    const { publishStagedProject } = await import('./utils');
    const prompts = await import('@clack/prompts');
    const codingAgents = await import('./coding-agents');
    const skills = await import('../init/skills-install');
    const commandUtils = await import('../utils.js');
    vi.mocked(codingAgents.detectCodingAgentSkills).mockResolvedValueOnce([
      ['claude', 'claude-code'],
      ['', 'universal'],
    ]);
    vi.mocked(skills.installMastraSkills).mockResolvedValueOnce({
      success: true,
      agents: ['claude-code', 'universal'],
    });

    await create({
      projectName: 'my-project',
      llmProvider: 'openai',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(commandUtils.isGitInitialized).toHaveBeenNthCalledWith(1, { cwd: process.cwd() });
    expect(commandUtils.isGitInitialized).toHaveBeenNthCalledWith(2, {
      cwd: path.resolve(process.cwd(), 'my-project'),
    });
    expect(skills.installMastraSkills).toHaveBeenCalledWith({
      directory: path.resolve(process.cwd(), 'my-project'),
      agents: ['claude-code', 'universal'],
    });
    expect(publishStagedProject).toHaveBeenCalledBefore(vi.mocked(skills.installMastraSkills));
    expect(skills.installMastraSkills).toHaveBeenCalledBefore(vi.mocked(commandUtils.gitInit));
    expect(prompts.log.success).toHaveBeenCalledWith('Installed skills for Claude Code, Universal. Initialized git.');
  });

  it.each([
    { mode: 'template', options: { template: 'agent-harness' } },
    { mode: 'empty', options: { empty: true } },
  ])('installs skills for $mode mode', async ({ options }) => {
    const { create } = await import('./create');
    const skills = await import('../init/skills-install');

    await create({
      projectName: 'my-project',
      ...options,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(skills.installMastraSkills).toHaveBeenCalledWith({
      directory: path.resolve(process.cwd(), 'my-project'),
      agents: ['universal'],
    });
  });

  it('honors --no-skills without preventing git initialization', async () => {
    const { create } = await import('./create');
    const codingAgents = await import('./coding-agents');
    const skills = await import('../init/skills-install');
    const commandUtils = await import('../utils.js');

    await create({
      projectName: 'my-project',
      empty: true,
      skills: false,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(codingAgents.detectCodingAgentSkills).not.toHaveBeenCalled();
    expect(skills.installMastraSkills).not.toHaveBeenCalled();
    expect(commandUtils.gitInit).toHaveBeenCalledOnce();
  });

  it('continues to git and completion when skills installation fails', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const skills = await import('../init/skills-install');
    const commandUtils = await import('../utils.js');
    vi.mocked(skills.installMastraSkills).mockResolvedValueOnce({
      success: false,
      error: 'skills unavailable',
      agents: ['universal'],
    });

    await create({
      projectName: 'my-project',
      empty: true,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(commandUtils.gitInit).toHaveBeenCalledOnce();
    expect(prompts.log.warn).toHaveBeenCalledWith('Could not install skills for Universal. Initialized git.');
    expect(prompts.outro).toHaveBeenCalledOnce();
  });

  it('honors --no-git after capturing the invocation worktree state', async () => {
    const { create } = await import('./create');
    const commandUtils = await import('../utils.js');

    await create({
      projectName: 'my-project',
      empty: true,
      git: false,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(commandUtils.isGitInitialized).toHaveBeenCalledOnce();
    expect(commandUtils.gitInit).not.toHaveBeenCalled();
  });

  it('skips nested git initialization when invoked inside an existing worktree', async () => {
    const { create } = await import('./create');
    const commandUtils = await import('../utils.js');
    vi.mocked(commandUtils.isGitInitialized).mockResolvedValueOnce(true);

    await create({
      projectName: 'my-project',
      empty: true,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(commandUtils.isGitInitialized).toHaveBeenCalledOnce();
    expect(commandUtils.gitInit).not.toHaveBeenCalled();
  });

  it('skips git initialization when the published target already has git metadata', async () => {
    const { create } = await import('./create');
    const commandUtils = await import('../utils.js');
    vi.mocked(commandUtils.isGitInitialized).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await create({
      projectName: 'my-project',
      template: 'agent-harness',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(commandUtils.isGitInitialized).toHaveBeenCalledTimes(2);
    expect(commandUtils.gitInit).not.toHaveBeenCalled();
  });

  it('keeps a published project and reaches completion when git initialization fails', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { publishStagedProject } = await import('./utils');
    const commandUtils = await import('../utils.js');
    vi.mocked(commandUtils.gitInit).mockRejectedValueOnce(new Error('git unavailable'));

    await expect(
      create({
        projectName: 'my-project',
        llmProvider: 'openai',
        resolveVersionTag: vi.fn().mockResolvedValue('latest'),
      }),
    ).resolves.toBeUndefined();

    expect(publishStagedProject).toHaveBeenCalledOnce();
    expect(prompts.log.warn).toHaveBeenCalledWith('Installed skills for Universal. Could not initialize git.');
    expect(prompts.outro).toHaveBeenCalledOnce();
  });
});

describe('create cancellation', () => {
  it.each([
    {
      name: 'project name',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.text).mockResolvedValue(CANCEL as never);
        return {};
      },
    },
    {
      name: 'provider',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select).mockResolvedValueOnce(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'API key choice',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select)
          .mockResolvedValueOnce('openai')
          .mockResolvedValueOnce(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'API key value',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select).mockResolvedValueOnce('openai').mockResolvedValueOnce('enter');
        vi.mocked(prompts.password).mockResolvedValue(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'template selection',
      setup: async () => {
        const { selectTemplate } = await import('../../utils/template-utils');
        vi.mocked(selectTemplate).mockResolvedValue(null);
        return { projectName: 'my-project', template: true as const };
      },
    },
  ])('cancels the complete create flow from the $name prompt', async ({ setup }) => {
    const { create, CreateCancelledError } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const { createOwnedStagingDirectory } = await import('./utils');
    const options = await setup();

    await expect(create(options)).rejects.toBeInstanceOf(CreateCancelledError);

    expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled');
    expect(cloneTemplate).not.toHaveBeenCalled();
    expect(createOwnedStagingDirectory).not.toHaveBeenCalled();
  });

  it.each([
    { signal: 'SIGINT' as const, expectedCode: 0, expectedSignal: null, cancellationMessage: true },
    { signal: 'SIGTERM' as const, expectedCode: null, expectedSignal: 'SIGTERM', cancellationMessage: false },
  ])(
    'handles $signal correctly at the full CLI prompt boundary',
    async ({ signal, expectedCode, expectedSignal, cancellationMessage }) => {
      const actualFs = await vi.importActual<typeof FsPromises>('node:fs/promises');
      const cwd = await actualFs.mkdtemp(path.join(os.tmpdir(), 'mastra-create-cancel-'));
      const cliEntry = fileURLToPath(new URL('../../index.ts', import.meta.url));
      const tsxLoader = import.meta.resolve('tsx');

      try {
        const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }>(
          (resolve, reject) => {
            const child = spawn(process.execPath, ['--import', tsxLoader, cliEntry, 'create'], {
              cwd,
              env: {
                ...process.env,
                FORCE_COLOR: '0',
                MASTRA_TELEMETRY_DISABLED: '1',
              },
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            let output = '';
            let interrupted = false;
            const timer = setTimeout(() => {
              child.kill('SIGKILL');
              reject(new Error(`Timed out waiting for create prompt. Output: ${output}`));
            }, 15_000);

            const onData = (chunk: Buffer) => {
              output += chunk.toString();
              if (!interrupted && output.includes('What do you want to name your project?')) {
                interrupted = true;
                child.kill(signal);
              }
            };
            child.stdout.on('data', onData);
            child.stderr.on('data', onData);
            child.on('error', error => {
              clearTimeout(timer);
              reject(error);
            });
            child.on('close', (code, closeSignal) => {
              clearTimeout(timer);
              resolve({ code, signal: closeSignal, output });
            });
          },
        );

        expect(result.code).toBe(expectedCode);
        expect(result.signal).toBe(expectedSignal);
        if (cancellationMessage) expect(result.output).toContain('Operation cancelled');
        else expect(result.output).not.toContain('Operation cancelled');
        expect(await actualFs.readdir(cwd)).toEqual([]);
      } finally {
        await actualFs.rm(cwd, { recursive: true, force: true });
      }
    },
    20_000,
  );
});

describe('GitHub template validation', () => {
  it('validates a public GitHub Mastra project after target preflight', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const prompts = await import('@clack/prompts');

    mockValidGitHubProject();

    await create({
      projectName: 'github-project',
      template: 'https://github.com/example/mastra-template',
    });

    expect(prompts.spinner).toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          githubUrl: 'https://github.com/example/mastra-template',
          title: 'example/mastra-template',
        }),
      }),
    );
  });

  it('normalizes a scheme-less canonical GitHub repository URL', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');
    mockValidGitHubProject();

    await create({ projectName: 'github-project', template: 'github.com/example/mastra-template' });

    expect(cloneTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({ githubUrl: 'https://github.com/example/mastra-template' }),
      }),
    );
  });

  it.each([
    'https://github.com/example/repo/tree/main',
    'https://github.com/example/repo?token=secret',
    'https://user:secret@github.com/example/repo',
  ])('rejects non-canonical GitHub URL %s before network or staging work', async template => {
    const { create } = await import('./create');
    const { loadTemplates } = await import('../../utils/template-utils');
    const { createOwnedStagingDirectory } = await import('./utils');

    await expect(create({ projectName: 'github-project', template })).rejects.toThrow('Invalid GitHub repository URL');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(createOwnedStagingDirectory).not.toHaveBeenCalled();
  });

  it('rejects GitHub repositories without a valid Mastra project', async () => {
    const { create } = await import('./create');
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);

    await expect(
      create({ projectName: 'github-project', template: 'https://github.com/example/invalid' }),
    ).rejects.toThrow('Invalid Mastra project');
  });
});
