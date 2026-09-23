import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MASTRA_PROJECTS_URL } from '../auth/client.js';
import * as credentials from '../auth/credentials.js';
import type { ProjectDatabase } from '../db/platform-api.js';

const {
  confirmMock,
  createProjectMock,
  createServerProjectMock,
  fetchEnvironmentsMock,
  fetchProjectsMock,
  fetchStudioProjectsMock,
  selectMock,
} = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  createProjectMock: vi.fn(),
  createServerProjectMock: vi.fn(),
  fetchEnvironmentsMock: vi.fn(),
  fetchProjectsMock: vi.fn(),
  fetchStudioProjectsMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  select: selectMock,
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
  log: { warn: vi.fn(), info: vi.fn(), step: vi.fn(), success: vi.fn() },
  S_BAR: '│',
}));

vi.mock('../env/platform-api.js', () => ({
  fetchEnvironments: fetchEnvironmentsMock,
  fetchProjects: fetchProjectsMock,
  createEnvironment: vi.fn(),
}));

vi.mock('../studio/platform-api.js', () => ({
  createProject: createProjectMock,
  fetchProjects: fetchStudioProjectsMock,
}));

vi.mock('../server/platform-api.js', () => ({
  createServerProject: createServerProjectMock,
}));

import {
  applyPlatformWorkersFlagGate,
  createDeployProject,
  unifiedDeployAction,
  deployBuildNeedsRefresh,
  lookupProjectFactoryFlag,
  resolveNonFactoryTarget,
  hasEnabledWorkers,
  hasWorkerManifestCheck,
  pollEnvironmentDeploy,
  renderDeploymentArchitecture,
  resolveEnvironment,
  resolveProject,
  resolveWorkersDeployMode,
  uploadToEnvironment,
  WorkersRedisRequirementError,
  zipOutput,
} from './index.js';

describe('project resolution', () => {
  beforeEach(() => {
    delete process.env.MASTRA_PROJECT_ID;
    fetchProjectsMock.mockReset();
  });

  afterEach(() => {
    delete process.env.MASTRA_PROJECT_ID;
  });

  it('resolves project metadata when MASTRA_PROJECT_ID selects the project', async () => {
    process.env.MASTRA_PROJECT_ID = 'project-1';
    fetchProjectsMock.mockResolvedValue([
      { id: 'project-1', name: 'Worker Factory', slug: 'worker-factory', organizationId: 'org-1' },
    ]);

    await expect(resolveProject('token', 'org-1', null)).resolves.toEqual({
      existing: true,
      projectId: 'project-1',
      projectName: 'Worker Factory',
      projectSlug: 'worker-factory',
    });
  });

  it('keeps the project ID fallback when metadata lookup fails', async () => {
    process.env.MASTRA_PROJECT_ID = 'project-1';
    fetchProjectsMock.mockRejectedValue(new Error('temporary API failure'));

    await expect(resolveProject('token', 'org-1', null)).resolves.toEqual({
      existing: true,
      projectId: 'project-1',
      projectName: 'project-1',
      projectSlug: 'project-1',
    });
  });
});

describe('deploy option validation', () => {
  it('rejects a --region other than us or eu before doing anything', async () => {
    await expect(unifiedDeployAction(undefined, { region: 'ap-southeast' })).rejects.toThrow(
      '--region must be "us" or "eu" (got "ap-southeast")',
    );
    await expect(unifiedDeployAction(undefined, { workers: 'sometimes' as never })).rejects.toThrow(
      '--workers must be "dedicated" or "in-process"',
    );
  });
});

