# OpenTelemetry Bridge Scenarios

This document details the two primary integration scenarios for the OtelBridge.

## Scenario 1: HTTP Headers (Microservices)

### Example

User repository: https://github.com/treasur-inc/mastra-hono-tracing-example

### Context

Service-to-service communication where trace context is propagated via HTTP headers.

### Architecture

```
┌──────────────┐     HTTP + traceparent header     ┌──────────────┐
│ Service One  │────────────────────────────────────>│ Service Two  │
│ (Hono+OTEL)  │                                     │ (Hono+OTEL)  │
└──────────────┘                                     └──────┬───────┘
                                                            │
                                                            │ HTTP + traceparent header
                                                            │
                                                     ┌──────▼───────┐
                                                     │Service Mastra│
                                                     │ (Mastra)     │
                                                     └──────────────┘
```

### Problem

- W3C `traceparent` header is sent: `00-{traceId}-{spanId}-{flags}`
- Mastra doesn't read the header
- Mastra creates a NEW trace with different traceId
- Result: Disconnected traces in observability backend (Arize)

### Current Traces

```
Trace 1 (traceId: abc123):
  ├─ service-one HTTP span
  └─ service-two HTTP span

Trace 2 (traceId: def456):  ← WRONG! Should be part of Trace 1
  ├─ service-mastra agent.run
  ├─ service-mastra model.generate
  └─ service-mastra tool.call
```

### Desired Traces

```
Trace 1 (traceId: abc123):
  ├─ service-one HTTP span
  ├─ service-two HTTP span
  └─ service-mastra agent.run (parent: service-two)
      ├─ service-mastra model.generate
      └─ service-mastra tool.call
```

### Solution Pattern

#### 1. User extracts headers into RequestContext

```typescript
import { Hono } from 'hono';
import { RuntimeContext } from '@mastra/core/runtime-context';

const app = new Hono();

app.post('/api/chat', async c => {
  // Extract W3C Trace Context headers
  const traceparent = c.req.header('traceparent');
  const tracestate = c.req.header('tracestate');

  // Store in RequestContext for bridge to access
  const result = await RuntimeContext.with(new Map([['otel.headers', { traceparent, tracestate }]]), async () => {
    return await agent.generate({
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  return c.json(result);
});
```

#### 2. Bridge extracts context from headers

```typescript
class OtelBridge {
  getCurrentContext(requestContext?: RequestContext) {
    // Get headers from RequestContext
    const headers = requestContext?.get('otel.headers');
    if (!headers?.traceparent) return undefined;

    // Extract using W3C propagator
    const propagator = new W3CTraceContextPropagator();
    const ctx = propagator.extract(ROOT_CONTEXT, headers, ...);

    // Return traceId and parentSpanId
    const span = trace.getSpan(ctx);
    return {
      traceId: span.spanContext().traceId,
      parentSpanId: span.spanContext().spanId,
      isSampled: (span.spanContext().traceFlags & 1) === 1,
    };
  }
}
```

#### 3. Mastra injects context into spans

```typescript
// In getOrCreateSpan()
const bridgeContext = bridge.getCurrentContext(requestContext);
if (bridgeContext) {
  tracingOptions = {
    traceId: bridgeContext.traceId,
    parentSpanId: bridgeContext.parentSpanId,
  };
}
```

#### 4. Bridge exports spans to same collector

```typescript
class OtelBridge {
  exportTracingEvent(event: TracingEvent) {
    // Convert Mastra span to OTEL span
    const otelSpan = this.spanConverter.convertSpan(event.exportedSpan);

    // Export to configured OTEL collector
    this.processor.onEnd(otelSpan);
  }
}
```

### Configuration

```typescript
const mastra = new Mastra({
  agents: { myAgent },
  observability: {
    configs: {
      default: {
        serviceName: 'service-mastra',
        bridge: new OtelBridge({
          extractFrom: 'headers', // Prioritize headers
          export: {
            provider: {
              endpoint: 'http://localhost:4318/v1/traces', // Same as other services
              protocol: 'http/protobuf',
            },
          },
        }),
      },
    },
  },
});
```

