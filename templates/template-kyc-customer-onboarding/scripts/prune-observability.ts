import { loadConfig } from '../src/config/load-config.js';
import { initializeStorage } from '../src/storage/initialize-storage.js';
import { runBoundedRetentionPrune } from '../src/storage/retention.js';

const storage = await initializeStorage(loadConfig(), { pruneOnStartup: false });
try {
  const results = await runBoundedRetentionPrune(storage.mastra);
  process.stdout.write(`${JSON.stringify({ bounded: true, results }, null, 2)}\n`);
} finally {
  storage.close();
}
