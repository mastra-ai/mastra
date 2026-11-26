import { diagnostic, loadSettings, morphModelDescriptor } from '../src/config/settings.js';
import { preflight } from '../src/runtime/docker.js';
import { requireDiscoveryCapability } from '../src/discovery/capability.js';
import { inspectStorageFiles } from '../src/runtime/storage-files.js';

try {
  const settings = loadSettings();
  const environment = await preflight(settings);
  const storage = await inspectStorageFiles(settings);
  const discovery = settings.SCANNER_DISCOVERY_ENABLED ? await requireDiscoveryCapability(settings, 'http') : undefined;
  console.log(
    JSON.stringify(
      {
        status: 'prerequisites-ready',
        ...environment,
        storage,
        models: morphModelDescriptor(settings),
        scanningEnabled: settings.SCANNER_DISCOVERY_ENABLED && Boolean(discovery),
        admission: discovery
          ? 'operator-enabled; every scan still revalidates scope, identities and runtime'
          : 'disabled',
        discovery: discovery ?? { status: 'disabled' },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
}
