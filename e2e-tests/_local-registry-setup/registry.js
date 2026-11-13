import { fork, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareMonorepo } from './prepare.js';
import { E2E_TAG } from './publish-roots.js';
import { publishPackages } from './publish.js';

let require = global.require;
if (typeof require === 'undefined') {
  require = createRequire(import.meta.url);
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export function resolveVerdaccioPathFrom(requireFrom) {
  const manifestPath = requireFrom.resolve('verdaccio/package.json');
  const manifest = requireFrom(manifestPath);
  const binPath = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.verdaccio;
  if (!binPath) {
    throw new Error(`Verdaccio package at ${manifestPath} does not declare a verdaccio binary`);
  }
  return resolve(dirname(manifestPath), binPath);
}

export function resolveVerdaccioPath() {
  try {
    return resolveVerdaccioPathFrom(require);
  } catch (primaryError) {
    try {
      return resolveVerdaccioPathFrom(createRequire(join(process.cwd(), 'package.json')));
    } catch (fallbackError) {
      throw new AggregateError([primaryError, fallbackError], 'Unable to resolve the Verdaccio binary');
    }
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

  if (process.env.MASTRA_E2E_REGISTRY_PID_FILE) {
    await mkdir(dirname(process.env.MASTRA_E2E_REGISTRY_PID_FILE), { recursive: true });
    await writeFile(process.env.MASTRA_E2E_REGISTRY_PID_FILE, `${registry.pid}\n`);
  }

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

  const pidFile = process.env.MASTRA_E2E_REGISTRY_PID_FILE;
  if (pidFile) {
    try {
      if ((await readFile(pidFile, 'utf8')).trim() === String(registry.pid)) {
        await unlink(pidFile);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
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
  if (!storageDir) {
    return null;
  }

  const registry = await startPublishedRegistry({
    storageDir,
    configPath: process.env.MASTRA_E2E_REGISTRY_CONFIG || join(dirname(storageDir), 'verdaccio.yaml'),
    port: Number(process.env.MASTRA_E2E_REGISTRY_PORT || 4873),
  });

  return { tag: E2E_TAG, registry };
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
  port = 4873,
  configPath,
  storageDir,
  publishFilters,
  verdaccioPath = resolveVerdaccioPath(),
}) {
  if (!rootDir) {
    throw new Error('rootDir is required to create a published registry');
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

  const defaultConfigStorageDir = resolve(dirname(configPath), 'storage');
  if (resolve(storageDir) !== defaultConfigStorageDir) {
    throw new Error(`storageDir must match the Verdaccio config storage path: ${defaultConfigStorageDir}`);
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

    registry = await startRegistry(verdaccioPath, port, dirname(configPath), configPath);
    teardown = await prepareMonorepo(rootDir, globby, E2E_TAG);
    await publishPackages(publishFilters, E2E_TAG, rootDir, registry);
  } finally {
    await stopRegistry(registry);
    await teardown();
  }

  const registryUrl = `http://localhost:${port}`;
  const metadata = {
    tag: E2E_TAG,
    registryPort: port,
    registryUrl,
    storageDir,
    configPath,
  };

  await writeFile(join(dirname(configPath), 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);

  return metadata;
}
