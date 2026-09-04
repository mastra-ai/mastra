import { describe, expect, it } from 'vitest';

import {
  buildVectorIndexParameterClause,
  defaultMetricForFormat,
  metricToken,
  normalizeMetric,
  normalizeVectorFormat,
  validateAccuracy,
  validateDimension,
  validateMetricForFormat,
  validateVectorFormatDimension,
  vectorFormatToken,
} from './sql';

describe('Oracle vector SQL helpers', () => {
  it('normalizes metric and vector format tokens', () => {
    expect(normalizeMetric('COSINE')).toBe('cosine');
    expect(normalizeVectorFormat('INT8')).toBe('int8');
    expect(metricToken('cosine')).toBe('COSINE');
    expect(metricToken('euclidean')).toBe('EUCLIDEAN');
    expect(metricToken('dotproduct')).toBe('DOT');
    expect(metricToken('hamming')).toBe('HAMMING');
    expect(metricToken('jaccard')).toBe('JACCARD');
    expect(vectorFormatToken('vector')).toBe('FLOAT32');
    expect(vectorFormatToken('bit')).toBe('BINARY');
    expect(vectorFormatToken('int8')).toBe('INT8');
    expect(defaultMetricForFormat('bit')).toBe('hamming');
    expect(defaultMetricForFormat('vector')).toBe('cosine');
  });

  it('validates metrics, formats, dimensions, and accuracy', () => {
    expect(() => normalizeMetric('invalid')).toThrow(/metric must be/i);
    expect(() => normalizeVectorFormat('binary')).toThrow(/vectorFormat/i);
    expect(() => validateMetricForFormat('cosine', 'bit')).toThrow(/bit vector/i);
    expect(() => validateMetricForFormat('hamming', 'vector')).toThrow(/requires vectorFormat "bit"/i);
    expect(validateDimension(3)).toBe(3);
    expect(() => validateDimension(0)).toThrow(/positive integer/i);
    expect(() => validateVectorFormatDimension('bit', 7)).toThrow(/multiple of 8/i);
    expect(validateAccuracy(100)).toBe(100);
    expect(() => validateAccuracy(101)).toThrow(/between 1 and 100/i);
  });

  it('rejects jaccard for HNSW/IVF indexes but allows it for exact search', () => {
    expect(() => validateMetricForFormat('jaccard', 'bit', 'hnsw')).toThrow(/jaccard.*exact search/i);
    expect(() => validateMetricForFormat('jaccard', 'bit', 'ivf')).toThrow(/jaccard.*exact search/i);
    expect(validateMetricForFormat('jaccard', 'bit', 'none')).toBeUndefined();
    expect(validateMetricForFormat('jaccard', 'bit')).toBeUndefined();
    // hamming stays valid for HNSW/IVF bit indexes; only jaccard is exact-search-only.
    expect(validateMetricForFormat('hamming', 'bit', 'hnsw')).toBeUndefined();
  });

  it('builds IVF and HNSW vector index parameter clauses', () => {
    expect(buildVectorIndexParameterClause({ type: 'ivf' })).toBe('');
    expect(buildVectorIndexParameterClause({ type: 'ivf', ivf: { neighborPartitions: 4 } })).toBe(
      'PARAMETERS (type IVF, neighbor partitions 4)',
    );
    expect(buildVectorIndexParameterClause({ type: 'hnsw' })).toBe('');
    expect(buildVectorIndexParameterClause({ type: 'hnsw', hnsw: { neighbors: 16, efConstruction: 64 } })).toBe(
      'PARAMETERS (type HNSW, neighbors 16, efconstruction 64)',
    );
    expect(() => buildVectorIndexParameterClause({ type: 'ivf', ivf: { neighborPartitions: 1.5 } })).toThrow(
      /positive integer/i,
    );
  });

  it('rejects an explicit 0 instead of silently treating it as unset', () => {
    expect(() => buildVectorIndexParameterClause({ type: 'ivf', ivf: { neighborPartitions: 0 } })).toThrow(
      /positive integer/i,
    );
    expect(() => buildVectorIndexParameterClause({ type: 'hnsw', hnsw: { neighbors: 0 } })).toThrow(
      /positive integer/i,
    );
    expect(() => buildVectorIndexParameterClause({ type: 'hnsw', hnsw: { efConstruction: 0 } })).toThrow(
      /positive integer/i,
    );
  });
});
