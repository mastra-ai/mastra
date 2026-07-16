import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getPackageManager } from '../utils';
import { writeEmptyScaffold } from './utils';

describe('Bun Runtime Detection', () => {
  const originalEnv = process.env;
  const temporaryDirectories: string[] = [];

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await Promise.all(
      temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
    );
  });

  it('should detect bun from npm_config_user_agent', () => {
    process.env.npm_config_user_agent = 'bun/1.0.0 npm/? node/v20.0.0 darwin x64';
    expect(getPackageManager()).toBe('bun');
  });

  it('should detect bun from npm_execpath', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '/usr/local/bin/bun';
    expect(getPackageManager()).toBe('bun');
  });

  it('should fallback to npm if no package manager is detected', () => {
    process.env.npm_config_user_agent = '';
    process.env.npm_execpath = '';
    expect(getPackageManager()).toBe('npm');
  });

  it('does not add package-manager metadata for bun', async () => {
    const projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-bun-scaffold-'));
    temporaryDirectories.push(projectPath);

    await writeEmptyScaffold({
      projectPath,
      projectName: 'bun-project',
      versionTag: 'latest',
      packageManager: 'bun',
    });

    const manifest = JSON.parse(await fs.readFile(path.join(projectPath, 'package.json'), 'utf8'));
    expect(manifest.packageManager).toBeUndefined();
    expect(manifest.devEngines).toBeUndefined();
    await expect(fs.stat(path.join(projectPath, 'pnpm-workspace.yaml'))).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
