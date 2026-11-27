import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadSettings } from '../src/config/settings.js';
import { dockerClient, ownerIdentity, OWNER_LABEL } from '../src/runtime/docker.js';
import { DiscoveryStore } from '../src/discovery/store.js';
import { ScanResources } from '../src/discovery/resources.js';
import { z } from 'zod';
import { acquireInstance } from '../src/discovery/instance.js';
import { sourceDigest } from './source-digest.js';

const selectors = new Set([
  'discovery_shutdown_cancels_an_admission_that_was_already_in_progress',
  'discovery_persists_public_role_and_headless_inventory',
  'discovery_blocks_redirect_dns_path_method_and_transport_escape',
  'discovery_bounds_output_isolates_secrets_and_cleans_cancellation',
  'gateway_enforces_policy_before_upstream_contact',
  'gateway_isolates_ca_and_blocks_alternate_egress',
]);
const selected = process.argv[2];
const group = selected === 'discovery' || selected === 'gateway';
if (
  process.argv.length > 3 ||
  (selected && !group && !selectors.has(selected) && selected !== 'headless_preserves_actual_browser_boundary')
)
  throw new Error('UNKNOWN_DISCOVERY_TEST_SELECTOR');
const required = group
  ? [...selectors].filter(name => name.startsWith(`${selected}_`))
  : selected
    ? [selected]
    : [...selectors];
const pattern = group ? `(?:${required.join('|')})$` : selected;
const suites = group
  ? [`tests/${selected}.integration.test.ts`]
  : ['tests/discovery.integration.test.ts', 'tests/gateway.integration.test.ts'];
const settings = loadSettings({}, process.cwd()),
  client = dockerClient(settings),
  runId = randomUUID();
const sourceBefore = await sourceDigest(settings.root);
const files = async () =>
  new Set(
    (await readdir(settings.dataDirectory).catch(() => [])).filter(name => /^discovery-[a-f0-9-]{36}\.db$/.test(name)),
  );
const before = await files();
const started = Date.now(),
  deadlineMs = selected && !group ? 360000 : 900000;
