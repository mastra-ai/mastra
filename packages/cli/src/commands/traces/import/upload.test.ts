import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeTraceImport, readTraceImportManifest } from './manifest.js';
import { prepareTraceImport } from './prepared-traces.js';
import type { TraceImportProvider } from './provider.js';
import type { TraceImportTarget } from './target.js';
import type { TraceImportTrace } from './types.js';
import { uploadTraceImport } from './upload.js';

const temporaryDirectories: string[] = [];
const source = {
  provider: 'test-provider',
  baseUrl: 'https://source.example',
  projectId: 'source-project',
  idAlgorithmVersion: '1',
};

function trace(id: number): TraceImportTrace {
  return {
    sourceTraceId: `source-${id}`,
    spans: [
      {
        traceId: id.toString(16).padStart(32, '0'),
        spanId: id.toString(16).padStart(16, '0'),
        parentSpanId: null,
        name: `trace-${id}`,
        spanType: 'generic',
        startedAt: '2026-09-10T12:00:00.000Z',
        endedAt: '2026-09-10T12:00:01.000Z',
        isEvent: false,
        metadata: { source: 'test' },
      },
    ],
  };
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
  const stateRoot = await mkdtemp(join(tmpdir(), 'trace-import-upload-'));
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

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('uploadTraceImport', () => {
  it('uploads whole traces in order and checkpoints every acknowledged batch', async () => {
    const directory = await prepare([trace(1), trace(2), trace(3)]);
    const target: TraceImportTarget = {
      projectId: 'target-project',
      upload: vi.fn(async () => undefined),
    };

    const manifest = await uploadTraceImport({
      directory,
      target,
      batch: { preferredSpansPerBatch: 2 },
    });

    expect(target.upload).toHaveBeenCalledTimes(2);
    expect(vi.mocked(target.upload).mock.calls.map(([batch]) => batch.traces.map(item => item.sourceTraceId))).toEqual([
      ['source-1', 'source-2'],
      ['source-3'],
    ]);
    expect(manifest).toMatchObject({ phase: 'uploading', acknowledgedTraces: 3, acknowledgedSpans: 3 });
  });

  it('leaves a failed batch pending and resumes from its first trace', async () => {
    const directory = await prepare([trace(1), trace(2), trace(3)]);
    const firstAttempt: TraceImportTarget = {
      projectId: 'target-project',
      upload: vi
        .fn<TraceImportTarget['upload']>()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('collector unavailable')),
    };

    await expect(
      uploadTraceImport({ directory, target: firstAttempt, batch: { preferredSpansPerBatch: 1 } }),
    ).rejects.toThrow('collector unavailable');
    expect(await readTraceImportManifest(directory)).toMatchObject({
      acknowledgedTraces: 1,
      acknowledgedSpans: 1,
    });

    const resumed: TraceImportTarget = {
      projectId: 'target-project',
      upload: vi.fn(async () => undefined),
    };
    await uploadTraceImport({ directory, target: resumed, batch: { preferredSpansPerBatch: 10 } });

    expect(vi.mocked(resumed.upload).mock.calls[0]![0].traces.map(item => item.sourceTraceId)).toEqual([
      'source-2',
      'source-3',
    ]);
    expect(await readTraceImportManifest(directory)).toMatchObject({
      acknowledgedTraces: 3,
      acknowledgedSpans: 3,
    });
  });

  it('does not checkpoint when the target rejects the first batch', async () => {
    const directory = await prepare([trace(1)]);
    const target: TraceImportTarget = {
      projectId: 'target-project',
      upload: vi.fn(async () => {
        throw new Error('invalid acknowledgement');
      }),
    };

    await expect(uploadTraceImport({ directory, target })).rejects.toThrow('invalid acknowledgement');
    expect(await readTraceImportManifest(directory)).toMatchObject({
      phase: 'prepared',
      acknowledgedTraces: 0,
      acknowledgedSpans: 0,
    });
  });

  it('refuses to upload prepared traces to another project', async () => {
    const directory = await prepare([trace(1)]);
    const target: TraceImportTarget = {
      projectId: 'different-project',
      upload: vi.fn(async () => undefined),
    };

    await expect(uploadTraceImport({ directory, target })).rejects.toThrow('different target project');
    expect(target.upload).not.toHaveBeenCalled();
  });
});
