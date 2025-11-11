# Updated Implementation Plan (Post-Discussion)

## Changes Based on Feedback

### User Responses to Open Questions

1. **RequestContext convention** → Use OTEL packages/middleware instead where possible
   - **Action**: Design framework-agnostic approach using OTEL's W3CTraceContextPropagator
   - **See**: [FRAMEWORK_AGNOSTIC_DESIGN.md](./FRAMEWORK_AGNOSTIC_DESIGN.md)

2. **Sampling interaction** → Respect OTEL sampling in bridge mode, ignore Mastra's sampling
   - **Action**: When bridge provides context with `isSampled: false`, create NoOpSpan
   - **Implementation**: Simple logic in `getOrCreateSpan()`

3. **Export strategy** → Auto-detect if possible
   - **Action**: Try `useActiveProvider` first, fallback to standalone
   - **Implementation**: Check for `trace.getTracerProvider()` in bridge setup

4. **Span kind mapping** → Reuse OtelExporter logic
   - **Action**: Share SpanConverter between OtelExporter and OtelBridge
   - **Implementation**: Move to shared location or import from otel-exporter

5. **Error handling** → Create new trace + log warning
   - **Action**: Wrap `getCurrentContext()` in try/catch, log and continue
   - **Implementation**: Simple error boundary

6. **Bridge vs Exporter** → Keep separate for now
   - **Action**: Maintain ObservabilityBridge as distinct interface
   - **Note**: May revisit based on implementation experience

7. **Multiple bridges** → Start with 0 or 1 bridges
   - **Action**: Single optional bridge in config
   - **Implementation**: `bridge?: ObservabilityBridge` (not array)

### Additional Scenarios Identified

See [ALL_SCENARIOS.md](./ALL_SCENARIOS.md) for complete analysis:

- **Scenario C**: Message Queues (Kafka, RabbitMQ, SQS)
- **Scenario D**: Background/Scheduled Jobs
- **Scenario E**: Serverless/Edge Functions
- **Scenario F**: WebSocket/SSE Streaming
- **Scenario G**: gRPC Services
- **Scenario H**: Multi-tenant/Multi-region

**Phase 1 Coverage**: Scenarios A, B, E (partially)
**Phase 2+**: Document patterns for remaining scenarios

## Revised Architecture

### Core Principle: OTEL-First

Use OTEL packages wherever possible:

```typescript
import { trace, context } from '@opentelemetry/api'; // Standard API
import { W3CTraceContextPropagator } from '@opentelemetry/core'; // Standard propagator
```

### Three-Tier Support Strategy

**Tier 1: Auto-Instrumentation** (Best UX)

- User has OTEL NodeSDK initialized
- Mastra works automatically
- Zero configuration needed

**Tier 2: Middleware Helpers** (Good UX)

- Framework-specific middleware
- One-line setup
- Optional convenience layer

**Tier 3: Manual Extraction** (Universal Fallback)

- `RuntimeContext.with()` pattern
- Works everywhere
- Required for custom scenarios

## Updated Implementation Plan

### Phase 1: Core Bridge (P0 - Week 1)

#### 1.1 Core Package Changes

**File**: `packages/core/src/observability/types/tracing.ts`

```typescript
export interface ObservabilityBridge {
  name: string;
  init?(options: InitBridgeOptions): void;
  __setLogger?(logger: IMastraLogger): void;

  /**
   * Get current OTEL context for span creation
   * Returns undefined if no OTEL context available
   */
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined;

  /**
   * Export Mastra tracing events to OTEL infrastructure
   */
  exportTracingEvent(event: TracingEvent): Promise<void>;

  shutdown(): Promise<void>;
}
```

Add to `ObservabilityInstanceConfig`:

```typescript
export interface ObservabilityInstanceConfig {
  // ... existing fields ...
  bridge?: ObservabilityBridge; // NEW: Optional OTEL bridge
}
```

Add to `ObservabilityInstance`:

```typescript
export interface ObservabilityInstance {
  // ... existing methods ...
  getBridge(): ObservabilityBridge | undefined; // NEW
}
```

