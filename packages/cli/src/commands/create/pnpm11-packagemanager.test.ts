import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { PNPM_WORKSPACE, writeEmptyScaffold } from './utils';

/**
 * Verifies that the direct pnpm scaffold avoids packageManager metadata that
 * Corepack versions bundled with supported Node releases may reject.
 */
describe('pnpm v11 packageManager normalization', () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
    );
  });

  async function createPnpmProject(versionTag = 'latest') {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-pnpm11-'));
    temporaryDirectories.push(projectPath);
    await writeEmptyScaffold({
      projectPath,
      projectName: 'pnpm-project',
      versionTag,
      packageManager: 'pnpm',
    });
    return projectPath;
  }

  it('omits packageManager and devEngines from the authored manifest', async () => {
    const projectPath = await createPnpmProject();
    const manifest = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));

    expect(manifest.packageManager).toBeUndefined();
    expect(manifest.devEngines).toBeUndefined();
  });

  it('uses the same bare release-channel tag for independently versioned Mastra packages', async () => {
    const projectPath = await createPnpmProject('snapshot-channel');
    const manifest = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));

    expect(manifest.dependencies['@mastra/core']).toBe('snapshot-channel');
    expect(manifest.devDependencies.mastra).toBe('snapshot-channel');
  });

  it('writes the complete pnpm 11 workspace and build-policy configuration', async () => {
    const projectPath = await createPnpmProject();

    expect(await fs.readFile(path.join(projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
  });
});
