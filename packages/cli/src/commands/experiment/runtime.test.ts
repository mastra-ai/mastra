import { createHash, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import {
  EXPERIMENT_WORKER_EXIT_CODES,
  EXPERIMENT_WORKER_MAX_FRAME_BYTES,
  runExperimentWorker,
  type ExperimentWorkerBuildIdentity,
} from './runtime';

const build: ExperimentWorkerBuildIdentity = {
  buildId: 'test-build',
  protocolVersion: '1',
  datasetCanonicalizationVersion: '1',
};

function createRequest() {
  const items = [{ id: 'item-1', input: { prompt: 'hello' }, toolMocks: [] }];
  const digest = createHash('sha256').update(canonicalize(items)).digest('hex');
  const experimentId = randomUUID();
  return {
    type: 'run',
    protocolVersion: '1',
    supportedProtocolVersions: ['1'],
    experimentId,
    jobId: randomUUID(),
    attempt: 1,
    idempotencyKey: randomUUID(),
    deadlineAt: new Date(Date.now() + 5_000).toISOString(),
    datasetAttestation: { itemCount: items.length, digest, canonicalizationVersion: '1' },
    packet: {
      protocolVersion: '1',
      experimentId,
      tenant: {},
      environment: {},
      artifacts: { buildId: build.buildId },
      target: { type: 'agent', id: 'test-agent' },
      dataset: { itemCount: items.length, digest, canonicalizationVersion: '1', items },
      scorers: [],
      limits: { concurrency: 1, timeoutMs: 1_000 },
      policies: { allowedToolIds: [], allowedNetworkHosts: [] },
      secretReferences: [],
    },
  };
}

function createHarness(runExperiment: Parameters<typeof runExperimentWorker>[0]['runExperiment']) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let output = '';
  let errors = '';
  stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
  stderr.setEncoding('utf8').on('data', chunk => (errors += chunk));
  const result = runExperimentWorker({
    mastra: { shutdown: vi.fn().mockResolvedValue(undefined) },
    runExperiment,
    build,
    stdin,
    stdout,
    stderr,
  });
  return { stdin, result, output: () => output, errors: () => errors };
}

