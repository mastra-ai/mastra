import { fork, execSync } from 'node:child_process';
import { copyFile, mkdtemp, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ChildProcess } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export interface Registry {
  url: string;
  port: number;
  process: ChildProcess;
  location: string;
  shutdown: () => void;
}

/**
 * Verdaccio configuration for e2e tests.
 * Blocks npm fallback for @mastra/* packages to ensure tests fail fast
 * if a package is missing from the publish list.
 */
const VERDACCIO_CONFIG = `
storage: ./storage

# Increase max body size to handle large packages
max_body_size: 100mb

uplinks:
  npmjs:
    url: https://registry.npmjs.org/

packages:
  # Block npm fallback for @mastra/* packages - they MUST be published locally
  '@mastra/*':
    access: $all
    publish: $all
    unpublish: $all

  # Same for the unscoped 'mastra' package
  'mastra':
    access: $all
    publish: $all
    unpublish: $all

  # Same for create-mastra
  'create-mastra':
    access: $all
    publish: $all
    unpublish: $all

  # All other packages can fall back to npm
  '**':
    access: $all
    publish: $all
    unpublish: $all
    proxy: npmjs

security:
  api:
    legacy: true

middlewares:
  audit:
    enabled: false

web:
  enable: true

log:
  - { type: stdout, format: pretty, level: error }
`;

/**
 * Start a verdaccio registry process
 */
function runRegistry(
  verdaccioPath: string,
  args: string[] = [],
  childOptions: Record<string, unknown>,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const childFork = fork(verdaccioPath, args, {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      ...childOptions,
    });

    childFork.on('message', (msg: { verdaccio_started?: boolean }) => {
      if (msg.verdaccio_started) {
        setImmediate(() => resolve(childFork));
      }
    });

    childFork.on('error', err => reject(err));
    childFork.on('disconnect', err => reject(err));
  });
}

/**
 * Start a local npm registry for e2e tests.
 *
 * This creates a temporary directory with verdaccio config and starts
 * a registry process. The registry URL is returned along with cleanup functions.
 *
 * @param port - The port to run the registry on
 * @returns Registry instance with URL, process, and shutdown function
 */
export async function startRegistry(port: number): Promise<Registry> {
  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const location = await mkdtemp(join(tmpdir(), 'mastra-e2e-registry-'));

  // Write verdaccio config
  await writeFile(join(location, 'verdaccio.yaml'), VERDACCIO_CONFIG);

  const registryProcess = await runRegistry(verdaccioPath, ['-c', './verdaccio.yaml', '-l', `${port}`], {
    cwd: location,
  });

  const url = `http://localhost:${port}`;

  // Set auth tokens for npm/pnpm (required even if registry doesn't validate)
  execSync(`npm config set //localhost:${port}/:_authToken dummy-token`);
  execSync(`pnpm config set //localhost:${port}/:_authToken dummy-token`);

  const shutdown = () => {
    try {
      registryProcess.kill('SIGTERM');
    } catch {
      // Process might already be dead
    }
  };

  return {
    url,
    port,
    process: registryProcess,
    location,
    shutdown,
  };
}
