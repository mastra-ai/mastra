import { describe, expect, it, vi } from 'vitest';
import type { TraceImportProvider } from './provider.js';
import type { TraceImportRecord, TraceImportSourceIdentity } from './types.js';

const source: TraceImportSourceIdentity = {
  provider: 'example',
  baseUrl: 'https://traces.example.com',
  projectId: 'source-project',
  mapperVersion: '1',
  idAlgorithmVersion: '1',
};

function createExampleProvider(): TraceImportProvider {
  return {
    async identify() {
      return source;
    },
    async *read(context) {
      context.onRetry();
      yield {
        kind: 'trace',
        trace: {
          sourceTraceId: 'source-trace',
          spans: [
            {
              traceId: '0123456789abcdef0123456789abcdef',
              spanId: '0123456789abcdef',
              parentSpanId: null,
              name: 'example root',
              spanType: 'generic',
              startedAt: '2026-09-01T10:00:00.000Z',
              endedAt: '2026-09-01T10:00:01.000Z',
              isEvent: false,
              metadata: { source: source.provider },
            },
          ],
        },
      } satisfies TraceImportRecord;
      yield {
        kind: 'skipped',
        skipped: {
          sourceTraceId: 'incomplete-source-trace',
          spanCount: 2,
          reason: 'missing_parent',
        },
      } satisfies TraceImportRecord;
    },
  };
}

describe('TraceImportProvider', () => {
  it('exposes only normalized traces and provider-neutral skip records', async () => {
    const provider = createExampleProvider();
    const onRetry = vi.fn();

    await expect(provider.identify()).resolves.toEqual(source);

    const records: TraceImportRecord[] = [];
    for await (const record of provider.read({
      source,
      importId: 'import-run',
      cutoffAt: '2026-08-01T00:00:00.000Z',
      snapshotAt: '2026-09-01T00:00:00.000Z',
      onRetry,
    })) {
      records.push(record);
    }

    expect(records).toEqual([expect.objectContaining({ kind: 'trace' }), expect.objectContaining({ kind: 'skipped' })]);
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
