/**
 * Default histogram bucket boundaries for common metric types.
 * Used by OLAP query methods when bucket boundaries are not explicitly provided.
 */

/** Duration metrics (milliseconds) */
const DURATION_MS_BUCKETS = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000, 60000];

/** Token count metrics */
const TOKEN_BUCKETS = [1, 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 50000, 100000];

/** Byte size metrics */
const BYTE_BUCKETS = [100, 1000, 10000, 100000, 1000000, 10000000, 100000000];

/** Generic/fallback buckets */
const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

/**
 * Bucket boundary definitions keyed by metric name suffix pattern.
 */
export const BUCKET_BOUNDARIES: Record<string, number[]> = {
  _ms: DURATION_MS_BUCKETS,
  _duration_ms: DURATION_MS_BUCKETS,
  _latency_ms: DURATION_MS_BUCKETS,
  _tokens: TOKEN_BUCKETS,
  _token_count: TOKEN_BUCKETS,
  _input_tokens: TOKEN_BUCKETS,
  _output_tokens: TOKEN_BUCKETS,
  _total_tokens: TOKEN_BUCKETS,
  _bytes: BYTE_BUCKETS,
  _size_bytes: BYTE_BUCKETS,
};

/**
 * Returns appropriate bucket boundaries for a given metric name.
 * Matches against known metric name suffixes, falling back to generic buckets.
 */
export function getBucketBoundaries(metricName: string): number[] {
  const lowerName = metricName.toLowerCase();
  for (const [suffix, boundaries] of Object.entries(BUCKET_BOUNDARIES)) {
    if (lowerName.endsWith(suffix)) {
      return boundaries;
    }
  }
  return DEFAULT_BUCKETS;
}
