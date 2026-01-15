import { MastraError } from '@mastra/core/error';
import type {
  SpanType,
  ObservabilityInstance,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
} from '@mastra/core/observability';
import { BaseSpan } from './base';
import { deepClean } from './serialization';

export class DefaultSpan<TType extends SpanType> extends BaseSpan<TType> {
  public id: string;
  public traceId: string;

  constructor(options: CreateSpanOptions<TType>, observabilityInstance: ObservabilityInstance) {
    super(options, observabilityInstance);

    // If spanId is provided, this is a rebuilt span - use provided IDs directly
    if (options.spanId) {
      this.id = options.spanId;
      this.traceId = options.traceId!;
      if (options.parentSpanId) {
        this.parentSpanId = options.parentSpanId;
      }
      return;
    }

    // If bridge and not internal span, use bridge to init span
    const bridge = observabilityInstance.getBridge();
    if (bridge && !this.isInternal) {
      const bridgeIds = bridge.createSpan(options);
      if (bridgeIds) {
        this.id = bridgeIds.spanId;
        this.traceId = bridgeIds.traceId;
        this.parentSpanId = bridgeIds.parentSpanId;
        return;
      }
    }

    // No bridge or bridge failed - generate IDs ourselves
    if (options.parent) {
      this.traceId = options.parent.traceId;
      this.parentSpanId = options.parent.id;
      this.id = generateSpanId();
      return;
    }

    this.traceId = getOrCreateTraceId(options);
    this.id = generateSpanId();

    if (options.parentSpanId) {
      if (isValidSpanId(options.parentSpanId)) {
        this.parentSpanId = options.parentSpanId;
      } else {
        console.error(
          `[Mastra Tracing] Invalid parentSpanId: must be 1-16 hexadecimal characters, got "${options.parentSpanId}". Ignoring.`,
        );
      }
    }
  }

  end(options?: EndSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }
    this.endTime = new Date();
    if (options?.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes, this.deepCleanOptions) };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata, this.deepCleanOptions) };
    }
    // Tracing events automatically handled by base class
  }

  error(options: ErrorSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }

    const { error, endSpan = true, attributes, metadata } = options;

    this.errorInfo =
      error instanceof MastraError
        ? {
            id: error.id,
            details: error.details,
            category: error.category,
            domain: error.domain,
            message: error.message,
          }
        : {
            message: error.message,
          };

    // Update attributes if provided
    if (attributes) {
      this.attributes = { ...this.attributes, ...deepClean(attributes, this.deepCleanOptions) };
    }
    if (metadata) {
      this.metadata = { ...this.metadata, ...deepClean(metadata, this.deepCleanOptions) };
    }

    if (endSpan) {
      this.end();
    } else {
      // Trigger span update event when not ending the span
      this.update({});
    }
  }

  update(options: UpdateSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }

    if (options.input !== undefined) {
      this.input = deepClean(options.input, this.deepCleanOptions);
    }
    if (options.output !== undefined) {
      this.output = deepClean(options.output, this.deepCleanOptions);
    }
    if (options.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes, this.deepCleanOptions) };
    }
    if (options.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata, this.deepCleanOptions) };
    }
    // Tracing events automatically handled by base class
  }

  get isValid(): boolean {
    return true;
  }

  async export(): Promise<string> {
    return JSON.stringify({
      spanId: this.id,
      traceId: this.traceId,
      startTime: this.startTime,
      endTime: this.endTime,
      attributes: this.attributes,
      metadata: this.metadata,
    });
  }
}

/**
 * Generate OpenTelemetry-compatible span ID (64-bit, 16 hex chars)
 */
function generateSpanId(): string {
  // Generate 8 random bytes (64 bits) in hex format
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate OpenTelemetry-compatible trace ID (128-bit, 32 hex chars)
 */
function generateTraceId(): string {
  // Generate 16 random bytes (128 bits) in hex format
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto.getRandomValues
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate OpenTelemetry-compatible trace ID (1-32 hex characters)
 */
function isValidTraceId(traceId: string): boolean {
  return /^[0-9a-f]{1,32}$/i.test(traceId);
}

/**
 * Validate OpenTelemetry-compatible span ID (1-16 hex characters)
 */
function isValidSpanId(spanId: string): boolean {
  return /^[0-9a-f]{1,16}$/i.test(spanId);
}

function getOrCreateTraceId(options: CreateSpanOptions<SpanType>): string {
  if (options.traceId) {
    if (isValidTraceId(options.traceId)) {
      return options.traceId;
    } else {
      console.error(
        `[Mastra Tracing] Invalid traceId: must be 1-32 hexadecimal characters, got "${options.traceId}". Generating new trace ID.`,
      );
    }
  }
  return generateTraceId();
}
