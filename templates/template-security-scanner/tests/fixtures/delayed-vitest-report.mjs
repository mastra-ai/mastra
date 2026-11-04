import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// Keep stdout open after the reporting process exits, then deliver its final bytes.
if (process.argv[2] === '--tail') {
  setTimeout(() => process.stdout.write(process.argv[3]), 200);
} else {
  const operations = process.argv.includes('tests/operations.integration.test.ts');
  const title = operations
    ? 'documented_setup_and_complete_p0_lab_matrix'
    : 'headless_preserves_actual_browser_boundary';
  const report = JSON.stringify({
    numPassedTests: 1,
    numFailedTests: 0,
    testResults: [{ assertionResults: [{ title, status: 'passed' }] }],
  });
  if (operations) writeFileSync(process.argv[process.argv.indexOf('--outputFile') + 1], report);
  const output = operations ? 'OPERATIONS_MATRIX_RECORD {"case":"trailing-proof"}\n' : report;
  const split = Math.floor(output.length / 2);
  process.stdout.write(output.slice(0, split));
  const tail = spawn(process.execPath, [process.argv[1], '--tail', output.slice(split)], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  tail.unref();
}
