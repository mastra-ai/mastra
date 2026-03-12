import { createRequire } from 'node:module';
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

const _require = createRequire(import.meta.url);

export default async function setup(project: TestProject) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const tag = 'workspace-tools-e2e';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = _require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'workspace-tools-registry-'));
  await copyFile(join(__dirname, 'verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  project.provide('tag', tag);
  project.provide('registry', registry.toString());

  // Only need @mastra/core and its dependencies
  await publishPackages(['--filter="@mastra/core^..."', '--filter="@mastra/core"'], tag, rootDir, registry);

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
