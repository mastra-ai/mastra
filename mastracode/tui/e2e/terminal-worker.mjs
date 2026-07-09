import { parentPort, workerData } from 'node:worker_threads';
import { tsImport } from 'tsx/esm/api';

async function main() {
  try {
    process.stderr.write(`[mc-e2e:terminal-worker] loading ${workerData.config?.scenarioName ?? 'unknown'}\n`);
    const { runTerminalBackend } = await tsImport('./terminal-backend.ts', import.meta.url);
    process.stderr.write(`[mc-e2e:terminal-worker] running ${workerData.config?.scenarioName ?? 'unknown'}\n`);
    const status = await runTerminalBackend(workerData.config);
    process.stderr.write(
      `[mc-e2e:terminal-worker] done ${workerData.config?.scenarioName ?? 'unknown'} status=${status}\n`,
    );
    parentPort?.postMessage({ status });
  } catch (error) {
    parentPort?.postMessage({
      status: 1,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    });
  }
}

await main();