describe('runExperimentWorker', () => {
  it('matches the pinned protocol-v1 completion transcript', async () => {
    const stdin = new PassThrough();
    const stdout = new PassThrough();
    let output = '';
    stdout.setEncoding('utf8').on('data', chunk => (output += chunk));
    let eventId = 0;
    const fixedTimestamp = '2026-08-03T00:00:00.000Z';
    const result = runExperimentWorker({
      mastra: { shutdown: vi.fn().mockResolvedValue(undefined) },
      build,
      stdin,
      stdout,
      stderr: new PassThrough(),
      createEventId: () => `event-${eventId++}`,
      now: () => new Date(fixedTimestamp),
      runExperiment: async (_mastra, config) => {
        await config.onEvent({
          type: 'experiment.run.started',
          version: 1,
          experimentId: config.experimentId,
          sequence: 1,
          timestamp: fixedTimestamp,
          target: { type: config.targetType, id: config.targetId },
        });
        await config.onEvent({
          type: 'experiment.item.completed',
          version: 1,
          experimentId: config.experimentId,
          sequence: 2,
          timestamp: fixedTimestamp,
          target: { type: config.targetType, id: config.targetId },
          itemId: 'item-1',
          itemIndex: 0,
          status: 'succeeded',
        });
        await config.onEvent({
          type: 'experiment.run.finished',
          version: 1,
          experimentId: config.experimentId,
          sequence: 3,
          timestamp: fixedTimestamp,
          target: { type: config.targetType, id: config.targetId },
          outcome: 'completed',
          completedWithErrors: false,
        });
      },
    });
    stdin.end(await readFile(new URL('./__fixtures__/protocol-v1-run.ndjson', import.meta.url)));

    await expect(result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.completed);
    expect(output).toBe(
      await readFile(new URL('./__fixtures__/protocol-v1-completed.ndjson', import.meta.url), 'utf8'),
    );
  });

  it.each([
    ['malformed UTF-8', Buffer.from([0xff, 0x0a]), 'frame is not valid UTF-8'],
    ['truncated frame', Buffer.from('{"type":"run"}'), 'truncated frame'],
    ['oversized frame', Buffer.alloc(EXPERIMENT_WORKER_MAX_FRAME_BYTES + 1, 0x20), 'frame exceeds maximum size'],
  ])('rejects %s before accepting a run', async (_name, input, expectedError) => {
    const harness = createHarness(vi.fn());
    harness.stdin.end(input);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.protocol);
    expect(harness.output()).toBe('');
    expect(harness.errors()).toContain(expectedError);
  });

  it.each([
    ['protocol drift', (request: any) => (request.protocolVersion = '2'), 'unsupported protocol version'],
    [
      'canonicalization drift',
      (request: any) => (request.packet.dataset.canonicalizationVersion = '2'),
      'unsupported dataset canonicalization version',
    ],
    [
      'worker build drift',
      (request: any) => (request.packet.artifacts.buildId = 'other-build'),
      'worker build identity mismatch',
    ],
    [
      'network requirements',
      (request: any) => request.packet.policies.allowedNetworkHosts.push('example.com'),
      'unsupported network or secret policy',
    ],
    [
      'secret requirements',
      (request: any) => request.packet.secretReferences.push({ name: 'API_KEY' }),
      'unsupported network or secret policy',
    ],
    [
      'fractional concurrency',
      (request: any) => (request.packet.limits.concurrency = 1.5),
      'invalid experiment configuration',
    ],
    ['negative timeout', (request: any) => (request.packet.limits.timeoutMs = -1), 'invalid experiment configuration'],
  ])('rejects %s deterministically', async (_name, mutate, expectedError) => {
    const request = createRequest();
    mutate(request);
    const harness = createHarness(vi.fn());
    harness.stdin.end(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.protocol);
    expect(harness.output()).toBe('');
    expect(harness.errors()).toContain(expectedError);
  });

  it('maps workflow, scorer provenance, and tool mocks into the public experiment configuration', async () => {
    const request: any = createRequest();
    request.packet.target = { type: 'workflow', id: 'workflow-1' };
    request.packet.scorers = [{ id: 'quality', version: 'v1' }];
    request.packet.dataset.items[0].toolMocks = [{ toolId: 'lookup', output: { value: 1 } }];
    request.packet.policies.allowedToolIds = ['lookup'];
    const digest = createHash('sha256').update(canonicalize(request.packet.dataset.items)).digest('hex');
    request.packet.dataset.digest = digest;
    request.datasetAttestation.digest = digest;
    const runExperiment = vi.fn(async (_mastra, config) => {
      expect(config).toMatchObject({
        targetType: 'workflow',
        targetId: 'workflow-1',
        scorers: ['quality'],
        unmockedToolPolicy: 'deny',
        metadata: { scorerVersions: { quality: 'v1' } },
      });
      expect(config.data[0]).toMatchObject({ toolMocks: [{ toolId: 'lookup', output: { value: 1 } }] });
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'completed',
        completedWithErrors: false,
      });
    });
    const harness = createHarness(runExperiment);
    harness.stdin.end(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.completed);
    expect(runExperiment).toHaveBeenCalledOnce();
  });

  it('finishes without waiting for stdin to close after writing the terminal event', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'completed',
        completedWithErrors: false,
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.completed);
    expect(harness.output()).toContain('"type":"terminal"');
  });

  it('rejects a buffered truncated frame when the run completes', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'completed',
        completedWithErrors: false,
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n{"type":"cancel"`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.protocol);
    const events = harness
      .output()
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(events.filter(event => event.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)?.payload).toMatchObject({ status: 'failed', retryable: false });
  });

  it('rejects multiple terminal semantic events', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      const event = {
        type: 'experiment.run.finished' as const,
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'completed' as const,
        completedWithErrors: false,
      };
      await config.onEvent(event);
      await config.onEvent({ ...event, sequence: 2 });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.fatal);
    expect(harness.output()).toContain('Experiment emitted multiple terminal semantic events');
  });

  it('rejects cancellation with a mismatched correlation tuple', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      if (!config.signal.aborted) {
        await new Promise<void>(resolve => config.signal.addEventListener('abort', () => resolve(), { once: true }));
      }
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);
    harness.stdin.write(
      `${JSON.stringify({
        type: 'cancel',
        protocolVersion: '1',
        experimentId: request.experimentId,
        jobId: 'wrong-job',
        attempt: request.attempt,
        idempotencyKey: request.idempotencyKey,
        requestedAt: new Date().toISOString(),
        reason: 'must not cancel another attempt',
      })}\n`,
    );

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.protocol);
    expect(harness.output()).toContain('"type":"process-failure"');
    expect(harness.output()).toContain('"status":"failed"');
  });

  it('times out even when runExperiment ignores cancellation', async () => {
    const request = createRequest();
    request.deadlineAt = new Date(Date.now() + 25).toISOString();
    const harness = createHarness(async () => new Promise(() => undefined));
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.timedOut);
    expect(harness.output()).toContain('"status":"timed-out"');
  });

  it('does not overflow far-future deadlines', async () => {
    const request = createRequest();
    request.deadlineAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1_000).toISOString();
    let signal: AbortSignal | undefined;
    const harness = createHarness(async (_mastra, config) => {
      signal = config.signal;
      if (!signal.aborted) {
        await new Promise<void>(resolve => signal!.addEventListener('abort', () => resolve(), { once: true }));
      }
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'cancelled',
        completedWithErrors: false,
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await vi.waitFor(() => expect(signal).toBeDefined());
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(signal?.aborted).toBe(false);

    harness.stdin.write(
      `${JSON.stringify({
        type: 'cancel',
        protocolVersion: '1',
        experimentId: request.experimentId,
        jobId: request.jobId,
        attempt: request.attempt,
        idempotencyKey: request.idempotencyKey,
        requestedAt: new Date().toISOString(),
        reason: 'cancelled by test',
      })}\n`,
    );

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.cancelled);
  });

  it('rejects an invalid terminal semantic outcome', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'unknown' as never,
        completedWithErrors: false,
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.fatal);
    expect(harness.output()).toContain('Experiment emitted an invalid terminal semantic event');
  });

  it('returns the protocol exit code when the terminal frame cannot be written', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'failed',
        completedWithErrors: false,
        error: { message: 'x'.repeat(EXPERIMENT_WORKER_MAX_FRAME_BYTES) },
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.protocol);
    expect(harness.errors()).toContain('terminal protocol output failed: output frame exceeds maximum size');
    const events = harness
      .output()
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(events.filter(event => event.type === 'terminal')).toHaveLength(1);
    expect(events.at(-1)?.payload).toMatchObject({ status: 'failed', retryable: false });
  });

  it('cancels only with the complete active correlation tuple', async () => {
    const request = createRequest();
    const harness = createHarness(async (_mastra, config) => {
      if (!config.signal.aborted) {
        await new Promise<void>(resolve => config.signal.addEventListener('abort', () => resolve(), { once: true }));
      }
      await config.onEvent({
        type: 'experiment.run.finished',
        version: 1,
        experimentId: config.experimentId,
        sequence: 1,
        timestamp: new Date().toISOString(),
        target: { type: config.targetType, id: config.targetId },
        outcome: 'cancelled',
        completedWithErrors: false,
      });
    });
    harness.stdin.write(`${JSON.stringify(request)}\n`);
    harness.stdin.write(
      `${JSON.stringify({
        type: 'cancel',
        protocolVersion: '1',
        experimentId: request.experimentId,
        jobId: request.jobId,
        attempt: request.attempt,
        idempotencyKey: request.idempotencyKey,
        requestedAt: new Date().toISOString(),
        reason: 'cancelled by test',
      })}\n`,
    );

    await expect(harness.result).resolves.toBe(EXPERIMENT_WORKER_EXIT_CODES.cancelled);
    expect(harness.output()).toContain('"status":"cancelled"');
  });
});

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}
