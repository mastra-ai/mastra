import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chmod, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { sourceDigest } from './source-digest.js';

const names = [
  'documented_setup_and_complete_p0_lab_matrix',
  'crash_cleanup_shared_images_and_rollback_preserve_unrelated_resources',
  'telemetry_and_all_output_surfaces_preserve_secret_and_evidence_contracts',
  'explicit_retention_and_key_loss_protect_real_target_data',
];
const selected = process.argv[2];
if (process.argv.length > 3 || (selected && !names.includes(selected))) throw new Error('UNKNOWN_OPERATIONS_SELECTOR');
const required = selected ? [selected] : names;
const root = process.cwd(),
  before = await sourceDigest(root),
  started = Date.now();
const directory = await mkdtemp(join(tmpdir(), 'scanner-operations-report-'));
await chmod(directory, 0o700);
const reportPath = join(directory, 'report.json');
const child = spawn(
  process.execPath,
  [
    join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    'tests/operations.integration.test.ts',
    '--reporter=json',
    '--disableConsoleIntercept',
    '--outputFile',
    reportPath,
    ...(selected ? ['-t', `^${selected}$`] : []),
  ],
  {
    cwd: root,
    detached: true,
    env: { HOME: process.env.HOME, PATH: process.env.PATH, SCANNER_TEST_RUN_ID: randomUUID() },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let timedOut = false,
  stdoutBytes = 0,
  stderrBytes = 0;
const chunks: Buffer[] = [];
/** Kill the owned test process group when the operations journey times out. */
const stop = () => {
  timedOut = true;
  if (child.pid)
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
};
const timer = setTimeout(stop, 3600000);
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
child.stdout.on('data', (chunk: Buffer) => {
  stdoutBytes += chunk.length;
  if (stdoutBytes > 8388608) stop();
  else chunks.push(chunk);
});
child.stderr.on('data', (chunk: Buffer) => {
  stderrBytes += chunk.length;
  if (stderrBytes > 8388608) stop();
});
const exitCode = await new Promise<number | null>(resolve => {
  child.once('close', code => resolve(code));
  child.once('error', () => resolve(null));
});
clearTimeout(timer);
process.removeListener('SIGINT', stop);
process.removeListener('SIGTERM', stop);
const reportSchema = z.object({
  testResults: z.array(
    z.object({
      assertionResults: z.array(
        z.object({ title: z.string(), status: z.string(), failureMessages: z.array(z.string()).optional() }),
      ),
    }),
  ),
});
let executed = 0,
  failed = 0,
  selectedPresent = false;
const failureLocations: Array<{ file: string; line: number }> = [];
try {
  if ((await stat(reportPath)).size > 8388608) throw new Error('OPERATIONS_REPORT_BOUND');
  await chmod(reportPath, 0o600);
  const report = reportSchema.parse(JSON.parse(await readFile(reportPath, 'utf8')));
  const assertions = report.testResults.flatMap(item => item.assertionResults);
  executed = assertions.filter(item => item.status === 'passed' || item.status === 'failed').length;
  failed = assertions.filter(item => item.status === 'failed').length;
  selectedPresent = required.every(name => assertions.some(item => item.title === name && item.status === 'passed'));
  for (const item of assertions)
    for (const message of item.failureMessages ?? [])
      for (const match of message.matchAll(/(?:tests|src|scripts)\/[A-Za-z0-9_./-]+\.ts:(\d+):\d+/g)) {
        const location = match[0].split(':');
        failureLocations.push({ file: location[0]!, line: Number(match[1]) });
      }
} catch {
  selectedPresent = false;
} finally {
  await rm(directory, { recursive: true, force: true });
}
const sourceStable = before === (await sourceDigest(root));
const passed =
  !timedOut && exitCode === 0 && executed === required.length && failed === 0 && selectedPresent && sourceStable;
// Only structured proof records from successful test bodies leave the private
// child-output buffer. Raw assertions, stderr and model responses never do.
if (passed) {
  for (const line of Buffer.concat(chunks).toString().split('\n')) {
    const match = /^OPERATIONS_(MATRIX_RECORD|CLEAN_SETUP|OUTPUT_AUDIT|LEGACY_IMAGE_RECORD) (\{.*\})$/.exec(line);
    if (!match || Buffer.byteLength(match[2]!) > 65536) continue;
    const value: unknown = JSON.parse(match[2]!);
    console.log(`OPERATIONS_${match[1]} ${JSON.stringify(value)}`);
  }
}
console.log(
  JSON.stringify({
    status: passed ? 'passed' : 'failed',
    selector: selected ?? 'all',
    sourceDigest: before,
    sourceStable,
    deadlineMs: 3600000,
    elapsedMs: Date.now() - started,
    exitCode,
    timedOut,
    executed,
    failed,
    selectedPresent,
    failureLocations,
    stdoutBytes,
    stderrBytes,
    cleanupRequired: timedOut || exitCode !== 0,
  }),
);
if (!passed) process.exitCode = 1;
