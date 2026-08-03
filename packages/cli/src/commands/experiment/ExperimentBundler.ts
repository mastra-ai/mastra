import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  artifact: { digestAlgorithm: 'sha256'; contentDigest: string; excludes: ['experiment-worker-manifest.json'] };
  files: Array<{ path: string; sha256: string }>;
}

export class ExperimentBundler extends Bundler {
  readonly buildIdentity: ExperimentWorkerBuildIdentity = {
    buildId: randomUUID(),
    protocolVersion: EXPERIMENT_WORKER_PROTOCOL_VERSION,
    datasetCanonicalizationVersion: EXPERIMENT_DATASET_CANONICALIZATION_VERSION,
  };

  constructor() {
    super('ExperimentWorker');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
    this.outputDir = '.';
  }

  getEnvFiles(): Promise<string[]> {
    if (shouldSkipDotenvLoading()) return Promise.resolve([]);
    try {
      return Promise.resolve([new FileService().getFirstExistingFile(['.env.production', '.env.local', '.env'])]);
    } catch {
      return Promise.resolve([]);
    }
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    await this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot });
  }

  async writeArtifactManifest(outputDirectory: string, cliVersion: string): Promise<void> {
    const files = await collectFileDigests(outputDirectory);
    const lockfile = files.find(file => file.path === 'package-lock.json')?.path;
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
        excludes: ['experiment-worker-manifest.json'],
      },
      files,
    };
    await writeFile(join(outputDirectory, 'experiment-worker-manifest.json'), JSON.stringify(manifest, null, 2));
  }

  protected getEntry(): string {
    const runtimeUrl = pathToFileURL(resolveRuntimePath()).href;
    return `
import { runExperimentWorker } from ${JSON.stringify(runtimeUrl)};

console.log = (...args) => console.error(...args);
console.info = (...args) => console.error(...args);
console.debug = (...args) => console.error(...args);
const [{ runExperiment }, { mastra }] = await Promise.all([
  import('@mastra/core/datasets'),
  import('#mastra'),
]);
const exitCode = await runExperimentWorker({
  mastra,
  runExperiment,
  build: ${JSON.stringify(this.buildIdentity)},
});
await Promise.race([
  new Promise(resolve => process.stdout.end(resolve)),
  new Promise(resolve => setTimeout(resolve, 1_000)),
]);
process.exit(exitCode);
`;
  }
}

function resolveRuntimePath(): string {
  const sourcePath = fileURLToPath(new URL('./runtime.ts', import.meta.url));
  if (existsSync(sourcePath)) return sourcePath;
  return fileURLToPath(new URL('./runtime.js', import.meta.url));
}

async function collectFileDigests(root: string): Promise<Array<{ path: string; sha256: string }>> {
  const files: Array<{ path: string; sha256: string }> = [];
  const visit = async (directory: string) => {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.name !== 'experiment-worker-manifest.json') {
        files.push({
          path: relative(root, fullPath).replaceAll('\\', '/'),
          sha256: createHash('sha256')
            .update(await readFile(fullPath))
            .digest('hex'),
        });
      }
    }
  };
  await visit(root);
  return files;
}
