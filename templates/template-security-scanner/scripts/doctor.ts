import { diagnostic, loadSettings, morphModelConfiguration } from '../src/config/settings.js';
import { preflight } from '../src/runtime/docker.js';
import { requireDiscoveryCapability } from '../src/discovery/capability.js';

try {
  const settings = loadSettings();
  const environment = await preflight(settings);
  const discovery = settings.SCANNER_DISCOVERY_ENABLED ? await requireDiscoveryCapability(settings, 'http') : undefined;
  console.log(
    JSON.stringify(
      {
        status: 'prerequisites-ready',
        ...environment,
        models: morphModelConfiguration(settings),
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
