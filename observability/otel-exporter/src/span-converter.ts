/**
 * Convert Mastra Spans to OpenTelemetry spans
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api';
import type { HrTime, Link, SpanContext, SpanStatus } from '@opentelemetry/api';
import type { InstrumentationScope } from '@opentelemetry/core';
import type { Resource } from '@opentelemetry/resources';
import { resourceFromAttributes } from '@opentelemetry/resources';

import type { ReadableSpan, TimedEvent } from '@opentelemetry/sdk-trace-base';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_TELEMETRY_SDK_LANGUAGE,
  ATTR_TELEMETRY_SDK_NAME,
  ATTR_TELEMETRY_SDK_VERSION,
} from '@opentelemetry/semantic-conventions';

import { getAttributes, getSpanName } from './gen-ai-semantics.js';
import type { OtelExporterConfig } from './types.js';

export type SpanFormat = 'GenAI_v1_38_0';

// If more formats come later:
// export type SpanFormat =
//   | "GenAI_v1_38_0"
//   | "GenAI_v1_38_0"
//   | "Custom_v2";

export class SpanConverter {
  private resource?: Resource;
  private scope?: InstrumentationScope;
  private initPromise?: Promise<void>;
  private format: SpanFormat;

  constructor(
    private readonly params: {
      format: SpanFormat;
      packageName: string;
      serviceName?: string;
      config?: OtelExporterConfig;
    },
  ) {
    this.format = params.format;
  }

  /**
   * Lazily initialize resource & scope on first use.
   * Subsequent calls reuse the same promise (no races).
   */
  private async initIfNeeded(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const packageVersion = (await getPackageVersion(this.params.packageName)) ?? 'unknown';

      const serviceVersion = (await getPackageVersion('@mastra/core')) ?? 'unknown';

      let resource = resourceFromAttributes({
        [ATTR_SERVICE_NAME]: this.params.serviceName || 'mastra-service',
        [ATTR_SERVICE_VERSION]: serviceVersion,
        [ATTR_TELEMETRY_SDK_NAME]: this.params.packageName,
        [ATTR_TELEMETRY_SDK_VERSION]: packageVersion,
        [ATTR_TELEMETRY_SDK_LANGUAGE]: 'nodejs',
      });

      if (this.params.config?.resourceAttributes) {
        resource = resource.merge(
          // Duplicate attributes from config will override defaults above
          resourceFromAttributes(this.params.config.resourceAttributes),
        );
      }

      this.resource = resource;
      this.scope = {
        name: this.params.packageName,
        version: packageVersion,
      };
    })();

    return this.initPromise;
  }

  /**
   * Convert a Mastra Span to an OpenTelemetry ReadableSpan
   */
  async convertSpan(span: AnyExportedSpan): Promise<ReadableSpan> {
    await this.initIfNeeded();

    if (!this.resource || !this.scope) {
      throw new Error('SpanConverter not initialized correctly');
    }

    // --- Core fields derived from Mastra span ---
    const name = getSpanName(span);
    const kind = getSpanKind(span.type);
    const attributes = getAttributes(span);

    // Add metadata as custom attributes (not gen_ai specific)
    if (span.metadata) {
      for (const [k, v] of Object.entries(span.metadata)) {
        if (v === null || v === undefined) {
          continue;
        }
        attributes[`mastra.metadata.${k}`] = typeof v === 'object' ? JSON.stringify(v) : v;
      }
    }

    // Add tags for root spans (only root spans can have tags)
    // Tags are JSON-stringified for maximum backend compatibility
    // While OTEL spec supports arrays, many backends (Jaeger, Zipkin, Tempo) don't fully support them
    if (span.isRootSpan && span.tags?.length) {
      attributes['mastra.tags'] = JSON.stringify(span.tags);
    }

    const startTime = dateToHrTime(span.startTime);
    const endTime = span.endTime ? dateToHrTime(span.endTime) : startTime;
    const duration = computeDuration(span.startTime, span.endTime);

    const { status, events } = buildStatusAndEvents(span, startTime);

    const spanContext: SpanContext = {
      traceId: span.traceId,
      spanId: span.id,
      traceFlags: TraceFlags.SAMPLED,
      isRemote: false,
    };

    const parentSpanContext = span.parentSpanId
      ? {
          traceId: span.traceId,
          spanId: span.parentSpanId,
          traceFlags: TraceFlags.SAMPLED,
          isRemote: false,
        }
      : undefined;

    const links: Link[] = []; // fill if you add link support later

    const readable: ReadableSpan = {
      name,
      kind,
      spanContext: () => spanContext,
      parentSpanContext,
      startTime,
      endTime,
      status,
      attributes,
      links,
      events,
      duration,
      ended: !!span.endTime,
      resource: this.resource,
      instrumentationScope: this.scope,
      droppedAttributesCount: 0,
      droppedEventsCount: 0,
      droppedLinksCount: 0,
    };

    return readable;
  }
}

async function getPackageVersion(pkgName: string): Promise<string | undefined> {
  try {
    // Resolve `package.json` for the given package
    const manifestUrl = new URL(await import.meta.resolve(`${pkgName}/package.json`));

    const path = fileURLToPath(manifestUrl);
    const pkgJson = JSON.parse(readFileSync(path, 'utf8'));
    return pkgJson.version;
  } catch {
    return undefined;
  }
}

/**
 * Get the appropriate Otel SpanKind based on Mastra SpanType.
 *
 * @param type - The Mastra span type
 * @returns The appropriate OTEL SpanKind
 */
export function getSpanKind(type: SpanType): SpanKind {
  switch (type) {
    case SpanType.MODEL_GENERATION:
    case SpanType.MCP_TOOL_CALL:
      return SpanKind.CLIENT;
    default:
      return SpanKind.INTERNAL;
  }
}

/**
 * Convert JavaScript Date to hrtime format
 */
function dateToHrTime(date: Date): HrTime {
  const ms = date.getTime();
  const seconds = Math.floor(ms / 1000);
  const nanoseconds = (ms % 1000) * 1000000;
  return [seconds, nanoseconds];
}

function computeDuration(start: Date, end?: Date): HrTime {
  if (!end) return [0, 0];
  const diffMs = end.getTime() - start.getTime();
  return [Math.floor(diffMs / 1000), (diffMs % 1000) * 1_000_000];
}

/**
 * Build status + events from span.errorInfo (if present)
 */
function buildStatusAndEvents(
  span: AnyExportedSpan,
  defaultTime: HrTime,
): { status: SpanStatus; events: TimedEvent[] } {
  const events: TimedEvent[] = [];

  if (span.errorInfo) {
    const status: SpanStatus = {
      code: SpanStatusCode.ERROR,
      message: span.errorInfo.message,
    };

    events.push({
      name: 'exception',
      attributes: {
        'exception.message': span.errorInfo.message,
        'exception.type': 'Error',
        ...(span.errorInfo.details?.stack && {
          'exception.stacktrace': span.errorInfo.details.stack as string,
        }),
      },
      time: defaultTime,
      droppedAttributesCount: 0,
    });

    return { status, events };
  }

  if (span.endTime) {
    return {
      status: { code: SpanStatusCode.OK },
      events,
    };
  }

  return {
    status: { code: SpanStatusCode.UNSET },
    events,
  };
}