**File**: `packages/core/src/observability/utils.ts`

Update `getOrCreateSpan()`:

```typescript
export function getOrCreateSpan<T extends SpanType>(options: GetOrCreateSpanOptions<T>): Span<T> | undefined {
  const { type, attributes, tracingContext, requestContext, tracingOptions, ...rest } = options;

  const metadata = {
    ...(rest.metadata ?? {}),
    ...(tracingOptions?.metadata ?? {}),
  };

  // If we have a current span, create a child span
  if (tracingContext?.currentSpan) {
    return tracingContext.currentSpan.createChildSpan({
      type,
      attributes,
      ...rest,
      metadata,
    });
  }

  // NEW: Try to get OTEL context from bridge
  let enhancedTracingOptions = tracingOptions;
  // RESPONSE: Can we just update the existing tracingOptions type/interface to optionally include the new properties?

  if (!tracingOptions?.traceId) {
    const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
    const bridge = instance?.getBridge();

    if (bridge) {
      try {
        const bridgeContext = bridge.getCurrentContext(requestContext);

        if (bridgeContext) {
          // DECISION: Respect OTEL sampling in bridge mode
          if (!bridgeContext.isSampled) {
            return undefined; // Create NoOpSpan (or return undefined)
          }

          enhancedTracingOptions = {
            ...tracingOptions,
            traceId: bridgeContext.traceId,
            parentSpanId: bridgeContext.parentSpanId,
          };
        }
      } catch (error) {
        // DECISION: Log warning and continue with new trace
        instance.getLogger().warn('Failed to get OTEL context from bridge, creating new trace:', error);
      }
    }
  }

  // Create new root span
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
  // RESPONSE: maybe move this get higher up in the call, so we don't need to duplicate get in the "if (!tracingOptions?.traceId) {" section?

  return instance?.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions: enhancedTracingOptions,
    traceId: enhancedTracingOptions?.traceId,
    parentSpanId: enhancedTracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
```

**File**: `observability/mastra/src/instances/base.ts`

```typescript
export abstract class BaseObservabilityInstance implements ObservabilityInstance {
  protected config: Required<ObservabilityInstanceConfig>;
  protected exporters: readonly ObservabilityExporter[];
  protected spanOutputProcessors: readonly SpanOutputProcessor[];
  protected bridge?: ObservabilityBridge; // NEW
  protected logger: IMastraLogger;

  constructor(config: ObservabilityInstanceConfig) {
    // UPDATED: Validate at least exporters OR bridge
    if (!config.exporters?.length && !config.bridge) {
      throw new Error('ObservabilityInstance requires at least one exporter or a bridge');
    }

    this.bridge = config.bridge; // NEW

    // Initialize bridge if present
    if (this.bridge?.init) {
      this.bridge.init({ config: this.config });
    }

    // ... rest of constructor
  }

  // NEW METHOD
  getBridge(): ObservabilityBridge | undefined {
    return this.bridge;
  }

  // UPDATED: Include bridge in event distribution
  protected async emitTracingEvent(event: TracingEvent): Promise<void> {
    const targets: Array<ObservabilityExporter | ObservabilityBridge> = [...this.exporters];

    if (this.bridge) {
      targets.push(this.bridge);
    }

    const results = await Promise.allSettled(targets.map(target => target.exportTracingEvent(event)));

    // Log failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const target = targets[index];
        this.logger.error(`Failed to export ${event.type} event to ${target.name}:`, result.reason);
      }
    });
  }

  // UPDATED: Include bridge in shutdown
  async shutdown(): Promise<void> {
    const targets = [...this.exporters, ...this.spanOutputProcessors];

    if (this.bridge) {
      targets.push(this.bridge);
    }

    await Promise.allSettled(targets.map(target => target.shutdown()));
    this.logger.info(`ObservabilityInstance [name=${this.config.name}] shutdown complete`);
  }

  // UPDATED: Set logger on bridge
  __setLogger(logger: IMastraLogger): void {
    this.logger = logger;

    // Set logger on all exporters
    this.exporters.forEach(exporter => {
      exporter.__setLogger?.(logger);
    });

    // NEW: Set logger on bridge
    if (this.bridge?.__setLogger) {
      this.bridge.__setLogger(logger);
    }

    this.logger.debug(
      `ObservabilityInstance initialized [name=${this.config.name}, ` +
        `exporters=${this.exporters.length}, bridge=${!!this.bridge}]`,
    );
  }
}
```

