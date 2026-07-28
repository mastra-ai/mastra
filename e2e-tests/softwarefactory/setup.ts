import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { glob as globby } from 'tinyglobby';
import type { TestProject } from 'vitest/node';
import { prepareMonorepo, setupPublishedRegistryFromEnv, startRegistry } from '../_local-registry-setup';
import { publishPackages } from '../_local-registry-setup/publish';
import { getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');

  // CI path: registry storage was published once for the whole run and
  // downloaded as an artifact; just serve it.
  const publishedRegistryTeardown = await setupPublishedRegistryFromEnv(project);
  if (publishedRegistryTeardown) {
    return publishedRegistryTeardown;
  }

  // Local path: snapshot-version and publish this suite's roots ourselves.
  const tag = 'softwarefactory-e2e-test';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'mastra-softwarefactory-registry'));
  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  project.provide('tag', tag);
  project.provide('registry', registry.toString());

  await publishPackages(await getSuitePublishFilters(rootDir, 'softwarefactory'), tag, rootDir, registry);

  return async () => {
    await teardown();
    registry.kill();
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
  }
}
