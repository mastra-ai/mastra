import { join } from 'node:path';
import { getSharedRegistryPublishFilters } from './publish-roots.js';
import { createPublishedRegistry } from './registry.js';

const rootDir = process.env.MASTRA_E2E_ROOT_DIR || join(import.meta.dirname, '..', '..');
const registryRoot =
  process.env.MASTRA_E2E_REGISTRY_DIR || join(process.env.RUNNER_TEMP || '/tmp', 'mastra-e2e-registry');
const port = Number(process.env.MASTRA_E2E_REGISTRY_PORT || 4873);

const metadata = await createPublishedRegistry({
  rootDir,
  port,
  configPath: process.env.MASTRA_E2E_REGISTRY_CONFIG || join(registryRoot, 'verdaccio.yaml'),
  storageDir: process.env.MASTRA_E2E_REGISTRY_STORAGE || join(registryRoot, 'storage'),
  publishFilters: await getSharedRegistryPublishFilters(rootDir),
});

console.log(`Published E2E registry artifact for ${metadata.tag} at ${metadata.registryUrl}`);
