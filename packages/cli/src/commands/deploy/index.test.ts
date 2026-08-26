import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectDatabase } from '../db/platform-api.js';

const { confirmMock, fetchEnvironmentsMock, selectMock } = vi.hoisted(() => ({
  confirmMock: vi.fn(),
  fetchEnvironmentsMock: vi.fn(),
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
  createEnvironment: vi.fn(),
}));

import {
  deployBuildNeedsRefresh,
  hasEnabledWorkers,
  renderDeploymentArchitecture,
  resolveEnvironment,
  zipOutput,
} from './index.js';

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

  it('detects an enabled workers service', async () => {
    writeFileSync(join(outputDir, 'workers.json'), JSON.stringify({ enabled: true }));

    await expect(hasEnabledWorkers(projectDir)).resolves.toBe(true);
  });

  it.each([
    ['an absent manifest', undefined],
    ['a null manifest', null],
    ['a disabled manifest', { enabled: false }],
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
      workersConfig: { enabled: true, mode: 'full', globalConcurrency: 10 },
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
    expect(diagram).toContain('My Agent');
    expect(diagram).toContain(
      `production (US West) · ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(renderedAt)}`,
    );
    expect(diagram).toContain('Workers Config');
    expect(diagram).not.toContain('• Enabled: true');
    expect(diagram).toContain('• Mode: full');
    expect(diagram).toContain('• Global Concurrency: 10');
    expect(diagram).not.toContain('https://my-agent-production.studio.mastra.cloud');
    expect(diagram).not.toContain('https://my-agent-production.server.mastra.cloud');
    expect(diagram).not.toContain('staging-pg');
    expect(diagram.split('\n')[0]).toMatch(/^\* \* \* \* \* \* .* │  ┌/);
    expect(diagram).not.toMatch(/\[[A-Z]+\]/);
    expect(diagram).not.toContain('🇺🇸');
    expect(diagram).not.toContain('🇪🇺');
    expect(diagram).toContain('* * * * * *');
    expect(diagram).not.toContain('★');
    expect(diagram).not.toContain('█');

    const colors = pc.createColors(true);
    const coloredDiagram = renderDeploymentArchitecture(input, colors);
    const boxTop = `┌${'─'.repeat(30)}┐`;
    expect(coloredDiagram).toContain(colors.blue(boxTop));
    expect(coloredDiagram).toContain(colors.magenta(boxTop));
    expect(coloredDiagram).toContain(colors.yellow(boxTop));
    expect(coloredDiagram).toContain(colors.green(boxTop));
    expect(coloredDiagram).toContain(colors.red(boxTop));
    expect(coloredDiagram).toContain('\u001B[48;2;10;49;97m');
    expect(coloredDiagram).toContain('\u001B[48;2;179;25;66m');
    expect(coloredDiagram).toContain('\u001B[48;2;255;255;255m');
    expect(coloredDiagram).toContain('\u001B[38;2;255;255;255m* * * * * * \u001B[39m');
    expect(coloredDiagram).toContain(`\u001B[48;2;179;25;66m${' '.repeat(18)}\u001B[49m`);
    expect(coloredDiagram).toContain(`\u001B[48;2;255;255;255m${' '.repeat(30)}\u001B[49m`);
    expect(coloredDiagram).toContain(colors.bold('My Agent'));
    expect(coloredDiagram).toContain(colors.bold('production (US West)'));
    expect(coloredDiagram).toContain(
      colors.dim(
        ` · ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(renderedAt)}`,
      ),
    );
    expect(coloredDiagram).toContain(colors.bold('Workers Config'));
    expect(coloredDiagram).not.toContain(`• ${colors.bold('Enabled')}: ${colors.yellow('true')}`);
    expect(coloredDiagram).toContain(`• ${colors.bold('Mode')}: ${colors.yellow('full')}`);
    expect(coloredDiagram).toContain(`• ${colors.bold('Global Concurrency')}: ${colors.yellow('10')}`);
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
      if (expectedLocation === 'Europe') {
        expect(diagram).toContain('\u001B[48;2;0;51;153m');
        expect(diagram).toContain('\u001B[38;2;255;204;0m');
      }
    },
  );
});
