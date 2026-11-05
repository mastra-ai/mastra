import { diagnostic, loadSettings } from '../src/config/settings.js';
import { startControlPlane } from '../src/http/server.js';
import { readExampleBoundary } from '../example-target-api/transport.js';
import { preflight } from '../src/runtime/docker.js';

try {
  const settings = loadSettings();
  await preflight(settings);
  const boundary = await readExampleBoundary(settings);
  const runtime = await startControlPlane(settings, settings.PORT, undefined, boundary);
  console.log(`Local API: ${runtime.url}/api/runtime`);
  let stopping = false;
  /** Close the local control plane once and report a bounded shutdown diagnostic. */
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    try {
      await runtime.close();
    } catch (error) {
      console.error(JSON.stringify(diagnostic(error)));
      process.exitCode = 1;
    }
  };
  process.once('SIGINT', () => {
    void stop();
  });
  process.once('SIGTERM', () => {
    void stop();
  });
} catch (error) {
  console.error(JSON.stringify(diagnostic(error)));
  process.exitCode = 1;
}
