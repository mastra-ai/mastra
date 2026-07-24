/**
 * Manual smoke — end-to-end verification that when a `Mastra` with
 * `observability` configured owns a workspace backed by real `LocalFilesystem`
 * + `LocalSandbox`, every wrapped call fans out to all four observability
 * hooks with correlated traceId / spanId across signals.
 *
 * Prints a compact report and exits non-zero on any failed assertion.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Mastra } from '@mastra/core';
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core/workspace';
import { Observability } from '@mastra/observability';

// ---------------------------------------------------------------------------
// Capture: implement ALL four hooks on a single ObservabilityExporter shim.
// ---------------------------------------------------------------------------

const captured = {
  tracing: [],
  logs: [],
  metrics: [],
  activity: [],
};

const captureExporter = {
  name: 'smoke-capture-exporter',
  exportTracingEvent: async () => {},
  flush: async () => {},
  shutdown: async () => {},
  onTracingEvent: (event) => {
    captured.tracing.push(event);
  },
  onLogEvent: (event) => {
    captured.logs.push(event);
  },
  onMetricEvent: (event) => {
    captured.metrics.push(event);
  },
  onWorkspaceActivityEvent: (event) => {
    captured.activity.push(event);
  },
};

// ---------------------------------------------------------------------------
// Setup: Mastra with Observability instance registered, LocalFilesystem +
// LocalSandbox workspace, workingDirectory pointed at a per-run temp dir.
// ---------------------------------------------------------------------------

const workDir = mkdtempSync(join(tmpdir(), 'ws-obs-smoke-'));
process.stdout.write(`workDir: ${workDir}\n`);

const observability = new Observability({
  configs: {
    default: {
      serviceName: 'mastra-workspace-obs-smoke',
      exporters: [captureExporter],
      // Default minLevel is 'warn'; explicitly enable info so the wrapper's
      // success-path structured logs (`workspace.filesystem.writeFile`, etc.)
      // are exported and this smoke can assert on them.
      logging: { level: 'info' },
    },
  },
});

const workspace = new Workspace({
  id: 'smoke-ws',
  name: 'smoke-workspace',
  filesystem: new LocalFilesystem({ basePath: workDir }),
  sandbox: new LocalSandbox({ workingDirectory: workDir }),
});

const mastra = new Mastra({
  logger: false,
  observability,
});
mastra.addWorkspace(workspace);

// ---------------------------------------------------------------------------
// Exercise: writeFile → readFile → executeCommand.
// ---------------------------------------------------------------------------

const fs = workspace.filesystem;
const sb = workspace.sandbox;

process.stdout.write(`fs is Proxy (wrapped): ${fs !== workspace._fs}\n`);
process.stdout.write(`sb is Proxy (wrapped): ${sb !== workspace._sandbox}\n`);

// Direct calls — no ambient span. The wrapper is expected to open its own root
// workspace:{filesystem|sandbox}:<op> span per call and correlate metrics,
// logs, and activity events against it.
await fs.writeFile('smoke.txt', 'hi');
await fs.readFile('smoke.txt');
const exec = await sb.executeCommand('echo hello');
process.stdout.write(`exec.exitCode=${exec.exitCode} exec.stdout=${JSON.stringify(exec.stdout)}\n`);

await observability.flush();
await observability.shutdown();

// ---------------------------------------------------------------------------
// Report + assertions.
// ---------------------------------------------------------------------------

process.stdout.write('\n=== Captured counts ===\n');
process.stdout.write(`  tracing:  ${captured.tracing.length}\n`);
process.stdout.write(`  logs:     ${captured.logs.length}\n`);
process.stdout.write(`  metrics:  ${captured.metrics.length}\n`);
process.stdout.write(`  activity: ${captured.activity.length}\n`);

const failures = [];

// All four hooks fired.
if (captured.tracing.length === 0) failures.push('no tracing events captured');
if (captured.logs.length === 0) failures.push('no log events captured');
if (captured.metrics.length === 0) failures.push('no metric events captured');
if (captured.activity.length === 0) failures.push('no workspace_activity events captured');

// filesystem_change: EXACTLY one for the write, and none for the read.
const fsChanges = captured.activity.filter((e) => e.type === 'filesystem_change');
const writeEvents = fsChanges.filter((e) => e.change.operation === 'write');
const readEvents = fsChanges.filter((e) => e.change.operation === 'read');
if (writeEvents.length !== 1) failures.push(`expected 1 filesystem_change{write}, got ${writeEvents.length}`);
if (readEvents.length !== 0) failures.push(`expected 0 filesystem_change events for read, got ${readEvents.length}`);

// sandbox_output: at least one stdout event carrying "hello" from `echo hello`.
const sandboxOutputs = captured.activity.filter((e) => e.type === 'sandbox_output');
const stdoutEvents = sandboxOutputs.filter((e) => e.output.stream === 'stdout' && e.output.source === 'exec');
if (stdoutEvents.length < 1) failures.push(`expected >=1 sandbox_output{stdout,exec}, got ${stdoutEvents.length}`);
if (stdoutEvents.length > 0 && !stdoutEvents[0].output.chunk.includes('hello')) {
  failures.push(`sandbox_output stdout chunk did not include 'hello': ${JSON.stringify(stdoutEvents[0].output.chunk)}`);
}

// Cross-signal correlation: pick the writeFile activity event and verify at
// least one metric / log / span shares the same traceId (or spanId when
// available).
const writeEvent = writeEvents[0];
if (writeEvent) {
  const traceId = writeEvent.change.traceId;
  const spanId = writeEvent.change.spanId;
  process.stdout.write(`\n=== writeFile correlation ===\n`);
  process.stdout.write(`  traceId=${traceId ?? '<none>'} spanId=${spanId ?? '<none>'}\n`);

  const spanMatch = captured.tracing.find(
    (t) => t.exportedSpan?.traceId === traceId || t.exportedSpan?.id === spanId,
  );
  const metricMatch = captured.metrics.find(
    (m) => m.metric?.traceId === traceId || m.metric?.spanId === spanId,
  );
  const logMatch = captured.logs.find(
    (l) => l.log?.traceId === traceId || l.log?.spanId === spanId,
  );

  process.stdout.write(`  span match:   ${spanMatch ? spanMatch.exportedSpan.name : '<none>'}\n`);
  process.stdout.write(`  metric match: ${metricMatch ? metricMatch.metric.name : '<none>'}\n`);
  process.stdout.write(`  log match:    ${logMatch ? logMatch.log.message : '<none>'}\n`);

  if (traceId || spanId) {
    if (!spanMatch) failures.push('no tracing event correlated with writeFile activity event');
    if (!metricMatch) failures.push('no metric correlated with writeFile activity event');
    if (!logMatch) failures.push('no log correlated with writeFile activity event');
  } else {
    process.stdout.write(`  (writeFile ran outside an active trace context — correlation ids optional)\n`);
  }
}

// Print names of first few captured items to aid debugging.
process.stdout.write('\n=== Sample capture ===\n');
process.stdout.write(`  first span:   ${captured.tracing[0]?.exportedSpan?.name ?? '<none>'}\n`);
process.stdout.write(`  first metric: ${captured.metrics[0]?.metric?.name ?? '<none>'}\n`);
process.stdout.write(`  first log:    ${captured.logs[0]?.log?.message ?? '<none>'}\n`);
process.stdout.write(`  first activity: ${captured.activity[0]?.type ?? '<none>'}\n`);

// ---------------------------------------------------------------------------
// Cleanup + exit.
// ---------------------------------------------------------------------------

rmSync(workDir, { recursive: true, force: true });

if (failures.length > 0) {
  process.stdout.write('\n=== FAILED ===\n');
  for (const f of failures) process.stdout.write(`  - ${f}\n`);
  process.exit(1);
}

process.stdout.write('\n=== SMOKE PASSED ===\n');
process.exit(0);
