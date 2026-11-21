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
import { runOrThrow } from '../_local-registry-setup/install.js';
import { E2E_TAG, getSuitePublishFilters } from '../_local-registry-setup/publish-roots.js';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');

  // The template pins its own pnpm via `packageManager`. Each test file's install would otherwise
  // make pnpm download that version into the shared store concurrently, and pnpm names the
  // download dir only by millisecond timestamp, so parallel workers can delete each other's dir
  // (ENOENT on `.tmp/pnpm-<version>-<ms>`). Install it once here, before any worker starts.
  runOrThrow('pnpm', ['--version'], { cwd: join(__dirname, 'template'), env: process.env });

  const publishedRegistryTeardown = await setupPublishedRegistryFromEnv(project);
  if (publishedRegistryTeardown) {
    return publishedRegistryTeardown;
  }

  const tag = E2E_TAG;
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = resolveVerdaccioPath();
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'mastra-monorepo-test-registry'));
  console.log('registryLocation', registryLocation);
  console.log('verdaccioPath', verdaccioPath);
  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  project.provide('tag', tag);
  project.provide('registry', registry.toString());

  await publishPackages(await getSuitePublishFilters(rootDir, 'monorepo'), tag, rootDir, registry);

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
