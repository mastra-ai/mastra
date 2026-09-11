import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { acknowledgeTraceBatch, initializeTraceImport, readTraceImportManifest } from './manifest.js';
import {
  completeTraceImport,
  prepareTraceImport,
  readPendingTraceBatches,
  tracePayloadBytes,
} from './prepared-traces.js';
import type { TraceImportProvider } from './provider.js';
import type { TraceImportTrace } from './types.js';

const temporaryDirectories: string[] = [];
const source = {
  provider: 'test-provider',
  baseUrl: 'https://source.example',
  projectId: 'source-project',
  mapperVersion: '1',
  idAlgorithmVersion: '1',
};

function trace(id: number, spanCount = 2): TraceImportTrace {
  const traceId = id.toString(16).padStart(32, '0');
  const rootSpanId = `${id.toString(16).padStart(8, '0')}00000001`;
  return {
    sourceTraceId: `source-${id}`,
    spans: Array.from({ length: spanCount }, (_, index) => ({
      traceId,
      spanId:
        index === 0 ? rootSpanId : `${id.toString(16).padStart(8, '0')}${(index + 1).toString(16).padStart(8, '0')}`,
      parentSpanId: index === 0 ? null : rootSpanId,
      name: `span-${id}-${index}`,
      spanType: 'generic',
      startedAt: '2026-09-10T12:00:00.000Z',
      endedAt: '2026-09-10T12:00:01.000Z',
      isEvent: false,
      metadata: { provider: 'test' },
    })),
  };
}

function provider(traces: TraceImportTrace[], options: { failAfter?: number } = {}): TraceImportProvider {
  return {
    identify: vi.fn(async () => source),
    read: vi.fn(async function* (context) {
      context.onRetry();
      for (const [index, value] of traces.entries()) {
        if (index === options.failAfter) throw new Error('source disconnected');
        yield { kind: 'trace' as const, trace: value };
      }
    }),
  };
}

async function initialize() {
  const stateRoot = await mkdtemp(join(tmpdir(), 'prepared-traces-'));
  temporaryDirectories.push(stateRoot);
  return initializeTraceImport({
    stateRoot,
    source,
    targetProjectId: 'target-project',
    window: {
      cutoffAt: '2026-08-12T12:00:00.000Z',
      snapshotAt: '2026-09-11T12:00:00.000Z',
    },
  });
}