#### 1.2 OtelBridge Implementation

**Package**: `observability/otel-bridge`

**Dependencies**:

```json
{
  "dependencies": {
    "@mastra/observability": "workspace:*",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/core": "^2.1.0",
    "@opentelemetry/resources": "^2.1.0",
    "@opentelemetry/sdk-trace-base": "^2.1.0",
    "@opentelemetry/semantic-conventions": "^1.37.0"
  },
  "devDependencies": {
    "@mastra/core": "workspace:*"
  },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0"
  }
}
```

**Configuration Interface**:

```typescript
export interface OtelBridgeConfig extends BaseExporterConfig {
  /**
   * Where to extract OTEL context from
   * - 'active-context': trace.getSpan(context.active())
   * - 'headers': RequestContext with 'otel.headers'
   * - 'both': Try active first, then headers (DEFAULT)
   */
  extractFrom?: 'active-context' | 'headers' | 'both';

  /**
   * How to export spans to OTEL
   */
  export?: {
    /**
     * Use active OTEL TracerProvider (if available)
     * Best for Scenario B where OTEL SDK is initialized
     */
    useActiveProvider?: boolean;

    /**
     * Custom SpanExporter instance
     */
    exporter?: SpanExporter;

    /**
     * Standalone OTEL exporter configuration
     * Best for Scenario A where no OTEL SDK exists
     */
    provider?: {
      endpoint: string;
      headers?: Record<string, string>;
      protocol?: 'http/protobuf' | 'http/json' | 'grpc';
    };
  };

  /**
   * Resource attributes for exported spans
   */
  resourceAttributes?: Attributes;
}
```

**Main Implementation**:

