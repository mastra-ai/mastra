import type { TestProject } from 'vitest/node';
import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { globby } from 'globby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { startRegistry } from '../_local-registry-setup';
import { publishPackages } from '../_local-registry-setup/publish';

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const tag = 'workspace-compat-e2e';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'workspace-compat-registry'));
  console.log('registryLocation', registryLocation);
  console.log('verdaccioPath', verdaccioPath);
  // Use custom verdaccio config that allows proxying @mastra packages to npm
  // This lets us test with old npm versions alongside locally published versions
  await copyFile(join(__dirname, 'verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  console.log('registry', registry.toString());

  project.provide('tag', tag);
  project.provide('registry', registry.toString());
  project.provide('rootDir', rootDir);

  // Publish core, client-js, and playground-ui (with workspace v1 support)
  await publishPackages(
    [
      '--filter="@mastra/core^..."',
      '--filter="@mastra/core"',
      '--filter="@mastra/client-js"',
      '--filter="@mastra/playground-ui"',
      '--filter="@mastra/react"',
      '--filter="@mastra/schema-compat"',
    ],
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
    rootDir: string;
  }
}
