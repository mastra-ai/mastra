import { createHash, randomUUID } from 'node:crypto';
import { runCommand, type CommandResult } from './command.js';
import type { ExperimentWorkerManifest } from './inspect-manifest.js';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ProtocolEvent = { type: string; sequence: number; [key: string]: unknown };

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

export function createRunRequest(manifest: ExperimentWorkerManifest, targetId = 'minimal-agent') {
  const items = [{ id: 'item-1', input: 'hello', toolMocks: [] }] satisfies JsonValue[];
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
      target: { type: 'agent', id: targetId },
      dataset: { itemCount: items.length, digest, canonicalizationVersion: '1', items },
      scorers: [],
      limits: { concurrency: 1, timeoutMs: 10_000 },
      policies: { allowedToolIds: [], allowedNetworkHosts: [] },
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

export async function runProtocol(artifactRoot: string, manifest: ExperimentWorkerManifest) {
  const request = createRunRequest(manifest);
  const result = await runCommand(manifest.launch.executable, manifest.launch.arguments, {
    cwd: artifactRoot,
    timeoutMs: 90_000,
    env: minimalWorkerEnvironment(),
    stdin: `${JSON.stringify(request)}\n`,
  });
  const events = parseProtocolOutput(result.stdout);
  assertSuccessfulProtocol(result, events);
  return { result, events, request };
}

function assertSuccessfulProtocol(result: CommandResult, events: ProtocolEvent[]) {
  if (result.timedOut || result.exitCode !== 0) {
    throw new Error(`Worker failed: exit=${result.exitCode} signal=${result.signal}\n${result.stderr}`);
  }
  const types = events.map(event => event.type);
  const expected = ['accepted', 'run-started', 'item-completed', 'terminal'];
  if (JSON.stringify(types) !== JSON.stringify(expected)) {
    throw new Error(`Unexpected protocol events: ${types.join(', ')}`);
  }
}

function minimalWorkerEnvironment(): NodeJS.ProcessEnv {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'SystemRoot', 'WINDIR', 'NODE_OPTIONS'];
  return Object.fromEntries(
    allowed.flatMap(key => (process.env[key] ? ([[key, process.env[key]]] as Array<[string, string]>) : [])),
  );
}
