import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { killProcessGroup, runCommand } from './command.js';
import type { ExperimentWorkerManifest } from './inspect-manifest.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ProtocolEvent = { type: string; sequence: number; payload?: unknown; [key: string]: unknown };

function canonicalize(value: JsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function createRunRequest(
  manifest: ExperimentWorkerManifest,
  options: {
    targetId?: string;
    targetType?: 'agent' | 'workflow';
    items?: JsonValue[];
    scorers?: Array<{ id: string; version: string }>;
    allowedToolIds?: string[];
    timeoutMs?: number;
    concurrency?: number;
  } = {},
) {
  const items = options.items ?? ([{ id: 'item-1', input: 'hello', toolMocks: [] }] satisfies JsonValue[]);
  const digest = createHash('sha256').update(canonicalize(items)).digest('hex');
  const experimentId = `e2e-${randomUUID()}`;
  return {
    type: 'run',
    protocolVersion: '1',
    supportedProtocolVersions: ['1'],
    experimentId,
    jobId: `${experimentId}-job`,
    attempt: 1,
    idempotencyKey: `${experimentId}-attempt-1`,
    deadlineAt: new Date(Date.now() + 60_000).toISOString(),
    datasetAttestation: { itemCount: items.length, digest, canonicalizationVersion: '1' },
    packet: {
      protocolVersion: '1',
      experimentId,
      tenant: {},
      environment: {},
      artifacts: { buildId: manifest.build.buildId },
      target: { type: options.targetType ?? 'agent', id: options.targetId ?? 'minimal-agent' },
      dataset: { itemCount: items.length, digest, canonicalizationVersion: '1', items },
      scorers: options.scorers ?? [],
      limits: { concurrency: options.concurrency ?? 1, timeoutMs: options.timeoutMs ?? 10_000 },
      policies: { allowedToolIds: options.allowedToolIds ?? [], allowedNetworkHosts: [] },
      secretReferences: [],
    },
  };
}

export function parseProtocolOutput(stdout: string) {
  if (!stdout.endsWith('\n')) throw new Error('Protocol stdout is missing its final newline');
  const lines = stdout.slice(0, -1).split('\n');
  const events = lines.map((line, index) => {
    try {
      return JSON.parse(line) as ProtocolEvent;
    } catch {
      throw new Error(`Non-protocol stdout at line ${index + 1}: ${line}`);
    }
  });
  events.forEach((event, index) => {
    if (event.sequence !== index) throw new Error(`Non-contiguous protocol sequence at event ${index}`);
  });
  return events;
}

export async function runProtocol(
  artifactRoot: string,
  manifest: ExperimentWorkerManifest,
  request = createRunRequest(manifest),
  expectedExitCode = 0,
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
) {
  const result = await runCommand(manifest.launch.executable, manifest.launch.arguments, {
    cwd: artifactRoot,
    timeoutMs: options.timeoutMs ?? 90_000,
    env: { ...minimalWorkerEnvironment(), ...options.env },
    stdin: `${JSON.stringify(request)}\n`,
  });
  if (result.timedOut || result.exitCode !== expectedExitCode) {
    throw new Error(
      `Worker exit mismatch: expected=${expectedExitCode} actual=${result.exitCode} signal=${result.signal}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
  }
  const events = parseProtocolOutput(result.stdout);
  assertProtocolResult(events, expectedExitCode);
  return { result, events, request };
}

function assertProtocolResult(events: ProtocolEvent[], expectedExitCode: number) {
  if (events[0]?.type !== 'accepted' || events.at(-1)?.type !== 'terminal') {
    throw new Error(`Unexpected protocol boundaries: ${events.map(event => event.type).join(', ')}`);
  }
  if (expectedExitCode === 0) {
    const types = events.map(event => event.type);
    const valid =
      types[0] === 'accepted' &&
      types[1] === 'run-started' &&
      types.at(-1) === 'terminal' &&
      types.slice(2, -1).length > 0 &&
      types.slice(2, -1).every(type => type === 'item-completed');
    if (!valid) throw new Error(`Unexpected protocol events: ${types.join(', ')}`);
  }
}

export function createCancelFrame(request: ReturnType<typeof createRunRequest>, reason: string) {
  return {
    type: 'cancel',
    protocolVersion: '1',
    experimentId: request.experimentId,
    jobId: request.jobId,
    attempt: request.attempt,
    idempotencyKey: request.idempotencyKey,
    requestedAt: new Date().toISOString(),
    reason,
  };
}

/**
 * Launches the copied worker, waits until the run has started (and until the
 * optional `readyWhen` predicate reports the in-flight item reached the state
 * under test), then delivers a protocol cancel frame while the target item is
 * still in flight.
 */
export async function runCancelledProtocol(
  artifactRoot: string,
  manifest: ExperimentWorkerManifest,
  request: ReturnType<typeof createRunRequest>,
  options: { cancelAfterEventType?: string; timeoutMs?: number; readyWhen?: () => Promise<boolean> } = {},
) {
  const cancelAfter = options.cancelAfterEventType ?? 'run-started';
  const startedAt = Date.now();
  const child = spawn(manifest.launch.executable, manifest.launch.arguments, {
    cwd: artifactRoot,
    env: minimalWorkerEnvironment(),
    detached: process.platform !== 'win32',
    stdio: 'pipe',
  });
  let stdout = '';
  let stderr = '';
  let cancelSent = false;
  let cancelPending = false;
  const sendCancel = () => {
    cancelSent = true;
    child.stdin.end(`${JSON.stringify(createCancelFrame(request, 'cancelled by e2e test'))}\n`);
  };
  const sendCancelWhenReady = async () => {
    while (child.exitCode === null && !(await options.readyWhen!())) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (child.exitCode === null) sendCancel();
  };
  child.stderr.setEncoding('utf8').on('data', chunk => (stderr += chunk));
  child.stdout.setEncoding('utf8').on('data', chunk => {
    stdout += chunk;
    if (cancelSent || cancelPending) return;
    for (const line of stdout.split('\n')) {
      if (!line) continue;
      try {
        const event = JSON.parse(line) as ProtocolEvent;
        if (event.type === cancelAfter) {
          cancelPending = true;
          if (options.readyWhen) void sendCancelWhenReady();
          else sendCancel();
          return;
        }
      } catch {
        // Ignore partial lines; parseProtocolOutput validates the final transcript.
      }
    }
  });
  child.stdin.write(`${JSON.stringify(request)}\n`);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    killProcessGroup(child.pid);
  }, options.timeoutMs ?? 90_000);
  timeout.unref();
  const { exitCode, signal } = await new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>(
    resolve => {
      child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
    },
  );
  clearTimeout(timeout);

  if (timedOut || !cancelSent || exitCode !== 30) {
    throw new Error(
      `Cancelled worker mismatch: cancelSent=${cancelSent} timedOut=${timedOut} exit=${exitCode} signal=${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
    );
  }
  const events = parseProtocolOutput(stdout);
  return { events, stdout, stderr, exitCode, durationMs: Date.now() - startedAt };
}

export function minimalWorkerEnvironment(): NodeJS.ProcessEnv {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR', 'NODE_OPTIONS'];
  return Object.fromEntries(
    allowed.flatMap(key => (process.env[key] ? ([[key, process.env[key]]] as Array<[string, string]>) : [])),
  );
}