describe('project creation', () => {
  beforeEach(() => {
    createProjectMock.mockReset();
    createServerProjectMock.mockReset();
  });

  it('creates non-factory projects through the studio endpoint', async () => {
    const project = { id: 'project-1', name: 'App', slug: 'app', organizationId: 'org-1' };
    createProjectMock.mockResolvedValue(project);

    await expect(createDeployProject('token', 'org-1', 'App', { region: 'eu' })).resolves.toEqual(project);

    expect(createProjectMock).toHaveBeenCalledWith('token', 'org-1', 'App');
    expect(createServerProjectMock).not.toHaveBeenCalled();
  });

  it('creates factory projects with the factory flag and region', async () => {
    const project = { id: 'project-1', name: 'Factory', slug: 'factory', organizationId: 'org-1' };
    createServerProjectMock.mockResolvedValue(project);

    await expect(
      createDeployProject('token', 'org-1', 'Factory', { projectType: 'factory', region: 'eu' }),
    ).resolves.toEqual(project);

    expect(createServerProjectMock).toHaveBeenCalledWith('token', 'org-1', 'Factory', {
      factoryEnabled: true,
      region: 'eu',
    });
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('omits an unsupported region when creating a factory project', async () => {
    createServerProjectMock.mockResolvedValue({ id: 'project-1', name: 'Factory', slug: null });

    await createDeployProject('token', 'org-1', 'Factory', { projectType: 'factory', region: 'ap-southeast' });

    expect(createServerProjectMock).toHaveBeenCalledWith('token', 'org-1', 'Factory', { factoryEnabled: true });
  });
});

describe('environment deploy upload', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    process.env.MASTRA_PLATFORM_API_URL = 'https://platform.example.com';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    delete process.env.MASTRA_PLATFORM_API_URL;
    vi.unstubAllGlobals();
  });

  it('enables project workers before uploading a dedicated workers deploy', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ workersEnabled: true }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ deploy: { id: 'deploy-1', uploadUrl: 'https://uploads.example.com/deploy-1' } }),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await uploadToEnvironment('token', 'org-1', 'project-1', 'environment-1', Buffer.from('zip'), {
      projectName: 'Worker App',
      dedicatedWorkersEnabled: true,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://platform.example.com/v1/projects/project-1/workers', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
        'x-organization-id': 'org-1',
      },
      body: JSON.stringify({ workersEnabled: true }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://platform.example.com/v1/projects/project-1/environments/environment-1/deploy',
      expect.any(Object),
    );
  });

  it('does not create the deploy when workers cannot be enabled', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'workers setting unavailable' }), {
        status: 503,
        statusText: 'Unavailable',
      }),
    );

    await expect(
      uploadToEnvironment('token', 'org-1', 'project-1', 'environment-1', Buffer.from('zip'), {
        projectName: 'Worker App',
        dedicatedWorkersEnabled: true,
      }),
    ).rejects.toThrow('Failed to enable dedicated workers: workers setting unavailable');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not change the project workers flag for an in-process deploy', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ deploy: { id: 'deploy-1', uploadUrl: 'https://uploads.example.com/deploy-1' } }),
          {
            status: 200,
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await uploadToEnvironment('token', 'org-1', 'project-1', 'environment-1', Buffer.from('zip'), {
      projectName: 'Worker App',
      dedicatedWorkersEnabled: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).not.toHaveBeenCalledWith(
      'https://platform.example.com/v1/projects/project-1/workers',
      expect.anything(),
    );
  });
});

describe('factory target lookup', () => {
  beforeEach(() => {
    fetchStudioProjectsMock.mockReset();
  });

  it('reports whether the selected project was created as a factory project', async () => {
    fetchStudioProjectsMock.mockResolvedValue([
      { id: 'project-1', name: 'Plain', slug: 'plain', factoryEnabled: false },
      { id: 'project-2', name: 'Factory', slug: 'factory', factoryEnabled: true },
    ]);

    await expect(lookupProjectFactoryFlag('token', 'org-1', 'project-1')).resolves.toBe(false);
    await expect(lookupProjectFactoryFlag('token', 'org-1', 'project-2')).resolves.toBe(true);
  });

  it('is undefined when the flag is missing, the project is unknown, or the lookup fails', async () => {
    fetchStudioProjectsMock.mockResolvedValue([{ id: 'project-1', name: 'Legacy', slug: 'legacy' }]);
    await expect(lookupProjectFactoryFlag('token', 'org-1', 'project-1')).resolves.toBeUndefined();
    await expect(lookupProjectFactoryFlag('token', 'org-1', 'project-9')).resolves.toBeUndefined();

    fetchStudioProjectsMock.mockRejectedValue(new Error('temporary API failure'));
    await expect(lookupProjectFactoryFlag('token', 'org-1', 'project-1')).resolves.toBeUndefined();
  });
});

describe('non-factory target choice', () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it('offers a replacement Factory project and returns the choice', async () => {
    selectMock.mockResolvedValue('create');

    await expect(
      resolveNonFactoryTarget({ projectName: 'primordial-goo', newProjectName: 'primordial-goo', autoAccept: false }),
    ).resolves.toBe('create');

    const prompt = selectMock.mock.calls[0]![0] as {
      message: string;
      options: Array<{ value: string; label: string }>;
    };
    expect(prompt.message).toContain('was created without Factory support');
    expect(prompt.message).toContain('How do you want to continue?');
    const options = prompt.options;
    expect(options.map(option => option.value)).toEqual(['create', 'deploy', 'cancel']);
    expect(options[0]!.label).toContain('Create a new Factory project "primordial-goo"');
  });

  it('omits the create option when no project name is available', async () => {
    selectMock.mockResolvedValue('deploy');

    await expect(
      resolveNonFactoryTarget({ projectName: 'primordial-goo', newProjectName: null, autoAccept: false }),
    ).resolves.toBe('deploy');

    const options = selectMock.mock.calls[0]![0].options as Array<{ value: string }>;
    expect(options.map(option => option.value)).toEqual(['deploy', 'cancel']);
  });

  it('keeps the requested target without prompting under --yes', async () => {
    await expect(
      resolveNonFactoryTarget({ projectName: 'primordial-goo', newProjectName: 'primordial-goo', autoAccept: true }),
    ).resolves.toBe('deploy');

    expect(selectMock).not.toHaveBeenCalled();
  });
});

