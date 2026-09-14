import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeTraceImport, readTraceImportManifest } from './manifest.js';
import { prepareTraceImport } from './prepared-traces.js';
import type { TraceImportProvider } from './provider.js';
import type { TraceImportTarget } from './target.js';
import type { TraceImportTrace } from './types.js';
import { uploadTraceImport } from './upload.js';
import { compareVerifiedTrace, verifyTraceImport } from './verification.js';
import type { TraceImportStoredSpan, TraceImportVerifier } from './verifier.js';

const temporaryDirectories: string[] = [];
const source = {
  provider: 'test-provider',
  baseUrl: 'https://source.example',
  projectId: 'source-project',
  idAlgorithmVersion: '1',
};

function trace(id: number): TraceImportTrace {
  const traceId = id.toString(16).padStart(32, '0');
  const rootSpanId = `${id.toString(16).padStart(8, '0')}00000001`;
  return {
    sourceTraceId: `source-${id}`,
    spans: [
      {
        traceId,
        spanId: rootSpanId,
        parentSpanId: null,
        name: `root-${id}`,
        spanType: 'generic',
        startedAt: '2026-09-10T12:00:00.000Z',
        endedAt: '2026-09-10T12:00:01.000Z',
        isEvent: false,
        input: { private: 'not read back' },
        metadata: { source: 'test' },
      },
      {
        traceId,
        spanId: `${id.toString(16).padStart(8, '0')}00000002`,
        parentSpanId: rootSpanId,
        name: `child-${id}`,
        spanType: 'tool_call',
        startedAt: '2026-09-10T12:00:00.250Z',
        endedAt: '2026-09-10T12:00:00.750Z',
        isEvent: false,
        metadata: { source: 'test' },
      },
    ],
  };
}

function stored(trace: TraceImportTrace): TraceImportStoredSpan[] {
  return trace.spans.map(
    ({ attributes: _attributes, input: _input, metadata: _metadata, output: _output, tags: _tags, ...span }) => span,
  );
}

function provider(values: TraceImportTrace[]): TraceImportProvider {
  return {
    identify: async () => source,
    read: async function* () {
      for (const value of values) yield { kind: 'trace' as const, trace: value };
    },
  };
}

async function prepare(values: TraceImportTrace[]) {
  const stateRoot = await mkdtemp(join(tmpdir(), 'trace-import-verification-'));
  temporaryDirectories.push(stateRoot);
  const state = await initializeTraceImport({
    stateRoot,
    source,
    targetProjectId: 'target-project',
    window: {
      cutoffAt: '2026-08-12T12:00:00.000Z',
      snapshotAt: '2026-09-11T12:00:00.000Z',
    },
  });
  await prepareTraceImport({ directory: state.directory, provider: provider(values) });
  return state.directory;
}