## Scenario 2: Active OTEL Context (Monolithic App)

### Example

`examples/stripped-agent-hub-export` (Internal production scenario)

### Context

Mastra code running inside a larger application that has OpenTelemetry SDK already initialized and managing trace context.

### Architecture

```
┌───────────────────────────────────────────────────────┐
│  Node.js Application                                  │
│                                                        │
│  ┌────────────────────────────────────────────────┐  │
│  │ OpenTelemetry NodeSDK (initialized at startup) │  │
│  │ - Auto-instrumentation (HTTP, Fastify, etc.)   │  │
│  │ - TracerProvider (active)                      │  │
│  │ - BatchSpanProcessor → OTLP Exporter           │  │
│  └────────────────────────────────────────────────┘  │
│                                                        │
│  HTTP Request → Fastify (auto-instrumented)           │
│                     ↓                                  │
│                 Route Handler                          │
│                     ↓                                  │
│             agent.generate() ← Active OTEL context     │
│                     ↓                                  │
│                 Mastra spans  ← Should be children     │
│                                                        │
└───────────────────────────────────────────────────────┘
```

### Setup

From `examples/stripped-agent-hub-export/src/core/telemetry/init.ts`:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const traceExporter = new OTLPTraceExporter();
const batchSpanProcessor = new BatchSpanProcessor(traceExporter);

export function startTelemetry() {
  const sdk = new NodeSDK({
    instrumentations: [
      ...getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          headersToSpanAttributes: {
            server: {
              requestHeaders: ['x-request-id', 'x-api-key'],
            },
          },
        },
      }),
    ],
    spanProcessors: [dataUriRemovingProcessor, batchSpanProcessor],
  });

  sdk.start(); // Registers global TracerProvider
  // ...
}
```

### Problem

- OTEL has active span context when Mastra code runs
- Mastra doesn't access `context.active()` to get current span
- Mastra creates independent trace
- Result: Disconnected traces in Jaeger

### Current Traces (in Jaeger)

```
Trace 1 (traceId: abc123):
  ├─ HTTP POST /demo/v1
  └─ Fastify route handler

Trace 2 (traceId: def456):  ← WRONG! Should be child of Trace 1
  ├─ agent.run
  ├─ model.generate
  └─ tool.call
```

### Desired Traces (in Jaeger)

```
Trace 1 (traceId: abc123):
  ├─ HTTP POST /demo/v1
  └─ Fastify route handler
      └─ agent.run (parent: route handler)
          ├─ model.generate
          └─ tool.call
```

### Solution Pattern

#### 1. Bridge detects active OTEL context

```typescript
import { trace, context } from '@opentelemetry/api';

class OtelBridge {
  getCurrentContext() {
    // Get active span from OTEL
    const activeSpan = trace.getSpan(context.active());
    if (!activeSpan) return undefined;

    const spanContext = activeSpan.spanContext();
    return {
      traceId: spanContext.traceId,
      parentSpanId: spanContext.spanId,
      isSampled: (spanContext.traceFlags & 1) === 1,
    };
  }
}
```

#### 2. No user code changes needed!

```typescript
// Existing code works as-is
app.post('/demo/v1', async (req, reply) => {
  // OTEL HTTP instrumentation already created a span
  // Bridge automatically detects it

  const result = await agent.generate({
    messages: [{ role: 'user', content: req.body.message }],
  });

  return result;
});
```

#### 3. Bridge exports through existing OTEL infrastructure

```typescript
class OtelBridge {
  exportTracingEvent(event: TracingEvent) {
    if (this.config.export?.useActiveProvider) {
      // Use the global TracerProvider that NodeSDK registered
      const tracer = trace.getTracer('@mastra/otel-bridge');

      // Create OTEL span that mirrors Mastra span
      // It will automatically be exported through existing BatchSpanProcessor
    } else {
      // Fall back to standalone export
    }
  }
}
```

### Configuration

```typescript
const mastra = new Mastra({
  agents: { scienceChatAgent },
  observability: {
    configs: {
      default: {
        serviceName: 'agent-hub', // Matches OTEL service name
        bridge: new OtelBridge({
          extractFrom: 'active-context', // Only check active context
          export: {
            useActiveProvider: true, // Use existing OTEL SDK
          },
        }),
      },
    },
  },
});
```

### Testing

From README:

```bash
# Start Jaeger
make start-depsonly

