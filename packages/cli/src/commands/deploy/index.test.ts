import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectDatabase } from '../db/platform-api.js';

const { confirmMock, fetchEnvironmentsMock, fetchProjectsMock, selectMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  fetchEnvironmentsMock: vi.fn(),
  fetchProjectsMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('@clack/prompts', () => ({
  confirm: confirmMock,
  select: selectMock,
  isCancel: vi.fn(() => false),
  cancel: vi.fn(),
}));

vi.mock('../env/platform-api.js', () => ({
  fetchEnvironments: fetchEnvironmentsMock,
  fetchProjects: fetchProjectsMock,
  createEnvironment: vi.fn(),
}));

import {
  deployBuildNeedsRefresh,
  hasEnabledWorkers,
  renderDeploymentArchitecture,
  resolveEnvironment,
  resolveProject,
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
    expect(zip).not.toContain('node_modules');
    expect(zip).not.toContain('.bin');
  });

  it('refreshes an otherwise-current build when deploy metadata is missing', () => {
    expect(deployBuildNeedsRefresh({ isStale: false }, false)).toBe(true);
  });

  it('does not refresh a current build when deploy metadata exists', () => {
    expect(deployBuildNeedsRefresh({ isStale: false }, true)).toBe(false);
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
