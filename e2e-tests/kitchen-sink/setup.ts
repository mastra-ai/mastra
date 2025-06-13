import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { globby } from 'globby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { startRegistry } from '../_local-registry-setup/index.js';
import { publishPackages } from '../_local-registry-setup/publish.js';

export default async function setup() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const teardown = await prepareMonorepo(rootDir, globby);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'kitchen-sink-test-registry'));
  console.log('registryLocation', registryLocation);
  console.log('verdaccioPath', verdaccioPath);
  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  console.log('registry', registry.toString());

  const tag = 'kitchen-sink-e2e-test';
  global.tag = tag;
  global.registry = registry.toString();
  process.env.npm_config_registry = registry.toString();

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
