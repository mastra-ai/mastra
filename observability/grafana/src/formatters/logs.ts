/**
 * Logs formatter for Grafana Loki.
 *
 * Converts Mastra ExportedLog to Loki JSON push API format.
 * Loki accepts logs via POST /loki/api/v1/push.
 *
 * @see https://grafana.com/docs/loki/latest/reference/loki-http-api/#ingest-logs
 */

import type { ExportedLog } from '@mastra/core/observability';

/**
 * Loki JSON push request format.
 */

export interface LokiPushRequest {
  streams: LokiStream[];
}

export interface LokiStream {
  /** Label set identifying the stream (must be low cardinality) */
  stream: Record<string, string>;
  /** Array of [timestamp_ns, log_line] tuples */
  values: [string, string][];
}

/**
 * Convert a Date to nanoseconds as a string (Loki uses nanosecond timestamps).
 */
function dateToNanoString(date: Date): string {
  return `${BigInt(date.getTime()) * 1_000_000n}`;
}

/**
 * Build a structured log line from an ExportedLog.
 * Includes all correlation fields and data for searchability via LogQL.
 */
function buildLogLine(log: ExportedLog): string {
  const entry: Record<string, unknown> = {
    message: log.message,
  };

  // Add trace correlation
  if (log.traceId) entry.traceId = log.traceId;
  if (log.spanId) entry.spanId = log.spanId;

  // Add structured data
  if (log.data && Object.keys(log.data).length > 0) {
    entry.data = log.data;
  }

  // Add metadata fields (runId, sessionId, userId, etc.)
  if (log.metadata && Object.keys(log.metadata).length > 0) {
    for (const [k, v] of Object.entries(log.metadata)) {
      if (v !== undefined && v !== null) {
        entry[k] = v;
      }
    }
  }

  return JSON.stringify(entry);
}

/**
 * Extract Loki stream labels from a log.
 * Labels must be low cardinality to avoid performance issues.
 * High-cardinality fields (traceId, spanId) go in the log line, not labels.
 */
function extractStreamLabels(log: ExportedLog, serviceName: string): Record<string, string> {
  const labels: Record<string, string> = {
    job: serviceName,
    level: log.level,
  };

  // Add low-cardinality metadata as labels
  if (log.metadata) {
    const entityType = log.metadata['entityType'];
    if (typeof entityType === 'string') {
      labels['entity_type'] = entityType;
    }

    const entityName = log.metadata['entityName'];
    if (typeof entityName === 'string') {
      labels['entity_name'] = entityName;
    }

    const environment = log.metadata['environment'];
    if (typeof environment === 'string') {
      labels['environment'] = environment;
    }
  }

  // Add tags as a label if present (comma-joined)
  if (log.tags?.length) {
    labels['tags'] = log.tags.join(',');
  }

  return labels;
}

/**
 * Group logs by their stream labels to create efficient Loki push requests.
 * Logs with identical labels are grouped into the same stream.
 */
function groupByStream(
  logs: ExportedLog[],
  serviceName: string,
): Map<string, { labels: Record<string, string>; values: [string, string][] }> {
  const streams = new Map<string, { labels: Record<string, string>; values: [string, string][] }>();

  for (const log of logs) {
    const labels = extractStreamLabels(log, serviceName);
    // Use sorted label key-value pairs as stream key for consistent grouping
    const streamKey = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');

    let stream = streams.get(streamKey);
    if (!stream) {
      stream = { labels, values: [] };
      streams.set(streamKey, stream);
    }

    stream.values.push([dateToNanoString(log.timestamp), buildLogLine(log)]);
  }

  return streams;
}

/**
 * Format a batch of Mastra logs into a Loki push request (JSON).
 *
 * @param logs - The logs to format
 * @param serviceName - The service name used as the Loki `job` label
 * @returns The Loki JSON push request body
 */
export function formatLogsForLoki(logs: ExportedLog[], serviceName: string): LokiPushRequest {
  const groupedStreams = groupByStream(logs, serviceName);

  return {
    streams: Array.from(groupedStreams.values()).map(({ labels, values }) => ({
      stream: labels,
      values,
    })),
  };
}
