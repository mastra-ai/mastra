/**
 * Dynamic loader for optional OTel signal exporters.
 *
 * Each combination of signal (traces/logs/metrics) and protocol (http/json,
 * http/protobuf, grpc, zipkin) maps to a different npm package. We dynamically
 * import only the one the user's provider config requires, and cache the
 * constructor so subsequent calls are free.
 */

import type { ExportProtocol } from './types.js';

export type SignalType = 'traces' | 'logs' | 'metrics';

// ---------------------------------------------------------------------------
// Package / export-name matrix
// ---------------------------------------------------------------------------

interface ExporterSpec {
  /** npm package to dynamic-import */
  pkg: string;
  /** Named export to pull from the package */
  exportName: string;
  /** Extra packages to mention in the install hint (e.g. @grpc/grpc-js) */
  extras?: string[];
}

type ProtocolKey = 'http/json' | 'http/protobuf' | 'grpc' | 'zipkin';

const EXPORTER_SPECS: Record<SignalType, Partial<Record<ProtocolKey, ExporterSpec>>> = {
  traces: {
    'http/json': { pkg: '@opentelemetry/exporter-trace-otlp-http', exportName: 'OTLPTraceExporter' },
    'http/protobuf': { pkg: '@opentelemetry/exporter-trace-otlp-proto', exportName: 'OTLPTraceExporter' },
    grpc: {
      pkg: '@opentelemetry/exporter-trace-otlp-grpc',
      exportName: 'OTLPTraceExporter',
      extras: ['@grpc/grpc-js'],
    },
    zipkin: { pkg: '@opentelemetry/exporter-zipkin', exportName: 'ZipkinExporter' },
  },
  logs: {
    'http/json': { pkg: '@opentelemetry/exporter-logs-otlp-http', exportName: 'OTLPLogExporter' },
    'http/protobuf': { pkg: '@opentelemetry/exporter-logs-otlp-proto', exportName: 'OTLPLogExporter' },
    grpc: {
      pkg: '@opentelemetry/exporter-logs-otlp-grpc',
      exportName: 'OTLPLogExporter',
      extras: ['@grpc/grpc-js'],
    },
    // zipkin: not supported
  },
  metrics: {
    'http/json': { pkg: '@opentelemetry/exporter-metrics-otlp-http', exportName: 'OTLPMetricExporter' },
    'http/protobuf': { pkg: '@opentelemetry/exporter-metrics-otlp-proto', exportName: 'OTLPMetricExporter' },
    grpc: {
      pkg: '@opentelemetry/exporter-metrics-otlp-grpc',
      exportName: 'OTLPMetricExporter',
      extras: ['@grpc/grpc-js'],
    },
    // zipkin: not supported
  },
};

// ---------------------------------------------------------------------------
// Cache + loader
// ---------------------------------------------------------------------------

/** Cache keyed by "signal:protocol" */
const cache = new Map<string, any>();

/**
 * Load a trace exporter for the given protocol.
 * Backward-compatible with existing usage in tracing.ts.
 */
export async function loadExporter(protocol: ExportProtocol, provider?: string): Promise<any> {
  return loadSignalExporter('traces', protocol, provider);
}

/**
 * Load a signal-specific exporter class for the given protocol.
 * Returns the constructor, or null if the package isn't installed.
 */
export async function loadSignalExporter(
  signal: SignalType,
  protocol: ExportProtocol,
  provider?: string,
): Promise<any> {
  const spec = EXPORTER_SPECS[signal]?.[protocol];

  if (!spec) {
    if (protocol === 'zipkin') {
      console.warn(
        `[OtelExporter] Zipkin does not support OTLP ${signal}. ${capitalize(signal)} export will be disabled.`,
      );
    }
    return null;
  }

  const cacheKey = `${signal}:${protocol}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  try {
    const mod = await import(spec.pkg);
    const ExporterClass = mod[spec.exportName];
    cache.set(cacheKey, ExporterClass);
    return ExporterClass;
  } catch {
    const providerInfo = provider ? ` (required for ${provider})` : '';
    const allPkgs = [spec.pkg, ...(spec.extras ?? [])].join(' ');
    console.error(
      `[OtelExporter] ${capitalize(signal)} ${protocol} exporter is not installed${providerInfo}.\n` +
        `  Install the required package(s):\n` +
        `  npm install ${allPkgs}`,
    );
    return null;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
