import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  cleanupOwnedStagingDirectory,
  createOwnedStagingDirectory,
  EMPTY_GITIGNORE,
  EMPTY_TSCONFIG,
  PNPM_WORKSPACE,
  publishStagedProject,
  writeEmptyScaffold,
} from './utils';

const temporaryDirectories: string[] = [];

async function createInvocationDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-empty-scaffold-'));
  temporaryDirectories.push(directory);
  return directory;
}

async function listRelativeFiles(root: string, current = root): Promise<string[]> {
  const entries = await fs.readdir(current, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, absolutePath)));
    } else {
      files.push(path.relative(root, absolutePath));
    }
  }
  return files.sort();
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(directory => fs.rm(directory, { recursive: true, force: true })),
  );
});

describe('empty scaffold', () => {
  it('writes the exact provider-free authored scaffold with channel tags', async () => {
    const invocationCwd = await createInvocationDirectory();
    const staging = await createOwnedStagingDirectory(invocationCwd, 'empty-project');

    await writeEmptyScaffold({
      projectPath: staging.projectPath,
      projectName: 'empty-project',
      versionTag: 'snapshot-channel',
      packageManager: 'npm',
    });

    expect(await listRelativeFiles(staging.projectPath)).toEqual([
      '.gitignore',
      'package.json',
      'src/mastra/index.ts',
      'tsconfig.json',
    ]);

    const manifest = JSON.parse(await fs.readFile(path.join(staging.projectPath, 'package.json'), 'utf8'));
    expect(manifest).toEqual({
      name: 'empty-project',
      version: '1.0.0',
      private: true,
      type: 'module',
      engines: { node: '>=22.13.0' },
      scripts: {
        dev: 'mastra dev',
        build: 'mastra build',
        start: 'mastra start',
      },
      dependencies: {
        '@mastra/core': 'snapshot-channel',
      },
      devDependencies: {
        mastra: 'snapshot-channel',
        typescript: '^6.0.3',
        '@types/node': 'latest',
      },
    });
    expect(await fs.readFile(path.join(staging.projectPath, 'tsconfig.json'), 'utf8')).toBe(
      `${JSON.stringify(EMPTY_TSCONFIG, null, 2)}\n`,
    );
    expect(await fs.readFile(path.join(staging.projectPath, '.gitignore'), 'utf8')).toBe(EMPTY_GITIGNORE);
    expect(await fs.readFile(path.join(staging.projectPath, 'src/mastra/index.ts'), 'utf8')).toBe(
      "import { Mastra } from '@mastra/core/mastra';\n\nexport const mastra = new Mastra({});\n",
    );

    const allContent = await Promise.all(
      (await listRelativeFiles(staging.projectPath)).map(file =>
        fs.readFile(path.join(staging.projectPath, file), 'utf8'),
      ),
    );
    expect(allContent.join('\n')).not.toMatch(/openai|anthropic|google|xai|weather|agent|workflow|memory|storage/i);
  });

  it('adds only the approved pnpm workspace file when pnpm is selected', async () => {
    const invocationCwd = await createInvocationDirectory();
    const staging = await createOwnedStagingDirectory(invocationCwd, 'pnpm-project');

    await writeEmptyScaffold({
      projectPath: staging.projectPath,
      projectName: 'pnpm-project',
      versionTag: 'beta',
      packageManager: 'pnpm',
    });

    expect(await listRelativeFiles(staging.projectPath)).toEqual([
      '.gitignore',
      'package.json',
      'pnpm-workspace.yaml',
      'src/mastra/index.ts',
      'tsconfig.json',
    ]);
    expect(await fs.readFile(path.join(staging.projectPath, 'pnpm-workspace.yaml'), 'utf8')).toBe(PNPM_WORKSPACE);
  });

  it('allows only package-manager install artifacts beyond the authored scaffold', async () => {
    const invocationCwd = await createInvocationDirectory();
    const staging = await createOwnedStagingDirectory(invocationCwd, 'installed-project');
    await writeEmptyScaffold({
      projectPath: staging.projectPath,
      projectName: 'installed-project',
      versionTag: 'latest',
      packageManager: 'npm',
    });

    await fs.mkdir(path.join(staging.projectPath, 'node_modules/@mastra/core'), { recursive: true });
    await fs.mkdir(path.join(staging.projectPath, 'node_modules/mastra'), { recursive: true });
    await fs.writeFile(path.join(staging.projectPath, 'package-lock.json'), '{}\n');
    await fs.writeFile(
      path.join(staging.projectPath, 'node_modules/@mastra/core/package.json'),
      JSON.stringify({ version: '1.50.2' }),
    );
    await fs.writeFile(
      path.join(staging.projectPath, 'node_modules/mastra/package.json'),
      JSON.stringify({ version: '1.22.0' }),
    );

    const topLevel = (await fs.readdir(staging.projectPath)).sort();
    expect(topLevel).toEqual([
      '.gitignore',
      'node_modules',
      'package-lock.json',
      'package.json',
      'src',
      'tsconfig.json',
    ]);
    const manifest = JSON.parse(await fs.readFile(path.join(staging.projectPath, 'package.json'), 'utf8'));
    expect(manifest.dependencies['@mastra/core']).toBe('latest');
    expect(manifest.devDependencies.mastra).toBe('latest');
    expect(
      JSON.parse(await fs.readFile(path.join(staging.projectPath, 'node_modules/@mastra/core/package.json'), 'utf8'))
        .version,
    ).not.toBe(
      JSON.parse(await fs.readFile(path.join(staging.projectPath, 'node_modules/mastra/package.json'), 'utf8')).version,
    );
  });
});

describe('owned staging publication', () => {
  it('creates a sibling owned staging root and atomically publishes its project directory', async () => {
    const invocationCwd = await createInvocationDirectory();
    const staging = await createOwnedStagingDirectory(invocationCwd, 'published-project');
    expect(path.dirname(staging.rootPath)).toBe(invocationCwd);
    expect(path.basename(staging.rootPath)).toMatch(/^\.published-project\.mastra-create-/);

    await writeEmptyScaffold({
      projectPath: staging.projectPath,
      projectName: 'published-project',
      versionTag: 'latest',
      packageManager: 'npm',
    });
    const targetPath = path.join(invocationCwd, 'published-project');
    await publishStagedProject({ projectPath: staging.projectPath, targetPath, projectName: 'published-project' });
    await cleanupOwnedStagingDirectory(staging.rootPath);

    expect(await fs.readFile(path.join(targetPath, 'package.json'), 'utf8')).toContain('published-project');
    await expect(fs.stat(staging.rootPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('preserves a target that appears before publication and cleans only owned staging', async () => {
    const invocationCwd = await createInvocationDirectory();
    const staging = await createOwnedStagingDirectory(invocationCwd, 'raced-project');
    await writeEmptyScaffold({
      projectPath: staging.projectPath,
      projectName: 'raced-project',
      versionTag: 'latest',
      packageManager: 'npm',
    });
    const targetPath = path.join(invocationCwd, 'raced-project');
    await fs.mkdir(targetPath);
    await fs.writeFile(path.join(targetPath, 'sentinel.txt'), 'preserve me');

    await expect(
      publishStagedProject({ projectPath: staging.projectPath, targetPath, projectName: 'raced-project' }),
    ).rejects.toThrow('already exists');
    await cleanupOwnedStagingDirectory(staging.rootPath);

    expect(await fs.readFile(path.join(targetPath, 'sentinel.txt'), 'utf8')).toBe('preserve me');
    await expect(fs.stat(staging.rootPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
