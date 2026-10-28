import { diagnostic, loadSettings } from '../src/config/settings.js';
import { startLocalServer } from '../src/http/server.js';

try {
  const runtime = await startLocalServer(loadSettings());
  console.log(`Runtime diagnostics: ${runtime.url}/api/runtime`);
  let stopping = false;
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
