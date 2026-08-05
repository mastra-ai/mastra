import { join } from 'node:path';
import { getSharedRegistryPublishFilters, getSharedRegistryPublishGroups } from './publish-roots.js';
import { createPublishedRegistry } from './registry.js';

const rootDir = process.env.MASTRA_E2E_ROOT_DIR || join(import.meta.dirname, '..', '..');
const registryRoot =
  process.env.MASTRA_E2E_REGISTRY_DIR || join(process.env.RUNNER_TEMP || '/tmp', 'mastra-e2e-registry');
const tag =
  process.env.MASTRA_E2E_REGISTRY_TAG || `e2e-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}`;
const port = Number(process.env.MASTRA_E2E_REGISTRY_PORT || 4873);
const publishGroups = [
  { tag, publishFilters: await getSharedRegistryPublishFilters(rootDir) },
  ...(await getSharedRegistryPublishGroups(rootDir)),
];

const metadata = await createPublishedRegistry({
  rootDir,
  tag,
  port,
  configPath: process.env.MASTRA_E2E_REGISTRY_CONFIG || join(registryRoot, 'verdaccio.yaml'),
  storageDir: process.env.MASTRA_E2E_REGISTRY_STORAGE || join(registryRoot, 'storage'),
  publishGroups,
});

console.log(`Published E2E registry artifact for ${metadata.tag} at ${metadata.registryUrl}`);