describe('environment resolution', () => {
  beforeEach(() => {
    confirmMock.mockReset().mockResolvedValue(true);
    fetchEnvironmentsMock.mockReset().mockResolvedValue([]);
    selectMock.mockReset().mockResolvedValue('eu');
  });

  it('prompts for a region when the requested environment must be created', async () => {
    await expect(resolveEnvironment('token', 'org-1', 'project-1', 'preview', false)).resolves.toEqual({
      existing: false,
      name: 'preview',
      type: 'preview',
      region: 'eu',
    });

    expect(selectMock).toHaveBeenCalledWith({
      message: 'Select a deployment region',
      initialValue: 'us',
      options: [
        { value: 'us', label: 'United States' },
        { value: 'eu', label: 'Europe' },
      ],
    });
  });

  it('uses an explicitly requested region without prompting', async () => {
    await expect(resolveEnvironment('token', 'org-1', 'project-1', 'production', false, 'eu')).resolves.toEqual({
      existing: false,
      name: 'production',
      type: 'production',
      region: 'eu',
    });

    expect(selectMock).not.toHaveBeenCalled();
  });

  it('keeps non-interactive environment creation prompt-free', async () => {
    await expect(resolveEnvironment('token', 'org-1', 'project-1', 'production', true)).resolves.toEqual({
      existing: false,
      name: 'production',
      type: 'production',
    });

    expect(selectMock).not.toHaveBeenCalled();
  });
});

