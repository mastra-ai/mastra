import { describe, expect, it, vi } from 'vitest';

import { normalizeSuccess, writeJson } from './output';

describe('writeJson', () => {
  it('writes compact JSON with a trailing newline by default', () => {
    const stream = { write: vi.fn() } as any;

    writeJson({ data: { ok: true } }, false, stream);

    expect(stream.write).toHaveBeenCalledWith('{"data":{"ok":true}}\n');
  });

  it('writes pretty JSON when requested', () => {
    const stream = { write: vi.fn() } as any;

    writeJson({ data: { ok: true } }, true, stream);

    expect(stream.write).toHaveBeenCalledWith(`{
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

  it('wraps array list responses with an empty page', () => {
    expect(normalizeSuccess([{ id: 'agent-1' }], true)).toEqual({
      data: [{ id: 'agent-1' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('converts object maps to list items using generated response shape metadata', () => {
    expect(normalizeSuccess({ 'weather-agent': { id: 'weather-agent' } }, true, { kind: 'record' })).toEqual({
      data: [{ id: 'weather-agent' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('uses generated list property metadata before fallback heuristics', () => {
    expect(
      normalizeSuccess({ inputProcessors: ['not-list-items'], runs: [{ id: 'run-1' }] }, true, {
        kind: 'object-property',
        listProperty: 'runs',
      }),
    ).toEqual({
      data: [{ id: 'run-1' }],
      page: { total: 1, page: 0, perPage: 1, hasMore: false },
    });
  });

  it('uses data arrays and existing page pagination', () => {
    expect(
      normalizeSuccess({ data: [{ id: 'run-1' }], page: { total: 75, page: 2, perPage: 50, hasMore: true } }, true),
    ).toEqual({
      data: [{ id: 'run-1' }],
      page: { total: 75, page: 2, perPage: 50, hasMore: true },
    });
  });

  it('uses the first array property and preserves server pagination', () => {
    expect(
      normalizeSuccess(
        { scores: [{ id: 'score-1' }], pagination: { total: 60, page: 2, perPage: 25, hasMore: true } },
        true,
      ),
    ).toEqual({
      data: [{ id: 'score-1' }],
      page: { total: 60, page: 2, perPage: 25, hasMore: true },
    });
  });

  it('returns an empty list page for non-list-shaped data', () => {
    expect(normalizeSuccess({ ok: true }, true)).toEqual({
      data: [],
      page: { total: 0, page: 0, perPage: 0, hasMore: false },
    });
  });
});
