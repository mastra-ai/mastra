import { MastraError } from '../../error';
import type {
  AISpanType,
  AITracing,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
} from '../types';
import { BaseAISpan, deepClean } from './base';

export class DefaultAISpan<TType extends AISpanType> extends BaseAISpan<TType> {
  public id: string;
  public traceId: string;

  constructor(options: CreateSpanOptions<TType>, aiTracing: AITracing) {
    super(options, aiTracing);

    // Set span ID: use external ID if provided, otherwise generate new
    this.id = generateSpanId();

    // Set trace ID based on context:
    if (options.parent) {
      // Child span inherits trace ID from parent span
      this.traceId = options.parent.traceId;
    } else if (options.externalTraceId) {
      // Root span with external trace ID
      if (!isValidTraceId(options.externalTraceId)) {
        throw new Error(`Invalid externalTraceId: must be 32 hexadecimal characters, got "${options.externalTraceId}"`);
      }
      this.traceId = options.externalTraceId;
    } else {
      // Root span without external trace ID - generate new
      this.traceId = generateTraceId();
    }

    // Set parent span ID if provided
    if (!options.parent && options.externalParentSpanId) {
      if (!isValidSpanId(options.externalParentSpanId)) {
        throw new Error(
          `Invalid externalParentSpanId: must be 16 hexadecimal characters, got "${options.externalParentSpanId}"`,
        );
      }
      this.externalParentSpanId = options.externalParentSpanId;
    }
  }

  end(options?: EndSpanOptions<TType>): void {
    if (this.isEvent) {
      return;
    }
    this.endTime = new Date();
    if (options?.output !== undefined) {
      this.output = deepClean(options.output);
    }
    if (options?.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes) };
    }
    if (options?.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata) };
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
      this.attributes = { ...this.attributes, ...deepClean(attributes) };
    }
    if (metadata) {
      this.metadata = { ...this.metadata, ...deepClean(metadata) };
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
      this.input = deepClean(options.input);
    }
    if (options.output !== undefined) {
      this.output = deepClean(options.output);
    }
    if (options.attributes) {
      this.attributes = { ...this.attributes, ...deepClean(options.attributes) };
    }
    if (options.metadata) {
      this.metadata = { ...this.metadata, ...deepClean(options.metadata) };
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
 * Validate OpenTelemetry-compatible trace ID (32 hex characters)
 */
function isValidTraceId(traceId: string): boolean {
  return /^[0-9a-f]{32}$/i.test(traceId);
}

/**
 * Validate OpenTelemetry-compatible span ID (16 hex characters)
 */
function isValidSpanId(spanId: string): boolean {
  return /^[0-9a-f]{16}$/i.test(spanId);
}