describe('deploy artifact', () => {
  let projectDir: string;
  let outputDir: string;
  let zipPath: string | undefined;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mastra-zip-output-test-'));
    outputDir = join(projectDir, '.mastra', 'output');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'package.json'), JSON.stringify({ name: 'test-output' }));
    writeFileSync(join(outputDir, 'index.mjs'), 'export {};');
    writeFileSync(join(outputDir, 'workers.json'), JSON.stringify({ version: 1, orchestration: { enabled: true } }));
    writeFileSync(join(outputDir, 'worker-manifest.mjs'), 'throw new Error("build-only");');
    writeFileSync(join(outputDir, 'worker-manifest.mjs.map'), '{}');
    writeFileSync(join(outputDir, 'workers-config.mjs'), 'export const workers = [];');
    writeFileSync(join(outputDir, 'workers-config.mjs.map'), '{}');
    writeFileSync(join(outputDir, '.npmrc'), '//npm.pkg.github.com/:_authToken=${NPM_TOKEN}');
    mkdirSync(join(outputDir, 'node_modules', 'somedep'), { recursive: true });
    writeFileSync(join(outputDir, 'node_modules', 'somedep', 'index.js'), 'x');
    mkdirSync(join(outputDir, 'node_modules', '.bin'), { recursive: true });
    writeFileSync(join(outputDir, 'node_modules', '.bin', 'tool'), '#!/bin/sh');
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    if (zipPath) rmSync(zipPath, { force: true });
  });

  it('includes .npmrc so private-registry installs work in the remote build', async () => {
    zipPath = await zipOutput(projectDir);

    // Zip entry names are stored verbatim in the archive, so a raw scan is enough.
    const zip = readFileSync(zipPath, 'latin1');
    expect(zip).toContain('output/.npmrc');
    expect(zip).toContain('output/package.json');
    expect(zip).toContain('output/index.mjs');
    expect(zip).toContain('output/workers.json');
    expect(zip).not.toContain('worker-manifest.mjs');
    expect(zip).not.toContain('workers-config.mjs');
    expect(zip).not.toContain('node_modules');
    expect(zip).not.toContain('.bin');
  });

  it('omits workers.json from an in-process deploy without deleting reusable build metadata', async () => {
    zipPath = await zipOutput(projectDir, { includeWorkersManifest: false });

    const zip = readFileSync(zipPath, 'latin1');
    expect(zip).not.toContain('output/workers.json');
    expect(readFileSync(join(outputDir, 'workers.json'), 'utf-8')).toContain('orchestration');
  });

  it('refreshes an otherwise-current build when deploy metadata has not been checked', () => {
    expect(deployBuildNeedsRefresh({ isStale: false }, false, false)).toBe(true);
  });

  it('does not repeatedly refresh a current build after a deployer emitted no worker metadata', () => {
    expect(deployBuildNeedsRefresh({ isStale: false }, false, true)).toBe(false);
  });

  it('does not refresh a current build when deploy metadata exists', () => {
    expect(deployBuildNeedsRefresh({ isStale: false }, true, false)).toBe(false);
  });

  it('invalidates the legacy empty metadata marker so a deleted workers manifest is rebuilt once', async () => {
    const markerPath = join(projectDir, '.mastra', 'worker-manifest-checked');
    writeFileSync(markerPath, '');
    await expect(hasWorkerManifestCheck(projectDir)).resolves.toBe(false);

    writeFileSync(markerPath, '2');
    await expect(hasWorkerManifestCheck(projectDir)).resolves.toBe(true);
  });

  it.each([
    [
      'a versioned manifest',
      {
        version: 1,
        orchestration: { enabled: true },
        scheduler: { enabled: false },
        backgroundTasks: { enabled: false },
        custom: [],
      },
    ],
    ['a legacy manifest', { enabled: true }],
  ])('detects an enabled workers service from %s', async (_label, manifest) => {
    writeFileSync(join(outputDir, 'workers.json'), JSON.stringify(manifest));

    await expect(hasEnabledWorkers(projectDir)).resolves.toBe(true);
  });

  it.each([
    ['an absent manifest', undefined],
    ['a null manifest', null],
    ['a disabled legacy manifest', { enabled: false }],
    [
      'a disabled versioned manifest',
      {
        version: 1,
        orchestration: { enabled: false },
        scheduler: { enabled: false },
        backgroundTasks: { enabled: false },
        custom: [],
      },
    ],
  ])('does not report workers for %s', async (_label, manifest) => {
    if (manifest !== undefined) {
      writeFileSync(join(outputDir, 'workers.json'), JSON.stringify(manifest));
    }

    await expect(hasEnabledWorkers(projectDir)).resolves.toBe(false);
  });

  it('renders a colored deployment overview with metadata before the architecture', () => {
    const database = {
      id: 'db_1',
      platformProjectId: 'project_1',
      organizationId: 'org_1',
      environmentId: 'env_1',
      kind: 'neon',
      name: 'production-primary-postgres',
      status: 'ready',
      region: 'aws-us-west-2',
      providerResourceId: 'neon_1',
      error: null,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z',
      deletedAt: null,
    } satisfies ProjectDatabase;
    const sharedRedis = {
      ...database,
      id: 'db_2',
      environmentId: null,
      kind: 'redis',
      name: 'shared-redis',
      status: 'provisioning',
      providerResourceId: null,
    } satisfies ProjectDatabase;
    const stagingDatabase = {
      ...database,
      id: 'db_3',
      environmentId: 'env_2',
      name: 'staging-pg',
    } satisfies ProjectDatabase;

    const renderedAt = new Date('2026-08-26T16:30:00.000Z');
    const input = {
      projectName: 'My Agent',
      environment: { id: 'env_1', name: 'production', region: 'us-west' },
      serverLabel: 'Server',
      workersEnabled: true,
      workersConfig: {
        version: 1,
        orchestration: { enabled: true },
        scheduler: { enabled: true, tickIntervalMs: 10_000 },
        backgroundTasks: { enabled: false, mode: 'full', globalConcurrency: 10 },
        custom: ['platform-github-events', 'platform-linear-events'],
      },
      databases: [database, sharedRedis, stagingDatabase],
      observabilityEnabled: true,
      renderedAt,
    };
    const diagram = renderDeploymentArchitecture(input, pc.createColors(false));

    expect(diagram).toContain('Studio');
    expect(diagram).toContain('Server');
    expect(diagram).toContain('Workers');
    expect(diagram).toContain('production');
    expect(diagram).not.toContain('Data store');
    expect(diagram).toContain('production-primary-postgres');
    expect(diagram).toContain('shared-redis');
    expect(diagram).toContain('Observability');
    expect(diagram).toContain('───┼───');
    const formattedRenderedAt = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(renderedAt);
    const panelLines = diagram.split('\n').map(line => line.split('│')[0].trimEnd());
    expect(panelLines.slice(0, 3)).toEqual(['My Agent', 'production (US West)', formattedRenderedAt]);
    expect(diagram).toContain('Workers Config');
    expect(diagram).toContain('Static analysis only; runtime workers may differ.');
    expect(diagram).toContain('● Orchestration');
    expect(diagram).toContain('● Scheduler');
    expect(diagram).toContain('    Tick Interval: 10 seconds');
    expect(diagram).toContain('● Background Tasks');
    expect(diagram).toContain('    Mode: Full');
    expect(diagram).toContain('    Global Concurrency: 10');
    expect(diagram).toContain('● Custom');
    expect(diagram).toContain('    platform-github-events');
    expect(diagram).toContain('    platform-linear-events');
    expect(diagram).not.toContain('https://my-agent-production.studio.mastra.cloud');
    expect(diagram).not.toContain('https://my-agent-production.server.mastra.cloud');
    expect(diagram).not.toContain('staging-pg');
    expect(diagram).not.toMatch(/\[[A-Z]+\]/);
    expect(diagram).not.toContain('🇺🇸');
    expect(diagram).not.toContain('🇪🇺');
    expect(diagram).not.toContain('* * * * * *');

    const colors = pc.createColors(true);
    const coloredDiagram = renderDeploymentArchitecture(input, colors);
    const boxTop = `┌${'─'.repeat(30)}┐`;
    expect(coloredDiagram).toContain(colors.blue(boxTop));
    expect(coloredDiagram).toContain(colors.magenta(boxTop));
    expect(coloredDiagram).toContain(colors.yellow(boxTop));
    expect(coloredDiagram).toContain(colors.green(boxTop));
    expect(coloredDiagram).toContain(colors.red(boxTop));
    expect(coloredDiagram).toContain(colors.bold('My Agent'));
    expect(coloredDiagram).toContain(colors.bold('production (US West)'));
    expect(coloredDiagram).toContain(colors.dim(formattedRenderedAt));
    expect(coloredDiagram).toContain(colors.bold('Workers Config'));
    expect(coloredDiagram).toContain(`${colors.green('●')} ${colors.bold(colors.white('Orchestration'))}`);
    expect(coloredDiagram).toContain(`${colors.gray('●')} ${colors.gray('Background Tasks')}`);
    expect(coloredDiagram).toContain(`    ${colors.dim('Mode')}: ${colors.gray('Full')}`);
    expect(coloredDiagram).toContain(`    ${colors.dim('Global Concurrency')}: ${colors.gray('10')}`);
    expect(coloredDiagram).toContain(`${colors.green('●')} ${colors.bold(colors.white('Custom'))}`);
  });

  it('omits every Workers Config line when the rollout flag is disabled, even with a built manifest', () => {
    const diagram = renderDeploymentArchitecture(
      {
        projectName: 'My Agent',
        environment: { id: 'env_1', name: 'production', region: 'pdx' },
        serverLabel: 'Server',
        workersEnabled: false,
        workersConfig: {
          version: 1,
          orchestration: { enabled: true },
          scheduler: { enabled: false },
          backgroundTasks: { enabled: true, mode: 'full' },
          custom: [],
        },
        showWorkersConfig: false,
        databases: [],
        observabilityEnabled: true,
        renderedAt: new Date('2026-08-27T16:30:00.000Z'),
      },
      pc.createColors(false),
    );

    expect(diagram).not.toContain('Workers Config');
    expect(diagram).not.toContain('Static analysis only; runtime workers may differ.');
    expect(diagram).not.toContain('Status: Disabled');
  });

  it('renders the Factory card with an orange outline', () => {
    const colors = pc.createColors(true);
    const diagram = renderDeploymentArchitecture(
      {
        projectName: 'Worker Factory',
        environment: { id: 'env_1', name: 'production', region: 'pdx' },
        serverLabel: 'Factory',
        workersEnabled: false,
        workersConfig: null,
        databases: [],
        observabilityEnabled: true,
        renderedAt: new Date('2026-08-27T16:30:00.000Z'),
      },
      colors,
    );
    const boxTop = `┌${'─'.repeat(30)}┐`;

    expect(diagram).toContain(`\u001B[38;5;214m${boxTop}\u001B[39m`);
    expect(diagram).not.toContain(colors.yellow(boxTop));
  });

  it.each([
    [null, 'United States', 'US West'],
    ['pdx', 'United States', 'US West'],
    ['iad', 'United States', 'US East'],
    ['sfo', 'United States', 'US West (SF)'],
    ['ams', 'Europe', 'EU West'],
    ['eu', 'Europe', 'EU West'],
  ])(
    'shows the deployment location and region label instead of the Railway region for %s',
    (region, expectedLocation, expectedRegionLabel) => {
      const input = {
        projectName: 'My Agent',
        environment: { id: 'env_1', name: 'production', region },
        serverLabel: 'Server',
        workersEnabled: false,
        workersConfig: null,
        databases: [],
        observabilityEnabled: true,
        renderedAt: new Date('2026-08-26T16:30:00.000Z'),
      };
      const colors = pc.createColors(true);
      const diagram = renderDeploymentArchitecture(input, colors);
      const boxTop = `┌${'─'.repeat(30)}┐`;

      expect(diagram).toContain(expectedLocation);
      expect(diagram).toContain(`production (${expectedRegionLabel})`);
      if (region) expect(diagram).not.toContain(region);
      expect(diagram).toContain(colors.green(boxTop));
    },
  );
});

