import { diagnostic, loadSettings, RuntimeDiagnostic } from '../src/config/settings.js';
import { createBackup, drainOffline, operationStatus, restoreBackup } from '../src/runtime/operations.js';
import { ControlPlaneError } from '../src/core/contracts.js';

try {
  const settings = loadSettings();
  const [command, name, ...extra] = process.argv.slice(2);
  if (
    extra.length ||
    !['status', 'drain', 'backup', 'restore'].includes(command ?? '') ||
    (['backup', 'restore'].includes(command!) ? !name : Boolean(name))
  )
    throw new RuntimeDiagnostic(
      'OPERATION_USAGE',
      'Use operate status, drain, backup <name> or restore <name>. Stop the local server before drain, backup or restore.',
    );
  const result =
    command === 'status'
      ? await operationStatus(settings)
      : command === 'drain'
        ? await drainOffline(settings)
        : command === 'backup'
          ? await createBackup(settings, name!)
          : await restoreBackup(settings, name!);
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify(error instanceof ControlPlaneError ? { code: error.code } : diagnostic(error)));
  process.exitCode = 1;
}
