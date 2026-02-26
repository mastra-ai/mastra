/**
 * Convert Mastra ExportedLog to OpenTelemetry LogRecord format
 */

import type { ExportedLog, LogLevel } from '@mastra/core/observability';
import type { HrTime } from '@opentelemetry/api';
import type { LogAttributes } from '@opentelemetry/api-logs';
import { SeverityNumber } from '@opentelemetry/api-logs';

/**
 * Map Mastra LogLevel to OTEL SeverityNumber
 */
export function mapSeverity(level: LogLevel): SeverityNumber {
  switch (level) {
    case 'debug':
      return SeverityNumber.DEBUG;
    case 'info':
      return SeverityNumber.INFO;
    case 'warn':
      return SeverityNumber.WARN;
    case 'error':
      return SeverityNumber.ERROR;
    case 'fatal':
      return SeverityNumber.FATAL;
    default:
      return SeverityNumber.UNSPECIFIED;
  }
}

/**
 * Convert a Date to OTEL HrTime [seconds, nanoseconds]
 */
function dateToHrTime(date: Date): HrTime {
  const ms = date.getTime();
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = (ms % 1000) * 1_000_000;
  return [seconds, nanoseconds];
}

/**
 * Build OTEL log attributes from ExportedLog fields.
 * Includes trace correlation and metadata.
 */
export function buildLogAttributes(log: ExportedLog): LogAttributes {
  const attributes: LogAttributes = {};

  // Add structured data fields as attributes
  if (log.data) {
    for (const [key, value] of Object.entries(log.data)) {
      if (value === null || value === undefined) continue;
      attributes[`mastra.log.${key}`] =
        typeof value === 'object' ? JSON.stringify(value) : (value as string | number | boolean);
    }
  }

  // Add metadata as attributes
  if (log.metadata) {
    for (const [key, value] of Object.entries(log.metadata)) {
      if (value === null || value === undefined) continue;
      attributes[`mastra.metadata.${key}`] =
        typeof value === 'object' ? JSON.stringify(value) : (value as string | number | boolean);
    }
  }

  // Add tags if present
  if (log.tags?.length) {
    attributes['mastra.tags'] = JSON.stringify(log.tags);
  }

  return attributes;
}

/**
 * Parameters for emitting an OTEL log record from a Mastra ExportedLog.
 */
export interface OtelLogEmitParams {
  timestamp: HrTime;
  severityNumber: SeverityNumber;
  severityText: string;
  body: string;
  attributes: LogAttributes;
  traceId?: string;
  spanId?: string;
}

/**
 * Convert an ExportedLog into parameters suitable for OTEL Logger.emit()
 */
export function convertLog(log: ExportedLog): OtelLogEmitParams {
  return {
    timestamp: dateToHrTime(log.timestamp),
    severityNumber: mapSeverity(log.level),
    severityText: log.level.toUpperCase(),
    body: log.message,
    attributes: buildLogAttributes(log),
    traceId: log.traceId,
    spanId: log.spanId,
  };
}
