import { fork, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMonorepo } from './prepare.js';
import { publishPackages } from './publish.js';

let require = global.require;
if (typeof require === 'undefined') {
  require = createRequire(import.meta.url);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveVerdaccioPath() {
  try {
    return require.resolve('verdaccio/bin/verdaccio');
  } catch {
    return createRequire(join(process.cwd(), 'package.json')).resolve('verdaccio/bin/verdaccio');
  }
}

/**
 *
 * @param {string} verdaccioPath
 * @param {*} args
 * @param {*} childOptions
 * @returns {Promise<import('child_process').ChildProcess>}
 */
export function runRegistry(verdaccioPath, args = [], childOptions) {
  return new Promise((resolve, reject) => {
    const childFork = fork(verdaccioPath, args, {
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
      ...childOptions,
    });
    childFork.on('message', msg => {
      if (msg.verdaccio_started) {
        setImmediate(() => {
          resolve(childFork);
        });
      }
    });

    childFork.on('error', err => reject([err]));
    childFork.on('disconnect', err => reject([err]));
  });
}

export async function startRegistry(verdaccioPath, port, location = process.cwd(), configPath = './verdaccio.yaml') {
  const registry = await runRegistry(verdaccioPath, ['-c', configPath, '-l', `${port}`], {
    cwd: location,
  });

  // Set a dummy auth token for npm/pnpm (required by npm even if registry doesn't validate it)
  execSync(`npm config set //localhost:${port}/:_authToken dummy-token`);
  execSync(`pnpm config set //localhost:${port}/:_authToken dummy-token`);

  return new Proxy(registry, {
    get(target, prop) {
      if (prop === 'toString') {
        return () => `http://localhost:${port}`;
      }

      return Reflect.get(target, prop);
    },
  });
}

export async function stopRegistry(registry) {
  if (!registry || registry.killed) {
    return;
  }

  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      try {
        registry.kill('SIGKILL');
      } catch {
        // ignore
      }
      resolve();
    }, 5000);

    registry.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    try {
      registry.kill('SIGTERM');
    } catch {
      clearTimeout(timeout);
      resolve();
    }
  });
}

export async function startPublishedRegistry({
  port = 4873,
  storageDir,
  configPath = join(dirname(storageDir), 'verdaccio.yaml'),
  verdaccioPath = resolveVerdaccioPath(),
}) {
  if (!storageDir) {
    throw new Error('storageDir is required to start a published registry');
  }

  if (!existsSync(storageDir)) {
    throw new Error(`Published registry storage does not exist: ${storageDir}`);
  }

  if (!existsSync(configPath)) {
    throw new Error(`Published registry config does not exist: ${configPath}`);
  }

  return startRegistry(verdaccioPath, port, dirname(configPath), configPath);
}

export async function startPublishedRegistryFromEnv() {
  const storageDir = process.env.MASTRA_E2E_REGISTRY_STORAGE;
  const tag = process.env.MASTRA_E2E_REGISTRY_TAG;

  if (!storageDir && !tag) {
    return null;
  }

  if (!storageDir || !tag) {
    throw new Error('MASTRA_E2E_REGISTRY_STORAGE and MASTRA_E2E_REGISTRY_TAG must be set together');
  }

  const registry = await startPublishedRegistry({
    storageDir,
    configPath: process.env.MASTRA_E2E_REGISTRY_CONFIG || join(dirname(storageDir), 'verdaccio.yaml'),
    port: Number(process.env.MASTRA_E2E_REGISTRY_PORT || 4873),
  });

  return { tag, registry };
}

export async function setupPublishedRegistryFromEnv(project) {
  const publishedRegistry = await startPublishedRegistryFromEnv();

  if (!publishedRegistry) {
    return null;
  }

  project.provide('tag', publishedRegistry.tag);
  project.provide('registry', publishedRegistry.registry.toString());

  return () => stopRegistry(publishedRegistry.registry);
}

export async function createPublishedRegistry({
  rootDir,
  tag,
  port = 4873,
  configPath,
  storageDir,
  publishFilters,
  verdaccioPath = resolveVerdaccioPath(),
}) {
  if (!rootDir) {
    throw new Error('rootDir is required to create a published registry');
  }
  if (!tag) {
    throw new Error('tag is required to create a published registry');
  }
  if (!configPath) {
    throw new Error('configPath is required to create a published registry');
  }
  if (!storageDir) {
    throw new Error('storageDir is required to create a published registry');
  }
  if (!publishFilters?.length) {
    throw new Error('publishFilters is required to create a published registry');
  }

  await mkdir(storageDir, { recursive: true });
  await mkdir(dirname(configPath), { recursive: true });
  if (!existsSync(configPath)) {
    await copyFile(join(__dirname, 'verdaccio.yaml'), configPath);
  }

  let teardown = async () => {};
  let registry;

  try {
    const { glob: globby } = await import('tinyglobby');

    teardown = await prepareMonorepo(rootDir, globby, tag);
    registry = await startRegistry(verdaccioPath, port, dirname(configPath), configPath);
    await publishPackages([...new Set(publishFilters)], tag, rootDir, registry);
  } finally {
    await stopRegistry(registry);
    await teardown();
  }

  const registryUrl = `http://localhost:${port}`;
  const metadata = {
    tag,
    registryPort: port,
    registryUrl,
    storageDir,
    configPath,
  };

  await writeFile(join(dirname(configPath), 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  return metadata;
}