describe('applyPlatformWorkersFlagGate', () => {
  let projectDir: string;
  let manifestPath: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), 'mastra-workers-gate-test-'));
    const outputDir = join(projectDir, '.mastra', 'output');
    mkdirSync(outputDir, { recursive: true });
    manifestPath = join(outputDir, 'workers.json');
    writeFileSync(
      manifestPath,
      JSON.stringify({
        version: 1,
        orchestration: { enabled: true },
        scheduler: { enabled: false },
        backgroundTasks: { enabled: false },
        custom: [],
      }),
    );
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it('preserves the manifest when the flag is on, evaluated as the authenticated user', async () => {
    const analytics = { isFeatureEnabled: vi.fn().mockResolvedValue(true) };

    await expect(
      applyPlatformWorkersFlagGate({
        orgId: 'org-1',
        userId: 'user_123',
        analytics,
      }),
    ).resolves.toBe('preserved');

    expect(analytics.isFeatureEnabled).toHaveBeenCalledWith('platform-workers', {
      distinctId: 'user_123',
      groups: { organization: 'org-1' },
    });
    expect(readFileSync(manifestPath, 'utf-8')).toContain('orchestration');
  });

  it('falls back to organization targeting and preserves reusable build metadata when the flag is off', async () => {
    const analytics = { isFeatureEnabled: vi.fn().mockResolvedValue(false) };

    await expect(applyPlatformWorkersFlagGate({ orgId: 'org-1', analytics })).resolves.toBe('suppressed');

    expect(analytics.isFeatureEnabled).toHaveBeenCalledWith('platform-workers', {
      groups: { organization: 'org-1' },
    });
    expect(readFileSync(manifestPath, 'utf-8')).toContain('orchestration');
  });

  it('can enable workers on a later deploy after an earlier flag-off deploy', async () => {
    const analytics = { isFeatureEnabled: vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true) };

    await expect(applyPlatformWorkersFlagGate({ orgId: 'org-1', analytics })).resolves.toBe('suppressed');
    await expect(hasEnabledWorkers(projectDir)).resolves.toBe(true);
    await expect(applyPlatformWorkersFlagGate({ orgId: 'org-1', analytics })).resolves.toBe('preserved');
    await expect(hasEnabledWorkers(projectDir)).resolves.toBe(true);
  });

  it('fails closed without deleting build metadata when telemetry is disabled', async () => {
    await expect(applyPlatformWorkersFlagGate({ orgId: 'org-1', analytics: null })).resolves.toBe('suppressed');

    expect(readFileSync(manifestPath, 'utf-8')).toContain('orchestration');
  });
});

