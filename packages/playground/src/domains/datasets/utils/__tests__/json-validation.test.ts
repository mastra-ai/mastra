import { describe, expect, it } from 'vitest';

import { validateImportJSON } from '../json-validation';

describe('validateImportJSON', () => {
  it('is idle for empty or whitespace text', () => {
    expect(validateImportJSON('')).toEqual({ status: 'idle' });
    expect(validateImportJSON('  \n ')).toEqual({ status: 'idle' });
  });

  it('reports a parse error with the parser message', () => {
    const result = validateImportJSON('[');
    expect(result.status).toBe('error');
    if (result.status !== 'error' || result.kind !== 'parse') throw new Error('expected parse error');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('rejects non-array and empty-array top levels', () => {
    expect(validateImportJSON('{}')).toEqual({ status: 'error', kind: 'not-array' });
    expect(validateImportJSON('"x"')).toEqual({ status: 'error', kind: 'not-array' });
    expect(validateImportJSON('[]')).toEqual({ status: 'error', kind: 'not-array' });
  });

  it('flags items without input while keeping preview rows', () => {
    const result = validateImportJSON(JSON.stringify([{ input: 'a' }, { x: 1 }, { input: '' }, 'not-an-object']));
    expect(result).toMatchObject({ status: 'error', kind: 'missing-input', missingInputCount: 3, total: 4 });
    if (result.status !== 'error' || result.kind !== 'missing-input') throw new Error('expected missing-input');
    expect(result.rows.map(row => row.hasInput)).toEqual([true, false, false, false]);
    expect(result.rows[0]).toEqual({ index: 1, input: 'a', hasInput: true, hasGroundTruth: false });
  });

  it('returns ready with items, groundTruth count and coerced metadata', () => {
    const result = validateImportJSON(
      JSON.stringify([
        { input: 'a', groundTruth: 'b', metadata: { topic: 't' } },
        { input: { nested: true }, metadata: 'bad' },
        { input: 'c', groundTruth: '' },
      ]),
    );
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('expected ready');
    expect(result.total).toBe(3);
    expect(result.missingGroundTruthCount).toBe(2);
    expect(result.items).toEqual([
      { input: 'a', groundTruth: 'b', metadata: { topic: 't' } },
      { input: { nested: true }, groundTruth: undefined, metadata: undefined },
      { input: 'c', groundTruth: '', metadata: undefined },
    ]);
    expect(result.rows.map(row => row.hasGroundTruth)).toEqual([true, false, false]);
  });
});
