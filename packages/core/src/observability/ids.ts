/**
 * Unique identifiers for observability signals.
 *
 * Every log, metric, score, and feedback event carries a unique id generated
 * at emission time. These ids act as a de-duplication key in downstream OLAP
 * stores and let external systems link a specific signal back to Mastra.
 *
 * Logs align with the OpenTelemetry `log.record.uid` semantic convention,
 * which accepts either ULID or UUID. UUID is used here for all signals so
 * that the entire observability surface uses a single built-in generator
 * (`crypto.randomUUID`) with no extra dependencies.
 *
 * See: https://opentelemetry.io/docs/specs/semconv/general/logs/
 */

/**
 * Generate a unique id for an observability signal (log, metric, score, feedback).
 * Returns a UUID v4 string produced by `crypto.randomUUID`.
 */
export function generateSignalId(): string {
  return crypto.randomUUID();
}