describe('resolveWorkersDeployMode', () => {
  const CANCEL_SYMBOL = Symbol('cancel');
  const isCancel = (value: unknown): value is symbol => value === CANCEL_SYMBOL;

  const base = {
    workersEnabled: true,
    redisRequirementMet: true,
    environmentHasWorkerService: false,
    workersOption: undefined,
    autoAccept: false,
    isCancel,
  };

  it('respects an explicit --workers=in-process flag without prompting', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, workersOption: 'in-process', promptConfirm });
    expect(mode).toBe('in-process');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('respects an explicit --workers=dedicated flag without prompting', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, workersOption: 'dedicated', promptConfirm });
    expect(mode).toBe('dedicated');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('errors on --workers=dedicated when the Redis requirement is not met', async () => {
    const promptConfirm = vi.fn();
    await expect(
      resolveWorkersDeployMode({ ...base, workersOption: 'dedicated', redisRequirementMet: false, promptConfirm }),
    ).rejects.toBeInstanceOf(WorkersRedisRequirementError);
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('degrades to in-process without prompting when the Redis requirement is not met', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, redisRequirementMet: false, promptConfirm });
    expect(mode).toBe('in-process');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('degrades to in-process on missing Redis even when the environment has a workers service', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({
      ...base,
      redisRequirementMet: false,
      environmentHasWorkerService: true,
      promptConfirm,
    });
    expect(mode).toBe('in-process');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('stays dedicated when the environment already has a workers service', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, environmentHasWorkerService: true, promptConfirm });
    expect(mode).toBe('dedicated');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('does not prompt when no workers are configured', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, workersEnabled: false, promptConfirm });
    expect(mode).toBe('in-process');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('--workers=in-process wins even when the environment has a workers service', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({
      ...base,
      workersOption: 'in-process',
      environmentHasWorkerService: true,
      promptConfirm,
    });
    expect(mode).toBe('in-process');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('defaults to dedicated in non-interactive / --yes runs', async () => {
    const promptConfirm = vi.fn();
    const mode = await resolveWorkersDeployMode({ ...base, autoAccept: true, promptConfirm });
    expect(mode).toBe('dedicated');
    expect(promptConfirm).not.toHaveBeenCalled();
  });

  it('prompts and returns in-process when the user opts out', async () => {
    const promptConfirm = vi.fn().mockResolvedValue(false);
    const mode = await resolveWorkersDeployMode({ ...base, promptConfirm });
    expect(mode).toBe('in-process');
    expect(promptConfirm).toHaveBeenCalledTimes(1);
  });

  it('prompts and returns dedicated when the user confirms', async () => {
    const promptConfirm = vi.fn().mockResolvedValue(true);
    const mode = await resolveWorkersDeployMode({ ...base, promptConfirm });
    expect(mode).toBe('dedicated');
  });

  it('treats a cancelled prompt as the safe default (dedicated)', async () => {
    const promptConfirm = vi.fn().mockResolvedValue(CANCEL_SYMBOL);
    const mode = await resolveWorkersDeployMode({ ...base, promptConfirm });
    expect(mode).toBe('dedicated');
  });
});

