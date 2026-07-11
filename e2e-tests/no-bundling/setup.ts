import type { TestProject } from 'vitest/node';
import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { glob as globby } from 'tinyglobby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { setupPublishedRegistryFromEnv, startRegistry } from '../_local-registry-setup';
import { publishPackages } from '../_local-registry-setup/publish';
import { getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const publishedRegistryTeardown = await setupPublishedRegistryFromEnv(project);
  if (publishedRegistryTeardown) {
    return publishedRegistryTeardown;
  }

  const tag = 'no-bundling-test';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'mastra-no-bundling-test-registry'));
  console.log('registryLocation', registryLocation);
  console.log('verdaccioPath', verdaccioPath);
  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  project.provide('tag', tag);
  project.provide('registry', registry.toString());

  await publishPackages(await getSuitePublishFilters(rootDir, 'no-bundling'), tag, rootDir, registry);

  return () => {
    teardown();
    registry.kill();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
  }
}
