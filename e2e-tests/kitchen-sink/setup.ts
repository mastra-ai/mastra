import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import { startRegistry, type Registry } from '../_shared/setup/registry.js';
import { prepareSnapshotVersions, publishPackages, restoreGitFiles } from '../_shared/setup/snapshot.js';

// Packages needed for kitchen-sink tests
const KITCHEN_SINK_PACKAGES = [
  '@mastra/core',
  'mastra',
  '@mastra/loggers',
  '@mastra/playground-ui',
  '@mastra/memory',
  '@mastra/libsql',
  '@mastra/mcp',
];

export default async function setup() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const rootDir = join(__dirname, '..', '..');
  const tag = 'kitchen-sink-e2e-test';

  console.log('[Kitchen Sink Setup] __dirname:', __dirname);
  console.log('[Kitchen Sink Setup] rootDir:', rootDir);

  // Prepare snapshot versions
  console.log('[Kitchen Sink Setup] Preparing snapshot versions...');
  const { cleanup: snapshotCleanup } = await prepareSnapshotVersions({ rootDir, tag }, KITCHEN_SINK_PACKAGES);

  // Start registry
  const port = await getPort();
  console.log('[Kitchen Sink Setup] Starting registry on port', port);
  const registry = await startRegistry(port);
  console.log('[Kitchen Sink Setup] Registry started at', registry.url);

  // Publish packages
  console.log('[Kitchen Sink Setup] Publishing packages...');
  const publishFilters = KITCHEN_SINK_PACKAGES.flatMap(pkg => [`--filter="${pkg}^..."`, `--filter="${pkg}"`]);
  publishPackages(publishFilters, tag, rootDir, registry.url);
  console.log('[Kitchen Sink Setup] Packages published');

  const shutdown = async () => {
    console.log('[Kitchen Sink Setup] Shutting down...');
    try {
      registry.stop();
    } catch {
      // ignore
    }
    await snapshotCleanup();
    restoreGitFiles(rootDir);
  };

  return { shutdown, registryUrl: registry.url };
}
