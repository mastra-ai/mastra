import { prepareMonorepo } from '../_local-registry-setup/prepare.js';
import { globby } from 'globby';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { copyFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'module';
import { startRegistry } from '../_local-registry-setup/index.js';
import { publishPackages } from '../_local-registry-setup/publish.js';

const require = createRequire(import.meta.url);

export default async function setup() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const tag = 'kitchen-sink-e2e-test';
  const teardown = await prepareMonorepo(rootDir, globby, tag);

  const verdaccioPath = require.resolve('verdaccio/bin/verdaccio');
  const port = await getPort();
  const registryLocation = await mkdtemp(join(tmpdir(), 'kitchen-sink-test-registry'));

  await copyFile(join(__dirname, '../_local-registry-setup/verdaccio.yaml'), join(registryLocation, 'verdaccio.yaml'));
  const registry = await startRegistry(verdaccioPath, port, registryLocation);

  console.log('[Setup] Registry started at ', registry.toString());

  console.log('[Setup] Publishing packages');

  const packages = [
    'mastra',
    '@mastra/loggers',
    '@mastra/playground-ui',
    '@mastra/memory',
    '@mastra/libsql',
    '@mastra/mcp',
  ];
  const publishFilterArgs = packages.map(p => [`--filter="${p}^..."`, `--filter="${p}"`]).flat();

  publishPackages(publishFilterArgs, tag, rootDir, registry);

  console.log('[Setup] Published packages', { publishFilterArgs, tag, rootDir });

  const shutdown = () => {
    teardown();

    try {
      registry.kill();
    } catch {
      // ignore
    }
  };

  return { shutdown, registryUrl: registry.toString() };
}

declare module 'vitest' {
  export interface ProvidedContext {
    tag: string;
    registry: string;
  }
}
