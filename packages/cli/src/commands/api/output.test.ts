import { describe, expect, it, vi } from 'vitest';
import { normalizeSuccess, writeJson } from './output';

const page = (overrides: Partial<{ total: number; page: number; perPage: number | false; hasMore: boolean }> = {}) => ({
  total: 1,
  page: 0,
  perPage: 1,
  hasMore: false,
  ...overrides,
});

describe('writeJson', () => {
  it('writes compact or pretty JSON with a trailing newline', () => {
    const compactStream = { write: vi.fn() } as any;
    const prettyStream = { write: vi.fn() } as any;

    writeJson({ data: { ok: true } }, false, compactStream);
    writeJson({ data: { ok: true } }, true, prettyStream);

    expect(compactStream.write).toHaveBeenCalledWith('{"data":{"ok":true}}\n');
    expect(prettyStream.write).toHaveBeenCalledWith(`{
  "data": {
    "ok": true
  }
}\n`);
  });
});

describe('normalizeSuccess', () => {
  it('wraps single-resource responses in data', () => {
    expect(normalizeSuccess({ id: 'agent-1' }, false)).toEqual({ data: { id: 'agent-1' } });
  });

  it('wraps raw array list responses with default pagination', () => {
    expect(normalizeSuccess([{ id: 'agent-1' }], true)).toEqual({
      data: [{ id: 'agent-1' }],
      page: page(),
    });
  });

  it('uses generated response shape metadata for record and property lists', () => {
    expect(normalizeSuccess({ 'weather-agent': { id: 'weather-agent' } }, true, { kind: 'record' })).toEqual({
      data: [{ id: 'weather-agent' }],
      page: page(),
    });

    expect(
      normalizeSuccess({ inputProcessors: ['not-list-items'], runs: [{ id: 'run-1' }] }, true, {
        kind: 'object-property',
        listProperty: 'runs',
      }),
    ).toEqual({
      data: [{ id: 'run-1' }],
      page: page(),
    });
  });

  it('preserves server pagination from nested or top-level fields', () => {
    expect(
      normalizeSuccess({ data: [{ id: 'run-1' }], page: { total: 75, page: 2, perPage: 50, hasMore: true } }, true),
    ).toEqual({
      data: [{ id: 'run-1' }],
      page: page({ total: 75, page: 2, perPage: 50, hasMore: true }),
    });

    expect(
      normalizeSuccess({ logs: [], total: 0, page: 0, perPage: false, hasMore: false }, true, {
        kind: 'object-property',
        listProperty: 'logs',
      }),
    ).toEqual({
      data: [],
      page: page({ total: 0, perPage: false }),
    });
  });

  it('falls back to the first array property and nested pagination', () => {
    expect(
      normalizeSuccess(
        { scores: [{ id: 'score-1' }], pagination: { total: 60, page: 2, perPage: 25, hasMore: true } },
        true,
      ),
    ).toEqual({
      data: [{ id: 'score-1' }],
      page: page({ total: 60, page: 2, perPage: 25, hasMore: true }),
    });
  });

  it('returns an empty list page for non-list-shaped data', () => {
    expect(normalizeSuccess({ ok: true }, true)).toEqual({
      data: [],
      page: page({ total: 0, perPage: 0 }),
    });
  });
});
