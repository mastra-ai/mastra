import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { lstat, mkdtemp, readFile, readdir, readlink, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';
import {
  EXPERIMENT_DATASET_CANONICALIZATION_VERSION,
  EXPERIMENT_WORKER_PROTOCOL_VERSION,
  type ExperimentWorkerBuildIdentity,
} from './runtime.js';

export { EXPERIMENT_DATASET_CANONICALIZATION_VERSION, EXPERIMENT_WORKER_PROTOCOL_VERSION } from './runtime.js';

export interface ExperimentWorkerArtifactManifest {
  artifactVersion: 1;
  kind: 'mastra-experiment-worker';
  build: { buildId: string; cliVersion: string; createdAt: string };
  protocol: { versions: string[]; framing: 'ndjson'; datasetCanonicalizationVersion: string };
  launch: { executable: string; arguments: string[]; workingDirectory: string };
  dependencies: { manifest: string; lockfile?: string };
  artifact: {
    digestAlgorithm: 'sha256';
    contentDigest: string;
    excludes: ['experiment-worker-manifest.json', 'node_modules'];
  };
  files: Array<{ path: string; sha256: string; type?: 'file' | 'symlink'; target?: string }>;
}

export class ExperimentBundler extends Bundler {
  readonly buildIdentity: ExperimentWorkerBuildIdentity = {
    buildId: randomUUID(),
    protocolVersion: EXPERIMENT_WORKER_PROTOCOL_VERSION,
    datasetCanonicalizationVersion: EXPERIMENT_DATASET_CANONICALIZATION_VERSION,
  };
  protected pnpmNodeLinker = 'hoisted' as const;

  constructor() {
    super('ExperimentWorker');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
    this.outputDir = '.';
  }

  getEnvFiles(): Promise<string[]> {
    if (shouldSkipDotenvLoading()) return Promise.resolve([]);
    return Promise.resolve(new FileService().getExistingFiles(['.env', '.env.local', '.env.production']));
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const existingOutputFiles = await collectFileSignatures(outputDirectory);
    const scratchDirectory = await mkdtemp(join(tmpdir(), 'mastra-experiment-config-'));
    const originalWorkingDirectory = process.cwd();
    let bundlerOptions: NonNullable<Config['bundler']>;
    try {
      process.chdir(scratchDirectory);
      bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);
    } finally {
      process.chdir(originalWorkingDirectory);
      await rm(scratchDirectory, { recursive: true, force: true });
    }

    const currentOutputFiles = await collectFileSignatures(outputDirectory);
    const outputPaths = new Set([...existingOutputFiles.keys(), ...currentOutputFiles.keys()]);
    const unexpectedOutputFiles = [...outputPaths]
      .filter(path => path !== 'bundler-config.mjs' && existingOutputFiles.get(path) !== currentOutputFiles.get(path))
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
    if (unexpectedOutputFiles.length > 0) {
      throw new Error(
        `Mastra configuration initialization created or modified unexpected files in the experiment worker artifact: ${unexpectedOutputFiles.join(', ')}`,
      );
    }

    if (!Array.isArray(bundlerOptions.externals)) return bundlerOptions;

    return {
      ...bundlerOptions,
      dynamicPackages: [...new Set([...(bundlerOptions.dynamicPackages ?? []), ...bundlerOptions.externals])],
    };
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    await this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot });
  }

  protected override async installDependencies(
    outputDirectory: string,
    rootDir?: string,
    pnpmOverrides?: Record<string, string>,
  ): Promise<void> {
    await super.installDependencies(outputDirectory, rootDir, pnpmOverrides);
    await removePnpmInstallMetadata(join(outputDirectory, this.outputDir));
  }

  async writeArtifactManifest(outputDirectory: string, cliVersion: string): Promise<void> {
    await Promise.all([
      removePnpmInstallMetadata(outputDirectory),
      rm(join(outputDirectory, this.analyzeOutputDir), { recursive: true, force: true }),
    ]);
    const files = await collectFileDigests(outputDirectory);
    const lockfileNames = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb']);
    const lockfile = files.find(file => lockfileNames.has(file.path))?.path;
    const contentDigest = createHash('sha256')
      .update(files.map(file => `${file.path}\0${file.sha256}\n`).join(''))
      .digest('hex');
    const manifest: ExperimentWorkerArtifactManifest = {
      artifactVersion: 1,
      kind: 'mastra-experiment-worker',
      build: { buildId: this.buildIdentity.buildId, cliVersion, createdAt: new Date().toISOString() },
      protocol: {
        versions: [EXPERIMENT_WORKER_PROTOCOL_VERSION],
        framing: 'ndjson',
        datasetCanonicalizationVersion: EXPERIMENT_DATASET_CANONICALIZATION_VERSION,
      },
      launch: { executable: 'node', arguments: ['index.mjs'], workingDirectory: '.' },
      dependencies: { manifest: 'package.json', ...(lockfile ? { lockfile } : {}) },
      artifact: {
        digestAlgorithm: 'sha256',
        contentDigest,
        excludes: ['experiment-worker-manifest.json', 'node_modules'],
      },
      files,
    };
    await writeFile(join(outputDirectory, 'experiment-worker-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  protected getEntry(): string {
    const runtimePath = resolveRuntimePath();
    return `
import { readFile } from 'node:fs/promises';
import { runExperimentWorker } from ${JSON.stringify(runtimePath)};

console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
console.debug = (...args) => console.error(...args);
const [{ runExperiment }, mastraModule] = await Promise.all([
  import('@mastra/core/datasets'),
  import('#mastra'),
]);
const { mastra } = mastraModule;
if (!mastra) throw new Error("#mastra does not provide an export named 'mastra'");
const artifactManifest = JSON.parse(
  await readFile(new URL('./experiment-worker-manifest.json', import.meta.url), 'utf8'),
);
const exitCode = await runExperimentWorker({
  mastra,
  runExperiment,
  build: {
    buildId: artifactManifest.build.buildId,
    protocolVersion: artifactManifest.protocol.versions[0],
    datasetCanonicalizationVersion: artifactManifest.protocol.datasetCanonicalizationVersion,
  },
});
await Promise.race([
  new Promise(resolve => process.stdout.end(resolve)),
  new Promise(resolve => setTimeout(resolve, 5_000)),
]);
process.exit(exitCode);
`;
  }
}

export function resolveRuntimePath(
  moduleUrl = import.meta.url,
  fileExists: (path: string) => boolean = existsSync,
): string {
  const sourcePath = fileURLToPath(new URL('./runtime.ts', moduleUrl));
  if (fileExists(sourcePath)) return sourcePath;
  return fileURLToPath(new URL('./commands/experiment/runtime.js', moduleUrl));
}

type ArtifactFileDigest = { path: string; sha256: string; type?: 'file' | 'symlink'; target?: string };

async function collectFileSignatures(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }

      const artifactPath = relative(root, entryPath).replaceAll('\\', '/');
      const stats = await lstat(entryPath);
      if (stats.isFile()) {
        files.set(
          artifactPath,
          `file:${createHash('sha256')
            .update(await readFile(entryPath))
            .digest('hex')}`,
        );
      } else if (stats.isSymbolicLink()) {
        files.set(artifactPath, `symlink:${await readlink(entryPath)}`);
      } else {
        files.set(artifactPath, `other:${stats.mode}`);
      }
    }
  };

  await visit(root);
  return files;
}

