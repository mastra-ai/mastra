import { runRetentionCommand } from '../src/db/retention-command.js';

try {
  const result = await runRetentionCommand(process.argv.slice(2));
  console.log(JSON.stringify(result));
} catch {
  process.stderr.write('RETENTION_COMMAND_FAILED\n');
  process.exitCode = 1;
}