```typescript
import { trace, context } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BaseExporter } from '@mastra/observability';
import type { ObservabilityBridge, TracingEvent, InitBridgeOptions } from '@mastra/core/observability';
import type { RequestContext } from '@mastra/core/runtime-context';

// DECISION: Reuse SpanConverter from otel-exporter
import { SpanConverter } from '@mastra/otel-exporter/span-converter';

export class OtelBridge extends BaseExporter implements ObservabilityBridge {
  name = 'otel-bridge';

  private config: OtelBridgeConfig;
  private propagator: W3CTraceContextPropagator;
  private spanConverter: SpanConverter;
  private processor?: BatchSpanProcessor;
  private isSetup: boolean = false;

  constructor(config: OtelBridgeConfig = {}) {
    super(config);
    this.config = {
      extractFrom: 'both', // DEFAULT
      ...config,
    };

    // Use OTEL's standard propagator
    this.propagator = new W3CTraceContextPropagator();
    this.spanConverter = new SpanConverter();
  }

  getCurrentContext(requestContext?: RequestContext) {
    const extractFrom = this.config.extractFrom;

    // Strategy 1: Active OTEL context (Scenario B)
    if (extractFrom === 'active-context' || extractFrom === 'both') {
      const activeContext = this.getActiveContext();
      if (activeContext) return activeContext;
    }

    // Strategy 2: W3C headers (Scenario A)
    if (extractFrom === 'headers' || extractFrom === 'both') {
      const headerContext = this.getHeaderContext(requestContext);
      if (headerContext) return headerContext;
    }

    return undefined;
  }

  private getActiveContext() {
    try {
      // OTEL standard API - works everywhere
      const activeSpan = trace.getSpan(context.active());
      if (!activeSpan) return undefined;

      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    } catch (error) {
      this.logger.debug('Failed to get active OTEL context:', error);
      return undefined;
    }
  }

  private getHeaderContext(requestContext?: RequestContext) {
    if (!requestContext) return undefined;

    try {
      const headers = requestContext.get('otel.headers');
      if (!headers?.traceparent) return undefined;

      // Use OTEL's W3C propagator
      const extractedContext = this.propagator.extract(context.active(), headers, {
        get: (carrier: any, key: string) => carrier[key],
        keys: (carrier: any) => Object.keys(carrier),
      });

      const span = trace.getSpan(extractedContext);
      if (!span) return undefined;

      const spanContext = span.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    } catch (error) {
      this.logger.debug('Failed to extract context from headers:', error);
      return undefined;
    }
  }

  protected async _exportTracingEvent(event: TracingEvent): Promise<void> {
    // Only export completed spans
    if (event.type !== 'span_ended') {
      return;
    }

    if (!this.isSetup) {
      await this.setupExporter();
      this.isSetup = true;
    }

    if (this.isDisabled || !this.processor) {
      return;
    }

    try {
      // DECISION: Reuse SpanConverter from otel-exporter
      const readableSpan = this.spanConverter.convertSpan(event.exportedSpan);

      await new Promise<void>(resolve => {
        this.processor!.onEnd(readableSpan);
        resolve();
      });

      this.logger.debug(`Exported span ${event.exportedSpan.id} to OTEL ` + `(trace: ${event.exportedSpan.traceId})`);
    } catch (error) {
      this.logger.error('Failed to export span to OTEL:', error);
    }
  }

  private async setupExporter(): Promise<void> {
    // DECISION: Auto-detect active provider first
    if (this.config.export?.useActiveProvider !== false) {
      const activeProvider = this.tryGetActiveProvider();
      if (activeProvider) {
        this.logger.info('Using active OTEL TracerProvider');
        // Setup with active provider
        return;
      }
    }

    // Fallback to standalone exporter
    // Similar logic to observability/otel-exporter/src/tracing.ts
    // ... implementation ...
  }

  private tryGetActiveProvider() {
    try {
      const provider = trace.getTracerProvider();
      // Check if it's a real provider (not NoopTracerProvider)
      if (provider && 'getTracer' in provider) {
        return provider;
      }
    } catch (error) {
      this.logger.debug('No active OTEL provider found');
    }
    return undefined;
  }

  async shutdown(): Promise<void> {
    if (this.processor) {
      await this.processor.shutdown();
    }
    this.logger.info('OtelBridge shutdown complete');
  }
}
```

#### 1.3 Tests

```typescript
// packages/core/src/observability/utils.test.ts
describe('getOrCreateSpan with bridge', () => {
  it('should use bridge context when available', () => {
    // Test that bridge.getCurrentContext() is called
    // Test that returned context is used for span creation
  });

  it('should respect isSampled=false from bridge', () => {
    // Test that NoOpSpan is created when isSampled=false
  });

  it('should handle bridge errors gracefully', () => {
    // Test that errors are logged and new trace is created
  });
});

// observability/otel-bridge/src/bridge.test.ts
describe('OtelBridge', () => {
  describe('getCurrentContext', () => {
    it('should extract from active context', () => {
      // Mock trace.getSpan(context.active())
      // Test extraction
    });

    it('should extract from headers via RequestContext', () => {
      // Mock RequestContext with headers
      // Test extraction
    });

    it('should try both strategies with extractFrom=both', () => {
      // Test fallback behavior
    });
  });

  describe('exportTracingEvent', () => {
    it('should convert and export Mastra spans', () => {
      // Test span conversion and export
    });
  });
});
```

### Phase 2: Helpers & Documentation (P1 - Week 2)

#### 2.1 Generic Helpers

```typescript
// observability/otel-bridge/src/helpers.ts
export function extractOtelHeaders(headers: Record<string, string | undefined>) {
  return {
    traceparent: headers['traceparent'],
    tracestate: headers['tracestate'],
  };
}

export function createOtelContext(headers: Record<string, string | undefined>) {
  return new Map([['otel.headers', extractOtelHeaders(headers)]]);
}
```

#### 2.2 Framework Middleware (Optional Packages)

