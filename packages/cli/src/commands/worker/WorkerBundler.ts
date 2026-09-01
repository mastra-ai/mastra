import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';

export const WORKER_MANIFEST_ENTRY = 'worker-manifest';
export const WORKERS_CONFIG_ENTRY = 'workers-config';

export function getWorkerManifestEntry(): string {
  return `
    import { readFile, writeFile } from 'node:fs/promises';
    import { workers } from './${WORKERS_CONFIG_ENTRY}.mjs';

    const manifestUrl = new URL('./workers.json', import.meta.url);
    const manifest = JSON.parse(await readFile(manifestUrl, 'utf-8'));
    const builtInWorkerNames = new Set(['orchestration', 'scheduler', 'backgroundTasks']);
    const configuredWorkers = Array.isArray(workers) ? workers : [];
    const custom = [...new Set(
      configuredWorkers
        .map(worker => worker.name)
        .filter(name => !builtInWorkerNames.has(name)),
    )].sort();

    await writeFile(manifestUrl, JSON.stringify({ ...manifest, custom }));
    process.exit(0);
  `;
}

const CHILD_PROCESS_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMPDIR',
  'TMP',
  'TEMP',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
  'NODE_OPTIONS',
  'LANG',
  'LC_ALL',
] as const;

export function createWorkerManifestEnvironment(
  appEnv: NodeJS.ProcessEnv,
  { inheritProcessEnv = false }: { inheritProcessEnv?: boolean } = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};

  if (inheritProcessEnv) {
    Object.assign(env, process.env, appEnv);
  } else {
    for (const key of CHILD_PROCESS_ENV_KEYS) {
      const value = process.env[key];
      if (value !== undefined) env[key] = value;
    }
    Object.assign(env, appEnv);
  }

  delete env.MASTRA_WORKERS;
  return env;
}

export async function introspectWorkerManifest(
  bundleDirectory: string,
  env: NodeJS.ProcessEnv = createWorkerManifestEnvironment(process.env),
): Promise<void> {
  const manifestPath = join(bundleDirectory, 'workers.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  if (manifest === null) return;

  const entryPath = join(bundleDirectory, `${WORKER_MANIFEST_ENTRY}.mjs`);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [entryPath], {
      cwd: bundleDirectory,
      env,
      stdio: 'ignore',
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Worker manifest introspection failed (${signal ? `signal ${signal}` : `exit ${code}`})`));
    });
  });
}

export function getWorkerEntry(): string {
  return `
    import { createServer } from 'node:http';
    import { mastra } from '#mastra';

    let workersReady = false;
    let shuttingDown = false;

    const healthServer = createServer((request, response) => {
      response.setHeader('content-type', 'application/json');

      if (request.url !== '/health') {
        response.statusCode = 404;
        response.end(JSON.stringify({ status: 'not_found' }));
        return;
      }

      response.statusCode = workersReady ? 200 : 503;
      response.end(JSON.stringify({ status: workersReady ? 'ready' : 'starting' }));
    });

    const port = Number.parseInt(process.env.PORT ?? '4111', 10);
    await new Promise((resolve, reject) => {
      const onError = error => reject(error);
      healthServer.once('error', onError);
      healthServer.listen(port, '0.0.0.0', () => {
        healthServer.off('error', onError);
        resolve();
      });
    });

    try {
      await mastra.startWorkers();
      workersReady = true;
      console.log('[mastra] Workers started');
    } catch (error) {
      healthServer.close();
      throw error;
    }

    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;
      workersReady = false;
      console.log('[mastra] Shutting down workers...');
      healthServer.close();
      await mastra.stopWorkers();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    `;
}

export class WorkerBundler extends Bundler {
  constructor({ outputDir }: { outputDir?: string } = {}) {
    super('Worker');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
    if (outputDir) {
      this.outputDir = outputDir;
    }
  }

  getEnvFiles(): Promise<string[]> {
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    return Promise.resolve(new FileService().getExistingFiles(['.env', '.env.local', '.env.production']));
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected getEntry(): string {
    return getWorkerEntry();
  }
}
