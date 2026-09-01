import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { shouldSkipDotenvLoading } from '../utils.js';

export const WORKER_MANIFEST_ENTRY = 'worker-manifest';
export const WORKERS_CONFIG_ENTRY = 'workers-config';
const WORKER_MANIFEST_OUTPUT_PREFIX = '__MASTRA_WORKER_MANIFEST__:';
export const WORKER_MANIFEST_INTROSPECTION_TIMEOUT_MS = 15_000;

export function getWorkerManifestEntry(): string {
  return `
    import { workers } from './${WORKERS_CONFIG_ENTRY}.mjs';

    const builtInWorkerNames = new Set(['orchestration', 'scheduler', 'backgroundTasks']);
    const configuredWorkers = Array.isArray(workers) ? workers : [];
    const custom = [...new Set(
      configuredWorkers
        .map(worker => worker.name)
        .filter(name => typeof name === 'string' && !builtInWorkerNames.has(name)),
    )].sort();

    await new Promise((resolve, reject) => {
      process.stdout.write(
        '${WORKER_MANIFEST_OUTPUT_PREFIX}' + JSON.stringify({ custom }),
        error => error ? reject(error) : resolve(),
      );
    });
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

function subprocessOutput(stdout: string, stderr: string): string {
  const output = [];
  if (stdout.trim()) output.push(`stdout:\n${stdout.trim()}`);
  if (stderr.trim()) output.push(`stderr:\n${stderr.trim()}`);
  return output.length > 0 ? `\n${output.join('\n')}` : '';
}

function parseWorkerManifestOutput(stdout: string): string[] {
  const markerIndex = stdout.lastIndexOf(WORKER_MANIFEST_OUTPUT_PREFIX);
  if (markerIndex === -1) {
    throw new Error('Worker manifest introspection did not return worker names');
  }

  const output = JSON.parse(stdout.slice(markerIndex + WORKER_MANIFEST_OUTPUT_PREFIX.length)) as unknown;
  if (
    typeof output !== 'object' ||
    output === null ||
    !('custom' in output) ||
    !Array.isArray(output.custom) ||
    output.custom.some(name => typeof name !== 'string')
  ) {
    throw new Error('Worker manifest introspection returned invalid worker names');
  }

  return output.custom;
}

export async function introspectWorkerManifest(
  bundleDirectory: string,
  env: NodeJS.ProcessEnv = createWorkerManifestEnvironment(process.env),
  { timeoutMs = WORKER_MANIFEST_INTROSPECTION_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<void> {
  const manifestPath = join(bundleDirectory, 'workers.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
  if (manifest === null) return;

  const entryPath = join(bundleDirectory, `${WORKER_MANIFEST_ENTRY}.mjs`);
  const introspectionDirectory = await mkdtemp(join(tmpdir(), 'mastra-worker-introspection-'));

  try {
    const custom = await new Promise<string[]>((resolve, reject) => {
      const child = spawn(process.execPath, [entryPath], {
        cwd: introspectionDirectory,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.setEncoding('utf-8');
      child.stdout.on('data', chunk => {
        stdout += chunk;
      });
      child.stderr.setEncoding('utf-8');
      child.stderr.on('data', chunk => {
        stderr += chunk;
      });

      child.once('error', error => {
        clearTimeout(timeout);
        reject(
          new Error(
            `Worker manifest introspection failed to start: ${error.message}${subprocessOutput(stdout, stderr)}`,
          ),
        );
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        if (timedOut) {
          reject(
            new Error(
              `Worker manifest introspection timed out after ${timeoutMs}ms${subprocessOutput(stdout, stderr)}`,
            ),
          );
          return;
        }
        if (code !== 0) {
          reject(
            new Error(
              `Worker manifest introspection failed (${signal ? `signal ${signal}` : `exit ${code}`})${subprocessOutput(stdout, stderr)}`,
            ),
          );
          return;
        }

        try {
          resolve(parseWorkerManifestOutput(stdout));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          reject(new Error(`${message}${subprocessOutput(stdout, stderr)}`));
        }
      });
    });

    await writeFile(manifestPath, JSON.stringify({ ...manifest, custom }));
  } finally {
    await rm(introspectionDirectory, { recursive: true, force: true });
  }
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
