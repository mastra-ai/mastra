import { diagnostic, loadSettings, morphModelConfiguration } from '../src/config/settings.js';
import { preflight } from '../src/runtime/docker.js';

try {
  const settings = loadSettings();
  const environment = await preflight(settings);
  console.log(
    JSON.stringify(
      {
        status: 'prerequisites-ready',
        ...environment,
        models: morphModelConfiguration(settings),
        scanningEnabled: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
}
