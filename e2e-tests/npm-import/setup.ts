import type { TestProject } from 'vitest/node';
import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { glob as globby } from 'tinyglobby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolveVerdaccioPath, setupPublishedRegistryFromEnv, startRegistry } from '../_local-registry-setup';
import { publishPackages } from '../_local-registry-setup/publish';
import { E2E_TAG, getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const publishedRegistryTeardown = await setupPublishedRegistryFromEnv(project);
  if (publishedRegistryTeardown) {
    return publishedRegistryTeardown;
  }

  const tag = E2E_TAG;
  const teardown = await prepareMonorepo(rootDir, globby, tag);
  let registry: Awaited<ReturnType<typeof startRegistry>> | undefined;
  const stopRegistry = () => {
    try {
      registry?.kill();
    } catch {}
  };

  try {
    const registryLocation = await mkdtemp(join(tmpdir(), 'npm-import-test-registry'));
    await copyFile(
      join(__dirname, '../_local-registry-setup/verdaccio.yaml'),
      join(registryLocation, 'verdaccio.yaml'),
    );
    registry = await startRegistry(resolveVerdaccioPath(), await getPort(), registryLocation);

    project.provide('tag', tag);
    project.provide('registry', registry.toString());

    await publishPackages(await getSuitePublishFilters(rootDir, 'npm-import'), tag, rootDir, registry);
  } catch (error) {
    stopRegistry();
    await teardown();
    throw error;
  }

  return async () => {
    stopRegistry();
    await teardown();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
  }
}
