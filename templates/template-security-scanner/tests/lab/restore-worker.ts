import { loadSettings } from '../../src/config/settings.js';
import { restoreBackup } from '../../src/runtime/operations.js';
const [root, name] = process.argv.slice(2);
if (!root || !name) throw new Error('RESTORE_WORKER_INPUT');
try {
  await restoreBackup(loadSettings({}, root), name, async stage => {
    process.send?.({ stage });
    if (stage === 'APPLICATION_SWAPPED') await new Promise<void>(() => {});
  });
  process.exitCode = 0;
} catch {
  process.send?.({ error: 'RESTORE_WORKER_FAILED' });
  process.exitCode = 1;
}