const child = spawn(
  process.execPath,
  [
    join(settings.root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--reporter=json',
    ...suites,
    ...(pattern ? ['-t', pattern] : []),
  ],
  {
    cwd: settings.root,
    detached: true,
    env: { HOME: process.env.HOME, PATH: process.env.PATH, SCANNER_TEST_RUN_ID: runId },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let timedOut = false,
  stdoutBytes = 0,
  stderrBytes = 0;
const output: Buffer[] = [];
/** Kill the owned test process group when the discovery journey times out. */
const stop = () => {
  timedOut = true;
  if (child.pid)
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    }
};
const timer = setTimeout(stop, deadlineMs);
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
// Test diagnostics remain private. The parent emits only fixed outcomes and
// counts, so a failing assertion can never forward a credential to a tool/log.
child.stdout.on('data', (bytes: Buffer) => {
  stdoutBytes += bytes.length;
  if (stdoutBytes > 8 * 1024 * 1024) stop();
  else output.push(bytes);
});
child.stderr.on('data', (bytes: Buffer) => {
  stderrBytes += bytes.length;
  if (stderrBytes > 8 * 1024 * 1024) stop();
});
const exitCode = await new Promise<number | null>(resolve => {
  child.once('close', code => resolve(code));
  child.once('error', () => resolve(null));
});
clearTimeout(timer);
process.removeListener('SIGTERM', stop);
process.removeListener('SIGINT', stop);
let cleanupComplete = true;
if (timedOut || exitCode !== 0) {
  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquireInstance(settings);
    for (const name of await files()) {
      if (before.has(name)) continue;
      const local = loadSettings({ DATABASE_URL: `file:./data/${name}` }, settings.root),
        store = new DiscoveryStore(local.databaseUrl);
      try {
        for (const scan of await store.interrupted())
          cleanupComplete = (await new ScanResources(local, store, scan.id).cleanup()) && cleanupComplete;
      } catch {
        cleanupComplete = false;
      } finally {
        await store.close();
      }
    }
    const fixtures = await client.listContainers({
      all: true,
      filters: { label: [`dev.mastra.security-scanner.test-run=${runId}`] },
    });
    for (const entry of fixtures) {
      const observed = await client.getContainer(entry.Id).inspect(),
        token = observed.Config.Labels?.['dev.mastra.security-scanner.lab'];
      if (
        !token ||
        observed.Name !== `/scanner-lab-${token}` ||
        observed.Config.Labels?.[OWNER_LABEL] !== ownerIdentity(settings) ||
        observed.Image !== observed.Config.Labels?.['dev.mastra.security-scanner.test-image']
      ) {
        cleanupComplete = false;
        continue;
      }
      await client.getContainer(entry.Id).remove({ force: true, v: true });
    }
    const networks = await client.listNetworks({
      filters: { label: [`dev.mastra.security-scanner.test-run=${runId}`] },
    });
    for (const network of networks) {
      const token = network.Labels?.['dev.mastra.security-scanner.lab'];
      if (
        !token ||
        network.Name !== `scanner-lab-${token}` ||
        network.Labels?.[OWNER_LABEL] !== ownerIdentity(settings)
      ) {
        cleanupComplete = false;
        continue;
      }
      await client.getNetwork(network.Id).remove();
    }
  } catch {
    cleanupComplete = false;
  } finally {
    await release?.();
  }
}
const reportSchema = z.object({
  numPassedTests: z.number().int(),
  numFailedTests: z.number().int(),
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
const fixedDiagnostics: string[] = [];
try {
  const report = reportSchema.parse(JSON.parse(Buffer.concat(output).toString()));
  executed = report.numPassedTests + report.numFailedTests;
  failed = report.numFailedTests;
  const assertions = report.testResults.flatMap(result => result.assertionResults);
  selectedPresent =
    required.length > 0 &&
    required.every(name => assertions.some(item => item.title === name && ['passed', 'failed'].includes(item.status)));
  for (const item of assertions)
    for (const message of item.failureMessages ?? []) {
      const cleaned = message.replace(/\x1b\[[0-9;]*m/g, '');
      for (const match of cleaned.matchAll(/SCAN_PHASE_(?:HTTP|HEADLESS)_STAGE_[A-Z_]{1,48}_REASON_[A-Z_]{1,48}/g))
        fixedDiagnostics.push(match[0]);
      for (const match of cleaned.matchAll(
        /GATEWAY_UNIT_FAILED_(?:(?:POLICY|TEST)_\d+_?)+|GATEWAY_UNIT_FAILED_NO_SOURCE|GATEWAY_DISCONNECT_LINE_(?:\d+|UNKNOWN)|EGRESS_[A-Z_]{1,32}/g,
      ))
        fixedDiagnostics.push(match[0]);
      for (const match of cleaned.matchAll(
        /tests\/(gateway\.integration\.test\.ts|discovery\.integration\.test\.ts|lab\/harness\.ts):(\d+):\d+/g,
      ))
        failureLocations.push({ file: `tests/${match[1]}`, line: Number(match[2]) });
    }
} catch {
  selectedPresent = false;
}
const sourceStable = sourceBefore === (await sourceDigest(settings.root));
const passed =
  !timedOut && exitCode === 0 && executed > 0 && selectedPresent && failed === 0 && cleanupComplete && sourceStable;
console.log(
  JSON.stringify({
    status: passed ? 'passed' : 'failed',
    selector: selected ?? 'all',
    sourceDigest: sourceBefore,
    sourceStable,
    deadlineMs,
    elapsedMs: Date.now() - started,
    exitCode,
    timedOut,
    executed,
    failed,
    selectedPresent,
    failureLocations,
    fixedDiagnostics,
    stdoutBytes,
    stderrBytes,
    cleanupComplete,
  }),
);
if (!passed) process.exitCode = 1;