Implement middleware for:

- Hono (highest priority - works everywhere)
- Fastify (fast backend APIs)
- Express (most common)

See [FRAMEWORK_AGNOSTIC_DESIGN.md](./FRAMEWORK_AGNOSTIC_DESIGN.md) for implementation details.

#### 2.3 Documentation

Create comprehensive docs:

- **Quick Start**: Three-tier approach (auto, middleware, manual)
- **Framework Guides**: For each supported framework
- **Scenario Patterns**: Message queues, background jobs, etc.
- **Troubleshooting**: Common issues and solutions

### Phase 3: Advanced Features (P2 - Week 3+)

#### 3.1 Additional Middleware

- Koa middleware
- NestJS module/interceptor
- Next.js middleware
- Remix loader/action helpers

#### 3.2 Special Scenarios

- WebSocket context handling
- gRPC metadata extraction
- AWS Lambda + X-Ray converter
- Message queue patterns (Kafka, RabbitMQ, etc.)

#### 3.3 Advanced Features

- Custom propagators
- Baggage/tracestate utilities
- Multi-tenant context helpers
- Performance optimizations

## Testing Strategy

### Unit Tests

- Core bridge functionality
- Context extraction (active and headers)
- Span conversion and export
- Error handling

### Integration Tests

- Scenario A: HTTP headers (Hono example)
- Scenario B: Active context (Internal example)
- Export to various OTEL backends (Jaeger, Zipkin, OTLP)
- Sampling behavior
- Multiple frameworks

### Manual Testing

- Real OTEL backends (Arize, Honeycomb, DataDog)
- Kubernetes deployments
- Serverless platforms
- Edge runtimes

## Success Criteria

### Phase 1 (Must Have)

- ✅ Bridge extracts context from active OTEL span
- ✅ Bridge extracts context from W3C headers
- ✅ Bridge exports spans to OTEL collectors
- ✅ Sampling is respected in bridge mode
- ✅ Works with Hono example (Scenario A)
- ✅ Works with Internal example (Scenario B)

### Phase 2 (Should Have)

- ✅ Hono middleware helper
- ✅ Fastify plugin helper
- ✅ Express middleware helper
- ✅ Comprehensive documentation
- ✅ Framework-specific guides

### Phase 3 (Nice to Have)

- ✅ Additional framework support
- ✅ Special scenario patterns
- ✅ Advanced features (baggage, custom propagators)

## Timeline

| Phase   | Duration | Deliverables                     |
| ------- | -------- | -------------------------------- |
| Phase 1 | 1 week   | Core bridge, basic tests         |
| Phase 2 | 1 week   | Helpers, docs, integration tests |
| Phase 3 | 2+ weeks | Advanced features, polish        |

**Total MVP**: 2 weeks (Phase 1 + Phase 2)
**Full Release**: 4 weeks (including Phase 3)

## Questions Resolved

All open questions from [RESEARCH_FINDINGS.md](./RESEARCH_FINDINGS.md) have been answered:

1. ✅ RequestContext convention → Use OTEL packages where possible
2. ✅ Sampling interaction → Respect OTEL sampling in bridge mode
3. ✅ Export strategy → Auto-detect active provider
4. ✅ Span mapping → Reuse OtelExporter logic
5. ✅ Error handling → Log warning, create new trace
6. ✅ Bridge vs Exporter → Keep separate
7. ✅ Multiple bridges → Start with 0-1 bridges

## Next Steps

1. ✅ Review and approve this updated plan
2. ⏭️ Create GitHub issues for Phase 1 tasks
3. ⏭️ Begin implementation of core changes
4. ⏭️ Iterate based on testing feedback

## References

- [ALL_SCENARIOS.md](./ALL_SCENARIOS.md) - Complete scenario analysis
- [FRAMEWORK_AGNOSTIC_DESIGN.md](./FRAMEWORK_AGNOSTIC_DESIGN.md) - Framework support strategy
- [RESEARCH_FINDINGS.md](./RESEARCH_FINDINGS.md) - Original research with user responses
- [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - Original implementation plan