async function collectBatches(directory: string, preferredSpansPerBatch: number) {
  return Array.fromAsync(readPendingTraceBatches(directory, { preferredSpansPerBatch }));
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('prepared traces', () => {
  it('performs an upload-free dry run into one-record-per-trace JSONL', async () => {
    const state = await initialize();
    const sourceProvider: TraceImportProvider = {
      identify: async () => source,
      read: async function* (context) {
        context.onRetry();
        yield { kind: 'skipped', skipped: { sourceTraceId: 'broken', spanCount: 3, reason: 'missing_parent' } };
        yield { kind: 'trace', trace: trace(1), warnings: ['Mapped an unknown source type to generic.'] };
        yield { kind: 'trace', trace: trace(2) };
      },
    };

    const manifest = await prepareTraceImport({ directory: state.directory, provider: sourceProvider });
    const lines = (await readFile(join(state.directory, 'traces.jsonl'), 'utf8')).trim().split('\n');

    expect(lines).toHaveLength(2);
    expect(lines.map(line => JSON.parse(line).sourceTraceId)).toEqual(['source-1', 'source-2']);
    expect((await stat(join(state.directory, 'traces.jsonl'))).mode & 0o777).toBe(0o600);
    expect(manifest).toMatchObject({
      phase: 'prepared',
      counts: {
        readSpans: 7,
        preparedTraces: 2,
        preparedSpans: 4,
        skippedTraces: 1,
        skippedSpans: 3,
        sourceRetries: 1,
        skipReasons: { missing_parent: 1 },
      },
      warnings: ['Mapped an unknown source type to generic.'],
    });
  });

  it('keeps every trace whole even when it exceeds the preferred span count', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([trace(1, 4), trace(2), trace(3)]) });

    const batches = await collectBatches(state.directory, 3);

    expect(batches.map(batch => batch.spanCount)).toEqual([4, 2, 2]);
    expect(batches.map(batch => batch.traces.length)).toEqual([1, 1, 1]);
    expect(batches[0]!.payloadBytes).toBe(tracePayloadBytes(trace(1, 4)));
  });

  it('uses serialized payload bytes as a hard batch boundary', async () => {
    const state = await initialize();
    const first = trace(1);
    const second = trace(2);
    await prepareTraceImport({ directory: state.directory, provider: provider([first, second]) });

    const batches = await Array.fromAsync(
      readPendingTraceBatches(state.directory, {
        preferredSpansPerBatch: 10,
        maxPayloadBytes: tracePayloadBytes(first),
      }),
    );

    expect(batches.map(batch => batch.traces.map(item => item.sourceTraceId))).toEqual([['source-1'], ['source-2']]);
  });

  it('resumes from the first unacknowledged trace and permits a new batch preference', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2), trace(3)]) });
    const [firstBatch] = await collectBatches(state.directory, 2);

    const checkpoint = await acknowledgeTraceBatch(state.directory, firstBatch!);
    const pending = await collectBatches(state.directory, 10);

    expect(checkpoint).toMatchObject({ acknowledgedTraces: 1, acknowledgedSpans: 2, phase: 'uploading' });
    expect(pending).toHaveLength(1);
    expect(pending[0]!.firstTraceIndex).toBe(1);
    expect(pending[0]!.traces.map(item => item.sourceTraceId)).toEqual(['source-2', 'source-3']);
  });

  it('replays a batch when interruption happens before its acknowledgement is saved', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2)]) });
    const [beforeInterruption] = await collectBatches(state.directory, 2);

    // Simulate an upload attempt whose acknowledgement never reached the checkpoint code.
    const [afterResume] = await collectBatches(state.directory, 2);

    expect(afterResume).toEqual(beforeInterruption);
    expect(afterResume!.firstTraceIndex).toBe(0);
    expect((await readTraceImportManifest(state.directory)).acknowledgedTraces).toBe(0);
  });

  it('does not advance a checkpoint for an out-of-order batch', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2)]) });
    const batches = await collectBatches(state.directory, 2);

    await expect(acknowledgeTraceBatch(state.directory, batches[1]!)).rejects.toThrow('next pending trace');
    expect((await readTraceImportManifest(state.directory)).acknowledgedTraces).toBe(0);
  });

  it('restarts failed preparation instead of keeping a partial trace file', async () => {
    const state = await initialize();
    await expect(
      prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2)], { failAfter: 1 }) }),
    ).rejects.toThrow('source disconnected');
    await expect(access(join(state.directory, 'traces.jsonl'))).rejects.toThrow();
    await expect(access(join(state.directory, 'traces.jsonl.tmp'))).rejects.toThrow();

    const prepared = await prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2)]) });
    expect(prepared.counts.preparedTraces).toBe(2);
  });

  it('records an oversized trace as skipped before batching', async () => {
    const state = await initialize();
    const value = trace(1);
    const payloadBytes = tracePayloadBytes(value);
    const manifest = await prepareTraceImport({
      directory: state.directory,
      provider: provider([value]),
      limits: { maxTracePayloadBytes: payloadBytes - 1 },
    });

    expect(manifest.counts).toMatchObject({
      preparedTraces: 0,
      skippedTraces: 1,
      skipReasons: { trace_too_large: 1 },
    });
    expect(await collectBatches(state.directory, 100)).toEqual([]);
  });

  it('cleans up prepared data only after every trace is acknowledged', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([trace(1), trace(2)]) });
    const [batch] = await collectBatches(state.directory, 10);

    await expect(completeTraceImport(state.directory)).rejects.toThrow('unacknowledged');
    await acknowledgeTraceBatch(state.directory, batch!);
    const completed = await completeTraceImport(state.directory);

    expect(completed.phase).toBe('complete');
    await expect(access(join(state.directory, 'traces.jsonl'))).rejects.toThrow();
    expect((await readTraceImportManifest(state.directory)).phase).toBe('complete');
  });

  it('does not complete an import before preparation finishes', async () => {
    const state = await initialize();

    await expect(completeTraceImport(state.directory)).rejects.toThrow('before trace preparation finishes');
    expect((await readTraceImportManifest(state.directory)).phase).toBe('preparing');
  });

  it('can complete an empty prepared import', async () => {
    const state = await initialize();
    await prepareTraceImport({ directory: state.directory, provider: provider([]) });

    const completed = await completeTraceImport(state.directory);

    expect(completed).toMatchObject({ phase: 'complete', acknowledgedTraces: 0 });
  });
});
