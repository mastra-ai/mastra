import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileTransport } from './file';
import { normalizePagination } from './pagination';
import { UpstashTransport } from './upstash';

const invalid: Array<[string, { page?: number; perPage?: number }]> = [
  ['negative page', { page: -1 }],
  ['fractional page', { page: 1.5 }],
  ['NaN page', { page: NaN }],
  ['infinite page', { page: Infinity }],
  ['unsafe page', { page: Number.MAX_SAFE_INTEGER + 2 }],
  ['negative perPage', { perPage: -2 }],
  ['fractional perPage', { perPage: 0.5 }],
  ['NaN perPage', { perPage: NaN }],
  ['infinite perPage', { perPage: -Infinity }],
  ['overflowing range', { page: Number.MAX_SAFE_INTEGER, perPage: 2 }],
];

describe('normalizePagination', () => {
  it('applies defaults and zero aliases', () => {
    expect(normalizePagination()).toEqual({ page: 1, perPage: 100, start: 0, end: 100 });
    expect(normalizePagination(0, 0)).toEqual({ page: 1, perPage: 100, start: 0, end: 100 });
    expect(normalizePagination(3, 2)).toEqual({ page: 3, perPage: 2, start: 4, end: 6 });
  });

  it.each(invalid)('rejects %s', (_, { page, perPage }) => {
    expect(() => normalizePagination(page, perPage)).toThrow(RangeError);
  });
});

describe('FileTransport pagination', () => {
  let dir: string;
  let transport: FileTransport;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'loggers-pagination-'));
    const path = join(dir, 'logs.jsonl');
    const lines = [1, 2, 3, 4, 5].map(i =>
      JSON.stringify({ msg: `m${i}`, runId: 'r', level: 'info', time: Date.now() }),
    );
    writeFileSync(path, lines.join('\n') + '\n');
    transport = new FileTransport({ path });
  });

  afterEach(() => {
    transport.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it.each(invalid)('listLogs rejects %s', async (_, params) => {
    await expect(transport.listLogs(params)).rejects.toThrow(RangeError);
  });

  it.each(invalid)('listLogsByRunId rejects %s', async (_, params) => {
    await expect(transport.listLogsByRunId({ runId: 'r', ...params })).rejects.toThrow(RangeError);
  });

  it('keeps valid and aliased pagination working', async () => {
    const paged = await transport.listLogs({ page: 2, perPage: 2 });
    expect(paged.logs.map(l => l.msg)).toEqual(['m3', 'm4']);
    expect(paged).toMatchObject({ total: 5, page: 2, perPage: 2, hasMore: true });

    const aliased = await transport.listLogs({ page: 0, perPage: 0 });
    expect(aliased).toMatchObject({ total: 5, page: 1, perPage: 100, hasMore: false });

    const all = await transport.listLogs({ returnPaginationResults: false });
    expect(all.logs).toHaveLength(5);
  });
});

describe('UpstashTransport pagination', () => {
  let transport: UpstashTransport;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ result: 5 }, { result: [] }],
    }));
    vi.stubGlobal('fetch', fetchMock);
    transport = new UpstashTransport({
      upstashUrl: 'https://test-url.upstash.io',
      upstashToken: 'test-token',
      listName: 'test-logs',
      flushInterval: 100000,
    });
    fetchMock.mockClear();
  });

  afterEach(async () => {
    await transport.destroy?.();
    vi.unstubAllGlobals();
  });

  it.each(invalid)('listLogs rejects %s without calling Upstash', async (_, params) => {
    await expect(transport.listLogs(params)).rejects.toThrow(RangeError);
    await expect(transport.listLogs({ ...params, logLevel: 'info' as any })).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(invalid)('listLogsByRunId rejects %s without calling Upstash', async (_, params) => {
    await expect(transport.listLogsByRunId({ runId: 'r', ...params })).rejects.toThrow(RangeError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends a valid LRANGE window', async () => {
    const result = await transport.listLogs({ page: 2, perPage: 2 });
    expect(result).toMatchObject({ total: 5, page: 2, perPage: 2, hasMore: true });
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body).toEqual([
      ['LLEN', 'test-logs'],
      ['LRANGE', 'test-logs', 2, 3],
    ]);
  });
});