export async function removePnpmInstallMetadata(root: string): Promise<void> {
  const nodeModules = join(root, 'node_modules');
  await Promise.all([
    ...['.pnpm', '.modules.yaml', '.pnpm-workspace-state-v1.json'].map(name =>
      rm(join(nodeModules, name), { recursive: true, force: true }),
    ),
    rm(join(root, 'preflight-local-paths.json'), { force: true }),
    rm(join(root, 'preflight-metadata.json'), { force: true }),
  ]);

  const visit = async (directory: string): Promise<void> => {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = join(directory, entry.name);
      if (entry.name === '.bin') await rm(entryPath, { recursive: true, force: true });
      else await visit(entryPath);
    }
  };
  await visit(nodeModules);
}

async function collectFileDigests(root: string): Promise<ArtifactFileDigest[]> {
  const files: ArtifactFileDigest[] = [];
  const visit = async (directory: string) => {
    const entries = await readdir(directory);
    for (const name of entries.sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
      const fullPath = join(directory, name);
      const artifactPath = relative(root, fullPath).replaceAll('\\', '/');
      if (artifactPath === 'experiment-worker-manifest.json' || artifactPath === 'node_modules') continue;

      const stats = await lstat(fullPath);
      if (stats.isDirectory()) {
        await visit(fullPath);
      } else if (stats.isFile()) {
        files.push({
          path: artifactPath,
          sha256: createHash('sha256')
            .update(await readFile(fullPath))
            .digest('hex'),
        });
      } else if (stats.isSymbolicLink()) {
        const target = await readlink(fullPath);
        if (isAbsolute(target)) {
          throw new Error(`Experiment worker artifacts cannot contain absolute symlinks: ${artifactPath}`);
        }
        const resolvedTarget = resolve(dirname(fullPath), target);
        const artifactTarget = relative(root, resolvedTarget);
        if (artifactTarget === '..' || artifactTarget.startsWith(`..${sep}`) || isAbsolute(artifactTarget)) {
          throw new Error(`Experiment worker artifacts cannot contain escaping symlinks: ${artifactPath}`);
        }
        files.push({
          path: artifactPath,
          type: 'symlink',
          target,
          sha256: createHash('sha256').update(target).digest('hex'),
        });
      } else {
        throw new Error(`Unsupported artifact file type: ${artifactPath}`);
      }
    }
  };
  await visit(root);
  return files;
}
