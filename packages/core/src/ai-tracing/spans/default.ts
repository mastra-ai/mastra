import { MastraError } from '../../error';
import { getAITracing } from '../registry';
import type {
  AISpanType,
  AITracing,
  EndSpanOptions,
  ErrorSpanOptions,
  UpdateSpanOptions,
  CreateSpanOptions,
  ExportedAISpan,
  AISpan,
} from '../types';
import { BaseAISpan, BaseExportedAISpan, deepClean } from './base';

export class DefaultAISpan<TType extends AISpanType> extends BaseAISpan<TType> {
  public id: string;
  public traceId: string;

  constructor(options: CreateSpanOptions<TType>, aiTracing: AITracing) {
    super(options, aiTracing);
    this.id = generateSpanId();

    // Set trace ID: generate new for root spans, inherit for child spans
    if (!options.parent) {
      // This is a root span, so it becomes its own trace with a new trace ID
      this.traceId = generateTraceId();
    } else {
      // Child span inherits trace ID from root span
      this.traceId = options.parent.traceId;
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

  public exportSpan(includeInternalSpans?: boolean): ExportedAISpan<TType> | undefined {
    return new DefaultExportedAISpan(this, includeInternalSpans);
  }
}

export class DefaultExportedAISpan<TType extends AISpanType = any> extends BaseExportedAISpan<TType> {
  public resumeSpan(): AISpan<TType> | undefined {
    const aiTracing = getAITracing(this.configName);
    //TODO: log a warning about the config not existing
    //ISSUE: this will create a child span off the parent... which doesn't exist
    // also we won't be able to recreate the parent span, so this will be treated like a root span?
    return aiTracing ? new DefaultAISpan(this, aiTracing) : undefined;
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
