import type { TestProject } from 'vitest/node';
import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { globby } from 'globby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { startRegistry } from '../_local-registry-setup';
import { publishPackages } from '../_local-registry-setup/publish';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const tag = 'commonjs-e2e-test';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'commonjs-test-registry'));
  console.log('registryLocation', registryLocation);
  console.log('verdaccioPath', verdaccioPath);
  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  console.log('registry', registry.toString());

  project.provide('tag', tag);
  project.provide('registry', registry.toString());

  await publishPackages(
    ['--filter="mastra^..."', '--filter="@mastra/loggers^..."', '--filter="@mastra/loggers"', '--filter="mastra"'],
    tag,
    rootDir,
    registry,
  );

  return () => {
    try {
      teardown();
    } catch {
      // ignore
    }
    try {
      registry.kill();
    } catch {
      // ignore
    }
  };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
  }
}