describe('pollEnvironmentDeploy', () => {
  const statusResponse = (status: string) =>
    new Response(JSON.stringify({ deploy: { id: 'dep-1', status } }), { status: 200 });
  const errorResponse = (status: number, statusText: string) =>
    new Response(null, { status, statusText, headers: { 'content-type': 'text/plain' } });

  let fetchMock: ReturnType<typeof vi.fn>;
  let statusResponses: Array<() => Response | Promise<Response>>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(p.log.warn).mockClear();
    vi.mocked(p.log.info).mockClear();
    vi.spyOn(credentials, 'getToken').mockResolvedValue('refreshed-token');
    statusResponses = [];
    fetchMock = vi.fn(async (url: string) => {
      // The log stream is fetched in parallel; a non-ok response makes it exit quietly.
      if (url.endsWith('/logs/stream')) return errorResponse(404, 'Not Found');
      const next = statusResponses.shift();
      if (!next) throw new Error('unexpected extra poll');
      return next();
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const run = (maxWaitMs?: number) => pollEnvironmentDeploy('tok', 'org-1', 'proj-1', 'env-1', 'dep-1', maxWaitMs);
  const pollCount = () => fetchMock.mock.calls.filter(([url]) => !url.endsWith('/logs/stream')).length;

  it('retries a transient gateway timeout instead of aborting the wait', async () => {
    statusResponses.push(
      () => statusResponse('building'),
      () => errorResponse(504, 'Gateway Timeout'),
      () => errorResponse(502, 'Bad Gateway'),
      () => statusResponse('running'),
    );

    const promise = run();
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(promise).resolves.toMatchObject({ status: 'running' });
  });

  it('announces the first retry, rate-limits reminders and reports recovery once', async () => {
    statusResponses.push(
      ...Array.from({ length: 6 }, () => () => errorResponse(504, 'Gateway Timeout')),
      () => statusResponse('building'),
      () => statusResponse('running'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(0);
    expect(p.log.warn).toHaveBeenCalledExactlyOnceWith(
      'Unable to check deployment status. Retrying in 2s; deployment may still be running.',
    );
    await vi.advanceTimersByTimeAsync(29_999);
    expect(p.log.warn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.log.warn).toHaveBeenLastCalledWith(
      'Still unable to check deployment status. Retrying in 30s; deployment may still be running.',
    );
    expect(p.log.warn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(p.log.warn).toHaveBeenCalledTimes(3);
    expect(p.log.info).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(32_000);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(p.log.info).toHaveBeenCalledExactlyOnceWith('Deployment status checks resumed.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not report recovery when retrying ends at the deadline', async () => {
    statusResponses.push(() => errorResponse(504, 'Gateway Timeout'));
    const assertion = expect(run(1000)).rejects.toThrow('Status polling timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(p.log.warn).toHaveBeenCalledExactlyOnceWith(
      'Unable to check deployment status. No time remains for another retry; deployment may still be running.',
    );
    expect(p.log.info).not.toHaveBeenCalled();
    expect(pollCount()).toBe(1);
  });

  it('does not treat a 401 during retries as recovery', async () => {
    statusResponses.push(
      () => errorResponse(504, 'Gateway Timeout'),
      () => errorResponse(401, 'Unauthorized'),
      () => statusResponse('failed'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(2000);
    expect(p.log.info).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toMatchObject({ status: 'failed' });
    expect(p.log.info).toHaveBeenCalledExactlyOnceWith('Deployment status checks resumed.');
  });

  it('retries a network error instead of aborting the wait', async () => {
    statusResponses.push(
      () => {
        throw new TypeError('fetch failed');
      },
      () => statusResponse('running'),
    );

    const promise = run();
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(promise).resolves.toMatchObject({ status: 'running' });
  });

  it('backs off mixed failures until the deadline and explains the unknown outcome', async () => {
    for (let i = 0; i < 6; i++) {
      statusResponses.push(() => {
        if (i % 2 === 0) throw new TypeError('fetch failed');
        return errorResponse(504, 'Gateway Timeout');
      });
    }
    const promise = run(61_000);
    const assertion = expect(promise).rejects.toThrow(
      'Unable to confirm deployment status; deployment may still be running. ' +
        'Status polling timed out: Poll failed: Gateway Timeout\n' +
        `Check deployment dep-1: ${MASTRA_PROJECTS_URL}/orgs/org-1/projects/proj-1/deploys/dep-1`,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(pollCount()).toBe(1);
    for (const [index, delay] of [2000, 4000, 8000, 16000, 30000].entries()) {
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(pollCount()).toBe(index + 1);
      await vi.advanceTimersByTimeAsync(1);
      expect(pollCount()).toBe(index + 2);
    }
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(pollCount()).toBe(6);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('resets backoff after a successful non-terminal poll', async () => {
    statusResponses.push(
      () => errorResponse(503, 'Unavailable'),
      () => errorResponse(503, 'Unavailable'),
      () => statusResponse('building'),
      () => errorResponse(503, 'Unavailable'),
      () => statusResponse('running'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(8000);
    expect(pollCount()).toBe(4);
    await vi.advanceTimersByTimeAsync(1999);
    expect(pollCount()).toBe(4);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(pollCount()).toBe(5);
    expect(p.log.warn).toHaveBeenCalledTimes(1);
    expect(p.log.info).toHaveBeenCalledTimes(1);
  });

  it('keeps the notice cooldown across flapping connections', async () => {
    for (let i = 0; i < 9; i++) {
      statusResponses.push(
        () => errorResponse(504, 'Gateway Timeout'),
        () => statusResponse('building'),
      );
    }
    statusResponses.push(() => statusResponse('running'));
    const promise = run();
    await vi.advanceTimersByTimeAsync(31_999);
    expect(p.log.warn).toHaveBeenCalledTimes(1);
    expect(p.log.info).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(p.log.warn).toHaveBeenCalledTimes(2);
    expect(p.log.warn).toHaveBeenLastCalledWith(
      'Unable to check deployment status. Retrying in 2s; deployment may still be running.',
    );
    await vi.advanceTimersByTimeAsync(4000);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(p.log.info).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['ENETUNREACH', 'EHOSTUNREACH'])('recovers from %s', async code => {
    statusResponses.push(
      () => {
        throw new TypeError('fetch failed', { cause: { code } });
      },
      () => statusResponse('running'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(pollCount()).toBe(2);
  });

  it('retries a dropped response body', async () => {
    statusResponses.push(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new TypeError('terminated', { cause: { code: 'UND_ERR_SOCKET' } }));
            },
          }),
        ),
      () => statusResponse('running'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(pollCount()).toBe(2);
  });

  it.each(['headers', 'body'])('aborts a stalled %s read at the deadline', async phase => {
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/logs/stream')) return errorResponse(404, 'Not Found');
      if (phase === 'headers') {
        return new Promise<Response>((_, reject) => {
          options.signal!.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
        });
      }
      return new Response(
        new ReadableStream({
          start(controller) {
            options.signal!.addEventListener('abort', () => controller.error(new Error('body aborted')), {
              once: true,
            });
          },
        }),
      );
    });
    const promise = run(1000);
    const assertion = expect(promise).rejects.toThrow('Status polling timed out');
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(pollCount()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retries a request timeout when polling time remains', async () => {
    let attempts = 0;
    fetchMock.mockImplementation(async (url: string, options: RequestInit) => {
      if (url.endsWith('/logs/stream')) return errorResponse(404, 'Not Found');
      if (++attempts > 1) return statusResponse('running');
      return new Promise<Response>((_, reject) => {
        options.signal!.addEventListener('abort', () => reject(new Error('request aborted')), { once: true });
      });
    });
    const promise = run(60_000);
    await vi.advanceTimersByTimeAsync(31_999);
    expect(pollCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(pollCount()).toBe(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not retry malformed JSON as a transport failure', async () => {
    statusResponses.push(
      () => new Response('invalid json'),
      () => statusResponse('running'),
    );
    await expect(run()).rejects.toThrow('Unable to confirm deployment status');
    expect(pollCount()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('times out while deployment remains non-terminal without claiming deployment failure', async () => {
    statusResponses.push(() => statusResponse('building'));
    const assertion = expect(run(1000)).rejects.toThrow(
      'Unable to confirm deployment status; deployment may still be running. Status polling timed out',
    );
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(pollCount()).toBe(1);
  });

  it.each(['running', 'failed', 'stopped'])('returns an actual %s deployment without retrying', async status => {
    statusResponses.push(() => statusResponse(status));
    await expect(run()).resolves.toMatchObject({ status });
    expect(pollCount()).toBe(1);
    expect(p.log.warn).not.toHaveBeenCalled();
    expect(p.log.info).not.toHaveBeenCalled();
  });

  it('recovers from a 401 using the refreshed token', async () => {
    statusResponses.push(
      () => errorResponse(401, 'Unauthorized'),
      () => statusResponse('running'),
    );
    const promise = run();
    await vi.advanceTimersByTimeAsync(0);
    expect(credentials.getToken).toHaveBeenCalledWith(expect.any(AbortSignal));
    await vi.advanceTimersByTimeAsync(1999);
    expect(pollCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toMatchObject({ status: 'running' });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.not.stringContaining('/logs/stream'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer refreshed-token', 'x-organization-id': 'org-1' },
      }),
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels pending authentication at the polling deadline', async () => {
    statusResponses.push(() => errorResponse(401, 'Unauthorized'));
    vi.mocked(credentials.getToken).mockImplementation(
      signal =>
        new Promise((_, reject) => {
          signal?.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );
    const promise = run(1000);
    const assertion = expect(promise).rejects.toThrow('Status polling timed out');
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(credentials.getToken).toHaveBeenCalledWith(expect.objectContaining({ aborted: true }));
    expect(pollCount()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['ERR_INVALID_URL', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT'])(
    'fails immediately on permanent fetch error %s',
    async code => {
      const error = new TypeError('fetch failed', { cause: { code } });
      statusResponses.push(
        () => {
          throw error;
        },
        () => statusResponse('running'),
      );
      await expect(run()).rejects.toMatchObject({ cause: error });
      expect(pollCount()).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('fails immediately on a non-transient client error', async () => {
    statusResponses.push(
      () => new Response(JSON.stringify({ detail: 'Deploy not found' }), { status: 404, statusText: 'Not Found' }),
      () => statusResponse('running'),
    );

    const promise = run();
    const assertion = expect(promise).rejects.toThrow('Poll failed: Deploy not found');
    await vi.advanceTimersByTimeAsync(60_000);

    await assertion;
    expect(statusResponses).toHaveLength(1);
  });
});
