import type { OracleMetric, OracleVectorFormat, OracleVectorIndexConfig, OracleVectorIndexType } from './types';

// Shared Oracle VECTOR SQL helpers used by both runtime queries and offline DDL export.
// Keeping these in one place prevents the schema exporter from drifting away from OracleVector behavior.
export function normalizeMetric(metric: string): OracleMetric {
  const normalized = metric.toLowerCase();
  if (
    normalized !== 'cosine' &&
    normalized !== 'euclidean' &&
    normalized !== 'dotproduct' &&
    normalized !== 'hamming' &&
    normalized !== 'jaccard'
  ) {
    throw new Error('metric must be one of "cosine", "euclidean", "dotproduct", "hamming", or "jaccard"');
  }
  return normalized;
}

export function normalizeVectorFormat(format: string): OracleVectorFormat {
  const normalized = format.toLowerCase();
  if (normalized !== 'vector' && normalized !== 'bit' && normalized !== 'int8') {
    throw new Error('vectorFormat must be one of "vector", "bit", or "int8"');
  }
  return normalized;
}

export function metricToken(metric: OracleMetric): string {
  switch (metric) {
    case 'euclidean':
      return 'EUCLIDEAN';
    case 'dotproduct':
      return 'DOT';
    case 'hamming':
      return 'HAMMING';
    case 'jaccard':
      return 'JACCARD';
    case 'cosine':
    default:
      return 'COSINE';
  }
}

export function defaultMetricForFormat(vectorFormat: OracleVectorFormat): OracleMetric {
  return vectorFormat === 'bit' ? 'hamming' : 'cosine';
}

export function vectorFormatToken(vectorFormat: OracleVectorFormat): string {
  switch (vectorFormat) {
    case 'bit':
      return 'BINARY';
    case 'int8':
      return 'INT8';
    case 'vector':
    default:
      return 'FLOAT32';
  }
}

// `indexType` is optional so callers that only know the vector format (e.g. the offline schema
// exporter) keep validating format/metric compatibility without being forced to resolve an index type.
export function validateMetricForFormat(
  metric: OracleMetric,
  vectorFormat: OracleVectorFormat,
  indexType?: OracleVectorIndexType,
): void {
  if (vectorFormat === 'bit') {
    if (metric !== 'hamming' && metric !== 'jaccard') {
      throw new Error('bit vector indexes support only "hamming" or "jaccard" metrics');
    }
  } else if (metric === 'hamming' || metric === 'jaccard') {
    throw new Error(`${metric} metric requires vectorFormat "bit"`);
  }

  // Oracle only supports JACCARD for exact search (VECTOR_DISTANCE); CREATE VECTOR INDEX rejects it
  // for HNSW/IVF at DDL time, so fail fast here instead of surfacing a database error later.
  if (metric === 'jaccard' && (indexType === 'hnsw' || indexType === 'ivf')) {
    throw new Error(
      `jaccard metric is only supported for exact search; use index type "none" or a different metric for ${indexType} indexes`,
    );
  }
}

export function buildVectorIndexParameterClause(indexConfig: OracleVectorIndexConfig): string {
  if (indexConfig.type === 'ivf') {
    const neighborPartitions = indexConfig.ivf?.neighborPartitions;
    // `!== undefined` (rather than truthy) so an explicit 0 reaches validatePositiveInteger and is
    // rejected instead of being silently treated as "unset".
    return neighborPartitions !== undefined
      ? `PARAMETERS (type IVF, neighbor partitions ${validatePositiveInteger(neighborPartitions)})`
      : '';
  }

  const parts: string[] = ['type HNSW'];
  if (indexConfig.hnsw?.neighbors !== undefined) {
    parts.push(`neighbors ${validatePositiveInteger(indexConfig.hnsw.neighbors)}`);
  }
  if (indexConfig.hnsw?.efConstruction !== undefined) {
    parts.push(`efconstruction ${validatePositiveInteger(indexConfig.hnsw.efConstruction)}`);
  }
  return parts.length > 1 ? `PARAMETERS (${parts.join(', ')})` : '';
}

export function validateDimension(dimension: number): number {
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error('dimension must be a positive integer');
  }
  return dimension;
}

export function validateVectorFormatDimension(vectorFormat: OracleVectorFormat, dimension: number): void {
  if (vectorFormat === 'bit' && dimension % 8 !== 0) {
    throw new Error('bit vector dimensions must be a multiple of 8');
  }
}

export function validateAccuracy(accuracy: number): number {
  if (!Number.isInteger(accuracy) || accuracy <= 0 || accuracy > 100) {
    throw new Error('vector index accuracy must be an integer between 1 and 100');
  }
  return accuracy;
}

function validatePositiveInteger(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('vector index parameter must be a positive integer');
  }
  return value;
}
