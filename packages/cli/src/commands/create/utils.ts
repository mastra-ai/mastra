import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

import type { PackageManager } from '../../utils/package-manager';

export const EMPTY_TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ES2022',
    moduleResolution: 'bundler',
    esModuleInterop: true,
    forceConsistentCasingInFileNames: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    outDir: 'dist',
  },
  include: ['src/**/*'],
};

export const EMPTY_GITIGNORE = `node_modules
dist
.mastra
.env
.env.*
*.db
*.db-*
*.duckdb
*.duckdb.wal
`;

export const PNPM_WORKSPACE = `packages:
  - '.'
minimumReleaseAgeExclude:
  - mastra
  - "@mastra/*"
allowBuilds:
  esbuild: true
  sharp: true
onlyBuiltDependencies:
  - esbuild
  - sharp
`;

export interface OwnedStagingDirectory {
  rootPath: string;
  projectPath: string;
}

export async function createOwnedStagingDirectory(
  invocationCwd: string,
  projectName: string,
): Promise<OwnedStagingDirectory> {
  const rootPath = await fs.mkdtemp(path.join(invocationCwd, `.${projectName}.mastra-create-`));
  return {
    rootPath,
    projectPath: path.join(rootPath, projectName),
  };
}

export async function cleanupOwnedStagingDirectory(rootPath: string): Promise<void> {
  await fs.rm(rootPath, { recursive: true, force: true });
}

export function existingTargetError(projectName: string): Error {
  return new Error(`A file or directory named "${projectName}" already exists. Please choose a different name.`);
}

export async function publishStagedProject({
  projectPath,
  targetPath,
  projectName,
}: {
  projectPath: string;
  targetPath: string;
  projectName: string;
}): Promise<void> {
  if (fsSync.existsSync(targetPath)) {
    throw existingTargetError(projectName);
  }

  try {
    await fs.rename(projectPath, targetPath);
  } catch (error) {
    if (fsSync.existsSync(targetPath)) {
      throw existingTargetError(projectName);
    }
    throw error;
  }
}

export async function writeEmptyScaffold({
  projectPath,
  projectName,
  versionTag,
  packageManager,
}: {
  projectPath: string;
  projectName: string;
  versionTag: string;
  packageManager: PackageManager;
}): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'src/mastra'), { recursive: true });

  const packageJson = {
    name: projectName,
    version: '1.0.0',
    private: true,
    type: 'module',
    engines: {
      node: '>=22.13.0',
    },
    scripts: {
      dev: 'mastra dev',
      build: 'mastra build',
      start: 'mastra start',
    },
    dependencies: {
      '@mastra/core': versionTag,
    },
    devDependencies: {
      mastra: versionTag,
      typescript: '^6.0.3',
      '@types/node': 'latest',
    },
  };

  const writes = [
    fs.writeFile(path.join(projectPath, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(projectPath, 'tsconfig.json'), `${JSON.stringify(EMPTY_TSCONFIG, null, 2)}\n`, 'utf8'),
    fs.writeFile(path.join(projectPath, '.gitignore'), EMPTY_GITIGNORE, 'utf8'),
    fs.writeFile(
      path.join(projectPath, 'src/mastra/index.ts'),
      "import { Mastra } from '@mastra/core/mastra';\n\nexport const mastra = new Mastra({});\n",
      'utf8',
    ),
  ];

  if (packageManager === 'pnpm') {
    writes.push(fs.writeFile(path.join(projectPath, 'pnpm-workspace.yaml'), PNPM_WORKSPACE, 'utf8'));
  }

  await Promise.all(writes);
}
