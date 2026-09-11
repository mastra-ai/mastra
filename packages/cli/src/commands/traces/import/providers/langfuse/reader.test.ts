import { describe, expect, it, vi } from 'vitest';
import { LangfuseObservationsReader } from './reader.js';
import { LANGFUSE_OBSERVATION_FIELDS } from './types.js';

const clientOptions = {
  baseUrl: 'https://cloud.langfuse.com',
  publicKey: 'pk-lf-test',
  secretKey: 'sk-lf-test',
};

const root = {
  id: 'root',
  traceId: 'trace-1',
  startTime: '2026-09-01T10:00:00.000Z',
  endTime: '2026-09-01T10:00:05.000Z',
  projectId: 'project-1',
  parentObservationId: null,
  type: 'SPAN',
  name: 'root',
};

const child = {
  ...root,
  id: 'child',
  parentObservationId: 'root',
  type: 'GENERATION',
  name: 'child',
  metadata: { transcript: 'x'.repeat(300) },
};

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe('LangfuseObservationsReader', () => {
  it('discovers unique trace IDs across every cursor page', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
      const url = new URL(String(input));
      const cursor = url.searchParams.get('cursor');
      if (cursor === null) {
        return Response.json({
          data: [root, { ...root, id: 'orphan', traceId: null }],
          meta: { cursor: 'next-page' },
        });
      }
      return Response.json({ data: [child, { ...root, id: 'other', traceId: 'trace-2' }], meta: { cursor: null } });
    });
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(
      collect(
        reader.discoverTraces({
          projectId: 'project-1',
          cutoffAt: '2026-08-02T00:00:00.000Z',
          snapshotAt: '2026-09-01T12:00:00.000Z',
        }),
      ),
    ).resolves.toEqual([
      { kind: 'trace', traceId: 'trace-1' },
      { kind: 'missing-trace-id', observationId: 'orphan' },
      { kind: 'trace', traceId: 'trace-2' },
    ]);

    const urls = fetch.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls).toHaveLength(2);
    expect(urls[0]!.searchParams.get('fields')).toBe('core');
    expect(urls[0]!.searchParams.get('limit')).toBe('1000');
    expect(urls[0]!.searchParams.get('fromStartTime')).toBe('2026-08-02T00:00:00.000Z');
    expect(urls[0]!.searchParams.get('toStartTime')).toBe('2026-09-01T12:00:00.000Z');
    expect(urls[1]!.searchParams.get('cursor')).toBe('next-page');
  });

  it('fetches every page of one trace with all fields and full metadata', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
      const url = new URL(String(input));
      return url.searchParams.has('cursor')
        ? Response.json({ data: [child], meta: { cursor: null } })
        : Response.json({ data: [root], meta: { cursor: 'next-page' } });
    });
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(reader.readTrace({ traceId: 'trace-1', projectId: 'project-1' })).resolves.toEqual({
      traceId: 'trace-1',
      observations: [root, child],
    });

    const urls = fetch.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.get('fields')).toBe(LANGFUSE_OBSERVATION_FIELDS);
      expect(url.searchParams.get('expandMetadata')).toBe('*');
      expect(url.searchParams.get('traceId')).toBe('trace-1');
      expect(url.searchParams.has('fromStartTime')).toBe(false);
      expect(url.searchParams.has('toStartTime')).toBe(false);
    }
  });

  it('retries an oversized page with a smaller limit without losing or duplicating observations', async () => {
    const grandchild = { ...child, id: 'grandchild', parentObservationId: 'child' };
    const oversizedBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(5 * 1024 * 1024));
        controller.enqueue(new Uint8Array(1));
        controller.close();
      },
    });
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(Response.json({ data: [root], meta: { cursor: 'next-page' } }))
      .mockResolvedValueOnce(new Response(oversizedBody))
      .mockResolvedValueOnce(Response.json({ data: [child], meta: { cursor: 'final-page' } }))
      .mockResolvedValueOnce(Response.json({ data: [grandchild], meta: { cursor: null } }));
    const onRetry = vi.fn();
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(reader.readTrace({ traceId: 'trace-1', projectId: 'project-1', onRetry })).resolves.toEqual({
      traceId: 'trace-1',
      observations: [root, child, grandchild],
    });

    const urls = fetch.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls.map(url => url.searchParams.get('limit'))).toEqual(['1000', '1000', '500', '500']);
    expect(urls.map(url => url.searchParams.get('cursor'))).toEqual([null, 'next-page', 'next-page', 'final-page']);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('fails when one observation exceeds the response limit', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      return new Response(null, { headers: { 'Content-Length': String(5 * 1024 * 1024 + 1) } });
    });
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(reader.readTrace({ traceId: 'trace-1', projectId: 'project-1' })).rejects.toThrow('response exceeds');

    const limits = fetch.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('limit'));
    expect(limits).toEqual(['1000', '500', '250', '125', '62', '31', '15', '7', '3', '1']);
  });

  it.each([
    [
      'discovery',
      (reader: LangfuseObservationsReader) =>
        collect(
          reader.discoverTraces({
            projectId: 'project-1',
            cutoffAt: '2026-08-02T00:00:00.000Z',
            snapshotAt: '2026-09-01T12:00:00.000Z',
          }),
        ),
    ],
    [
      'detail',
      (reader: LangfuseObservationsReader) => reader.readTrace({ traceId: 'trace-1', projectId: 'project-1' }),
    ],
  ] as const)('rejects a repeated %s cursor', async (_stage, read) => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockImplementation(async () => Response.json({ data: [root], meta: { cursor: 'same-cursor' } }));
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(read(reader)).rejects.toThrow('repeated pagination cursor');
  });

  it('rejects observations returned for another project or trace', async () => {
    const wrongProject = new LangfuseObservationsReader(clientOptions, {
      fetch: vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({ data: [{ ...root, projectId: 'project-2' }], meta: { cursor: null } })),
    });
    await expect(wrongProject.readTrace({ traceId: 'trace-1', projectId: 'project-1' })).rejects.toThrow(
      'different project',
    );

    const wrongTrace = new LangfuseObservationsReader(clientOptions, {
      fetch: vi
        .fn<typeof globalThis.fetch>()
        .mockResolvedValue(Response.json({ data: [{ ...root, traceId: 'trace-2' }], meta: { cursor: null } })),
    });
    await expect(wrongTrace.readTrace({ traceId: 'trace-1', projectId: 'project-1' })).rejects.toThrow(
      'different trace',
    );
  });

  it('stops before the next page when aborted', async () => {
    const controller = new AbortController();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => {
      controller.abort(new Error('cancelled'));
      return Response.json({ data: [root], meta: { cursor: 'next-page' } });
    });
    const reader = new LangfuseObservationsReader(clientOptions, { fetch });

    await expect(
      collect(
        reader.discoverTraces({
          projectId: 'project-1',
          cutoffAt: '2026-08-02T00:00:00.000Z',
          snapshotAt: '2026-09-01T00:00:00.000Z',
          signal: controller.signal,
        }),
      ),
    ).rejects.toThrow('cancelled');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
