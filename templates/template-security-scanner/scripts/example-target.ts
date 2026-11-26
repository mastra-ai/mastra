import { loadSettings } from '../src/config/settings.js';
import { initializeExampleData } from '../example-target-api/store.js';
import { startExampleTransport } from '../example-target-api/transport.js';

const mode =
  process.argv[2] === '--mode=protected'
    ? 'protected'
    : process.argv[2] === undefined || process.argv[2] === '--mode=vulnerable'
      ? 'vulnerable'
      : null;
if (!mode) throw new Error('EXAMPLE_MODE_INVALID');
const settings = loadSettings({
  ...process.env,
  SCANNER_ENCRYPTION_KEY: undefined,
  CONTROL_BOOTSTRAP_SECRET: undefined,
});
const seed = await initializeExampleData(settings.root);
const runtime = await startExampleTransport(settings, mode);
console.log(
  JSON.stringify({
    mode,
    hostUrl: runtime.baseUrl,
    scannerUrl: runtime.scannerUrl,
    openApiUrl: `${runtime.scannerUrl}/openapi.json`,
    hostOpenApiUrl: `${runtime.baseUrl}/openapi.json`,
    routes: [
      'GET /api/orders',
      'GET /api/orders/{id}',
      'GET /api/orders/{id}/receipt',
      'GET /api/products',
      'GET /openapi.json',
    ],
    users: [
      { label: 'A', id: seed.users[0].id, apiKey: seed.users[0].key },
      { label: 'B', id: seed.users[1].id, apiKey: seed.users[1].key },
    ],
    header: 'x-api-key',
  }),
);
let stopping = false;
let finish!: () => void;
const running = new Promise<void>(resolve => {
  finish = resolve;
});
const keepAlive = setInterval(() => undefined, 60_000);
/** Close the example target once and report a bounded cleanup failure. */
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try {
    await runtime.close();
  } catch {
    console.error(JSON.stringify({ code: 'EXAMPLE_CLEANUP_DEBT' }));
    process.exitCode = 1;
  } finally {
    clearInterval(keepAlive);
    finish();
  }
};
process.once('SIGINT', () => {
  void stop();
});
process.once('SIGTERM', () => {
  void stop();
});
await running;