async function prepareAndUpload(values: TraceImportTrace[]) {
  const directory = await prepare(values);
  const target: TraceImportTarget = {
    projectId: 'target-project',
    upload: async () => undefined,
  };
  await uploadTraceImport({ directory, target });
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('trace import verification', () => {
  it('compares only lightweight structural fields', () => {
    const expected = trace(1);
    const actual = stored(expected);
    actual[0] = { ...actual[0]!, startedAt: '2026-09-10T12:00:00Z' };
    actual[1] = { ...actual[1]!, name: 'changed', parentSpanId: null };

    expect(compareVerifiedTrace(expected.spans, actual)).toEqual({
      matches: false,
      differences: [
        {
          traceId: expected.spans[0]!.traceId,
          spanId: expected.spans[1]!.spanId,
          fields: ['parentSpanId', 'name'],
        },
      ],
    });
  });

  it('verifies a deterministic sample, completes the import, and writes a private report', async () => {
    const traces = Array.from({ length: 21 }, (_, index) => trace(index + 1));
    const directory = await prepareAndUpload(traces);
    const readTrace = vi.fn<TraceImportVerifier['readTrace']>(async traceId => ({
      kind: 'found',
      spans: stored(traces.find(item => item.spans[0]!.traceId === traceId)!),
    }));

    const report = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace },
    });

    expect(readTrace.mock.calls.map(([traceId]) => Number.parseInt(traceId, 16))).toEqual([
      1, 3, 5, 7, 9, 12, 14, 16, 18, 21,
    ]);
    expect(report).toMatchObject({
      phase: 'complete',
      acknowledgedTraces: 21,
      verification: { status: 'verified', sampledTraces: 10, verifiedTraces: 10, queryAttempts: 10 },
    });
    await expect(access(join(directory, 'traces.jsonl'))).rejects.toThrow();
    expect((await stat(join(directory, 'report.json'))).mode & 0o777).toBe(0o600);
    expect(JSON.parse(await readFile(join(directory, 'report.json'), 'utf8'))).toEqual(report);
  });

  it('retries eventual consistency and honors a server delay', async () => {
    const value = trace(1);
    const directory = await prepareAndUpload([value]);
    const readTrace = vi
      .fn<TraceImportVerifier['readTrace']>()
      .mockResolvedValueOnce({ kind: 'pending' })
      .mockResolvedValueOnce({ kind: 'retryable', reason: 'busy', retryAfterMs: 2_000 })
      .mockResolvedValueOnce({ kind: 'found', spans: stored(value) });
    const sleep = vi.fn(async () => undefined);

    const report = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace },
      dependencies: { sleep },
    });

    expect(sleep).toHaveBeenNthCalledWith(1, 500, undefined);
    expect(sleep).toHaveBeenNthCalledWith(2, 2_000, undefined);
    expect(report.verification).toMatchObject({ status: 'verified', queryAttempts: 3 });
  });

  it('pauses on a mismatch without reporting customer payload values', async () => {
    const value = trace(1);
    const directory = await prepareAndUpload([value]);
    const changed = stored(value);
    changed[0] = { ...changed[0]!, name: 'different-name' };
    const readTrace = vi.fn<TraceImportVerifier['readTrace']>(async () => ({ kind: 'found', spans: changed }));

    const report = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace },
      limits: { maxAttempts: 1 },
    });

    expect(report).toMatchObject({
      phase: 'paused',
      verification: {
        status: 'mismatch',
        sampledTraces: 1,
        verifiedTraces: 0,
        differences: [{ traceId: value.spans[0]!.traceId, spanId: value.spans[0]!.spanId, fields: ['name'] }],
      },
    });
    expect(JSON.stringify(report)).not.toContain('not read back');
    await expect(access(join(directory, 'traces.jsonl'))).resolves.toBeUndefined();
  });

  it('keeps uploaded data resumable when read-back times out, then completes without another upload', async () => {
    const value = trace(1);
    const directory = await prepareAndUpload([value]);
    const pending = vi.fn<TraceImportVerifier['readTrace']>(async () => ({ kind: 'pending' }));

    const paused = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace: pending },
      limits: { maxAttempts: 2 },
      dependencies: { sleep: async () => undefined },
    });

    expect(paused.verification).toMatchObject({ status: 'timed-out', queryAttempts: 2 });
    expect(await readTraceImportManifest(directory)).toMatchObject({
      phase: 'paused',
      acknowledgedTraces: 1,
      acknowledgedSpans: 2,
    });

    const completed = await verifyTraceImport({
      directory,
      verifier: {
        projectId: 'target-project',
        readTrace: async () => ({ kind: 'found', spans: stored(value) }),
      },
    });
    expect(completed.verification.status).toBe('verified');
    expect(completed.phase).toBe('complete');
  });

  it('stops immediately when the query API is unavailable', async () => {
    const directory = await prepareAndUpload([trace(1), trace(2)]);
    const readTrace = vi.fn<TraceImportVerifier['readTrace']>(async () => ({
      kind: 'unavailable',
      reason: 'authentication failed',
    }));

    const report = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace },
    });

    expect(readTrace).toHaveBeenCalledOnce();
    expect(report.verification).toMatchObject({ status: 'unavailable', reason: 'authentication failed' });
    expect(report.phase).toBe('paused');
  });

  it('preserves resumable state when a verifier throws unexpectedly', async () => {
    const directory = await prepareAndUpload([trace(1)]);

    await expect(
      verifyTraceImport({
        directory,
        verifier: {
          projectId: 'target-project',
          readTrace: async () => {
            throw new Error('query connection closed');
          },
        },
      }),
    ).rejects.toThrow('query connection closed');

    expect(await readTraceImportManifest(directory)).toMatchObject({
      phase: 'paused',
      verification: { status: 'unavailable', reason: 'Platform read-back verification failed.' },
    });
    await expect(access(join(directory, 'traces.jsonl'))).resolves.toBeUndefined();
    await expect(access(join(directory, 'report.json'))).resolves.toBeUndefined();
  });

  it('does not query another project or start before every upload is acknowledged', async () => {
    const directory = await prepareAndUpload([]);
    const readTrace = vi.fn<TraceImportVerifier['readTrace']>();

    await expect(
      verifyTraceImport({
        directory,
        verifier: { projectId: 'another-project', readTrace },
      }),
    ).rejects.toThrow('different target project');

    const unacknowledgedDirectory = await prepare([trace(1)]);
    await expect(
      verifyTraceImport({
        directory: unacknowledgedDirectory,
        verifier: { projectId: 'target-project', readTrace },
      }),
    ).rejects.toThrow('unacknowledged');
    expect(readTrace).not.toHaveBeenCalled();
  });

  it('completes an empty import without querying Platform', async () => {
    const directory = await prepareAndUpload([]);
    const readTrace = vi.fn<TraceImportVerifier['readTrace']>();

    const report = await verifyTraceImport({
      directory,
      verifier: { projectId: 'target-project', readTrace },
    });

    expect(readTrace).not.toHaveBeenCalled();
    expect(report).toMatchObject({
      phase: 'complete',
      verification: { status: 'verified', sampledTraces: 0, verifiedTraces: 0, queryAttempts: 0 },
    });
  });
});
