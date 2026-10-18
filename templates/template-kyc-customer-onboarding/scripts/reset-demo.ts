import { loadConfig } from '../src/config/load-config.js';
import { resetConfirmation, resetDemoData } from '../src/storage/demo-reset.js';

const confirmation = process.argv.find(argument => argument.startsWith('--confirm='))?.slice('--confirm='.length);
const result = await resetDemoData(loadConfig(), confirmation);

if (result.dryRun) {
  process.stdout.write(
    `Dry run only. The following local paths would be removed:\n${result.targets.join('\n')}\n` +
      `Re-run with --confirm=${resetConfirmation} to continue.\n`,
  );
} else {
  process.stdout.write(`Removed ${String(result.targets.length)} configured local data targets.\n`);
}
