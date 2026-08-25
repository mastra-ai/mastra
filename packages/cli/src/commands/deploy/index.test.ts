import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pc from 'picocolors';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProjectDatabase } from '../db/platform-api.js';
import { deployBuildNeedsRefresh, hasEnabledWorkers, renderDeploymentArchitecture, zipOutput } from './index.js';

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

  it('renders a colored three-column architecture matching the platform UI', () => {
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

    const input = {
      environment: { id: 'env_1', name: 'production', region: 'us-west' },
      serverLabel: 'Server',
      workersEnabled: true,
      databases: [database, sharedRedis, stagingDatabase],
      observabilityEnabled: true,
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
    expect(diagram).not.toContain('staging-pg');
    expect(diagram).not.toMatch(/\[[A-Z]+\]/);

    const colors = pc.createColors(true);
    const coloredDiagram = renderDeploymentArchitecture(input, colors);
    const boxTop = `┌${'─'.repeat(30)}┐`;
    expect(coloredDiagram).toContain(colors.blue(boxTop));
    expect(coloredDiagram).toContain(colors.magenta(boxTop));
    expect(coloredDiagram).toContain(colors.green(boxTop));
    expect(coloredDiagram).toContain(colors.red(boxTop));
  });

  it.each([
    [null, 'United States 🇺🇸'],
    ['pdx', 'United States 🇺🇸'],
    ['iad', 'United States 🇺🇸'],
    ['ams', 'Europe 🇪🇺'],
    ['eu', 'Europe 🇪🇺'],
  ])('shows the deployment location instead of the Railway region for %s', (region, expectedLocation) => {
    const input = {
      environment: { id: 'env_1', name: 'production', region },
      serverLabel: 'Server',
      workersEnabled: false,
      databases: [],
      observabilityEnabled: true,
    };
    const colors = pc.createColors(true);
    const diagram = renderDeploymentArchitecture(input, colors);
    const boxTop = `┌${'─'.repeat(30)}┐`;

    expect(diagram).toContain(expectedLocation);
    if (region) expect(diagram).not.toContain(region);
    expect(diagram).toContain(colors.green(boxTop));
  });
});