# Start app (OTEL initialized via instrumentation-hook.js)
npm start:dev

# Send request
curl --request POST \
  --url http://localhost:8080/demo/v1 \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: nonsense' \
  --data '{"message": "hello"}'

# Check Jaeger UI
open http://localhost:16686/
```

Expected: Single trace containing HTTP, Fastify, and Mastra spans.

## Scenario 3: Both (Recommended Default)

### Context

Support both scenarios simultaneously with fallback behavior.

### Configuration

```typescript
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'both', // DEFAULT: Try both strategies
          export: {
            useActiveProvider: true, // Try active provider first
            provider: {
              // Fallback to standalone
              endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
              protocol: 'http/protobuf',
            },
          },
        }),
      },
    },
  },
});
```

### Behavior

1. **Context Extraction** (in order):
   - Try `trace.getSpan(context.active())` first
   - If not found, try `requestContext.get('otel.headers')`
   - If neither found, create new trace (current behavior)

2. **Span Export** (in order):
   - Try using active TracerProvider
   - If not available, use standalone exporter
   - If neither configured, log warning

This provides maximum flexibility without requiring users to know their deployment scenario.

## Comparison Table

| Feature            | Scenario 1: Headers | Scenario 2: Active Context | Scenario 3: Both |
| ------------------ | ------------------- | -------------------------- | ---------------- |
| **Use Case**       | Microservices       | Monolithic app             | Universal        |
| **Context Source** | HTTP headers        | OTEL API                   | Either           |
| **User Code**      | Extract headers     | None                       | Optional headers |
| **Export**         | Standalone          | Active provider            | Either           |
| **Complexity**     | Medium              | Low                        | Low              |
| **Performance**    | Network overhead    | Shared processor           | Optimized        |

## Key Insights

1. **Scenario 2 is simpler for users**: No manual header extraction needed when OTEL SDK is initialized.

2. **Scenario 1 requires convention**: Users must extract headers into RequestContext with the `'otel.headers'` key.

3. **Both scenarios share span conversion**: The `SpanConverter` from `observability/otel-exporter` can be reused.

4. **Export strategy matters**: Using `useActiveProvider` in Scenario 2 is more efficient than standalone export.

5. **Scenario 3 (both) should be the default**: It works for both cases without requiring users to choose.

## Helper Utilities (Optional Future Enhancement)

### Automatic Header Extraction Middleware

To reduce boilerplate for Scenario 1:

```typescript
// For Hono
export function honoOtelMiddleware() {
  return async (c, next) => {
    const headers = {
      traceparent: c.req.header('traceparent'),
      tracestate: c.req.header('tracestate'),
    };

    await RuntimeContext.with(
      new Map([['otel.headers', headers]]),
      () => next()
    );
  };
}

// Usage
app.use(honoOtelMiddleware());

app.post('/api/chat', async (c) => {
  // Headers automatically available to bridge
  const result = await agent.generate({ ... });
  return c.json(result);
});
```

This could be provided as optional helpers in separate packages:

- `@mastra/otel-bridge-hono`
- `@mastra/otel-bridge-express`
- `@mastra/otel-bridge-fastify`

## References

- Scenario 1 Example: https://github.com/treasur-inc/mastra-hono-tracing-example
- Scenario 2 Example: `examples/stripped-agent-hub-export`
- W3C Trace Context Spec: https://www.w3.org/TR/trace-context/
- OTEL JS Context API: https://opentelemetry.io/docs/languages/js/context/
