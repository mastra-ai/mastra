/**
 * OtelBridge Types
 */

import type { AnyExportedAISpan } from '@mastra/core/ai-tracing';

/**
 * Configuration for the OpenTelemetry bridge
 */
export interface OtelBridgeConfig {
  /**
   * Name of the tracer to use for creating OTEL spans
   * @default 'mastra'
   */
  tracerName?: string;

  /**
   * Version of the tracer
   * @default '1.0.0'
   */
  tracerVersion?: string;

  /**
   * Prefix for Mastra-specific attributes
   * @default 'mastra.'
   */
  attributePrefix?: string;

  /**
   * Whether to force export even for non-sampled spans
   * When true, creates OTEL spans even if OTEL sampling decision is negative
   * @default false
   */
  forceExport?: boolean;

  /**
   * Debug logging level
   * @default 'warn'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Additional resource attributes to attach to spans
   */
  resourceAttributes?: Record<string, string | number | boolean>;
}

/**
 * Data structure to track bridged spans
 */
export interface BridgedSpanData {
  /** The Mastra span */
  mastraSpan: AnyExportedAISpan;
  /** The corresponding OTEL span */
  otelSpan: any; // Using 'any' to avoid circular dependency with @opentelemetry/api
  /** Whether the span has been ended */
  ended: boolean;
}

/**
 * Registry to track active bridged spans
 */
export interface BridgedSpanRegistry {
  /** Map of spanId to BridgedSpanData */
  spans: Map<string, BridgedSpanData>;
  /** Map of traceId to set of spanIds */
  traceSpans: Map<string, Set<string>>;
}
