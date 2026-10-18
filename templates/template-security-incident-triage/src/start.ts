import { validateStartupConfiguration } from './config/startup.js';
import { startServerRuntime } from './workers/runtime.js';

validateStartupConfiguration();

const runtime = await startServerRuntime();
console.log(`Hono server listening on http://localhost:${runtime.port}`);

let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  await runtime.stop();
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);
