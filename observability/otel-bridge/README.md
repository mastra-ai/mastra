# @mastra/otel-bridge

OpenTelemetry Bridge for Mastra Observability.

Enables Mastra to integrate with existing OpenTelemetry infrastructure by reading trace context from the active OTEL span context (via AsyncLocalStorage) or W3C trace headers.

## Overview

`@mastra/otel-bridge` connects Mastra's observability system with standard OpenTelemetry instrumentation. When you configure OTEL using the standard NodeSDK pattern, the bridge automatically reads context from AsyncLocalStorage without requiring any middleware.

**Key Features:**

- Reads from OTEL ambient context automatically (no middleware needed)
- Works with standard OTEL auto-instrumentation
- Extracts W3C trace context from headers when needed
- Next.js Edge runtime support via optional middleware

## Installation

```bash
npm install @mastra/otel-bridge @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
# or
pnpm add @mastra/otel-bridge @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
```

## Quick Start

### 1. Set up OpenTelemetry (Standard Pattern)

Create an `instrumentation.js` file and import it **before** any other code:

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: 'my-service',
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Automatically instruments Express, Fastify, HTTP, and many others
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

Then import this file first in your application:

```typescript
// IMPORTANT: Import instrumentation FIRST!
import './instrumentation.js';

// Now import your application code
import express from 'express';
import { Mastra } from '@mastra/core';
// ... rest of your imports
```

### 2. Configure Mastra with OtelBridge

```typescript
import { OtelBridge } from '@mastra/otel-bridge';
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';

const mastra = new Mastra({
  agents: { myAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge(),
      },
    },
  }),
});
```

### 3. Use Your Agent (No Middleware Required!)

The OTEL SDK's auto-instrumentation handles context propagation automatically via AsyncLocalStorage.

#### Express Example

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  // OTEL context is automatically available via AsyncLocalStorage
  // Bridge reads it transparently - no middleware needed!
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: req.body.message }],
  });

  res.json(result);
});

app.listen(3000);
```

#### Fastify Example

```typescript
import Fastify from 'fastify';

const fastify = Fastify();

fastify.post('/api/chat', async (request, reply) => {
  // OTEL context automatically available
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: request.body.message }],
  });

  return result;
});

await fastify.listen({ port: 3000 });
```

#### Hono Example

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.post('/api/chat', async c => {
  // OTEL context automatically available
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: await c.req.json() }],
  });

  return c.json(result);
});

export default app;
```

## How It Works

### Bidirectional OTEL Integration

The OtelBridge provides **bidirectional integration** with OpenTelemetry:

1. **Read OTEL Context** → Mastra spans inherit trace context
2. **Export Mastra Spans** → Spans appear in your OTEL backend

### Standard OTEL Auto-Instrumentation Flow

```
Incoming HTTP Request with traceparent header
  ↓
OTEL Auto-Instrumentation (Express/Fastify/HTTP)
  ├─ Creates HTTP span
  └─ Stores context in AsyncLocalStorage
  ↓
Your Route Handler
  ↓
Mastra Agent.generate() call
  ↓
┌─────────────────────────────────────────┐
│ OtelBridge (Bidirectional)              │
├─────────────────────────────────────────┤
│ 1. READ: Extract OTEL context          │ ← AsyncLocalStorage
│    └─ traceId, parentSpanId, isSampled │
│                                         │
│ 2. Mastra creates spans with           │
│    inherited trace context              │
│                                         │
│ 3. EXPORT: Send to OTEL TracerProvider │ → Active TracerProvider
│    └─ Convert to OTEL ReadableSpan     │
└─────────────────────────────────────────┘
  ↓
OTEL SDK BatchSpanProcessor
  ↓
OTEL Exporter (configured by user)
  ↓
Observability Backend (Jaeger, Honeycomb, etc.)
  └─ Shows complete trace:
     - HTTP request span (OTEL auto-instrumentation)
     - Agent run span (Mastra)
     - LLM generation span (Mastra)
     - Tool call spans (Mastra)
```

**No middleware needed!** The OTEL SDK's auto-instrumentation already handles context propagation via AsyncLocalStorage.

### What the Bridge Does

**Reading Context (Incoming)**:

1. Calls `trace.getSpan(context.active())` to read the active OTEL span
2. Extracts `traceId`, `spanId`, and sampling flags from the span context
3. Provides this context to Mastra when creating spans
4. Falls back to reading W3C headers (`traceparent`, `tracestate`) if no active span

**Exporting Spans (Outgoing)**:

1. Converts completed Mastra spans to OTEL `ReadableSpan` format
2. Uses `SpanConverter` to map Mastra attributes to OTEL semantic conventions
3. Exports through the active `TracerProvider`'s span processor
4. Spans flow through your existing OTEL pipeline (batching, sampling, exporters)

### Trace Continuity

When the bridge finds active OTEL context, Mastra spans will:

- Use the same `traceId` (linking all spans in the distributed trace)
- Set `parentSpanId` to the current OTEL span (creating proper parent-child relationships)
- Respect OTEL sampling decisions
- Appear in your OTEL backend alongside auto-instrumentation spans

## Verifying Bidirectional Flow

To verify that Mastra spans are being exported to OTEL:

1. **Check OTEL Backend**: View traces in Jaeger, Honeycomb, Datadog, etc.
2. **Look for Mastra Spans**: Search for spans with names like:
   - `agent.{agentId}` (e.g., `agent.chat-agent`)
   - `chat {model}` (e.g., `chat gpt-4.1-nano`)
   - `tool.execute {toolName}`
3. **Verify Parent-Child Relationships**: Mastra spans should be children of HTTP request spans
4. **Check Trace Continuity**: All spans should share the same `traceId`

### Debugging

Enable debug logging to see bridge activity:

```typescript
const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge(),
      },
    },
  }),
  logger: {
    level: 'debug',
    type: 'CONSOLE',
  },
});
```

Look for log messages like:

- `[OtelBridge] Extracted context from active span [traceId=...]`
- `[OtelBridge] Exported span [id=...] [traceId=...] [type=...]`
- `[OtelBridge] Found active OTEL span processor`

## Next.js Edge Runtime

Next.js Edge runtime doesn't support AsyncLocalStorage, so you need to use middleware to extract headers:

```typescript
// middleware.ts (at app root)
export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';
```

This middleware extracts W3C trace context headers and forwards them as internal headers that the bridge can read.

## Manual Context Extraction

For custom scenarios where you need explicit header extraction:

```typescript
import { RequestContext } from '@mastra/core/di';
import { extractOtelHeaders } from '@mastra/otel-bridge';

// Extract headers manually
const otelHeaders = extractOtelHeaders({
  traceparent: request.headers.get('traceparent'),
  tracestate: request.headers.get('tracestate'),
});

// Create RequestContext with OTEL headers
const requestContext = new RequestContext([['otel.headers', otelHeaders]]);

// Pass to Mastra
const result = await myAgent.generate({
  messages: [{ role: 'user', content: 'Hello' }],
  requestContext,
});
```

## Configuration

The `OtelBridge` constructor accepts an optional configuration object:

```typescript
interface OtelBridgeConfig {
  /**
   * Where to extract OTEL context from:
   * - 'active-context': Only from trace.getSpan(context.active())
   * - 'headers': Only from RequestContext 'otel.headers' key
   * - 'both': Try active context first, then headers (DEFAULT)
   */
  extractFrom?: 'active-context' | 'headers' | 'both';
}
```

### Examples

**Default (recommended)** - Try ambient context first, fall back to headers:

```typescript
new OtelBridge(); // extractFrom: 'both' is default
```

**Only use ambient context** (when OTEL auto-instrumentation is always available):

```typescript
new OtelBridge({ extractFrom: 'active-context' });
```

**Only use headers** (when running without OTEL SDK, e.g., serverless):

```typescript
new OtelBridge({ extractFrom: 'headers' });
```

## Exports

### Main Export

```typescript
import {
  // Core bridge
  OtelBridge,
  type OtelBridgeConfig,

  // Helper functions
  extractOtelHeaders,
  createOtelContext,
} from '@mastra/otel-bridge';
```

### Next.js Edge Middleware Export

```typescript
import { nextjsMiddleware } from '@mastra/otel-bridge/nextjs-middleware';
```

## TypeScript Support

Full TypeScript support with complete type definitions.

## Requirements

- **Node.js**: 22.13.0 or higher
- **Dependencies**:
  - `@mastra/core` >= 1.0.0
  - `@opentelemetry/api` >= 1.9.0

**For Standard OTEL Setup:**

- `@opentelemetry/sdk-node` >= 0.205.0
- `@opentelemetry/auto-instrumentations-node` >= 0.64.1

## Examples

See the [examples](./examples) directory for complete working examples:

- [Express + OTEL Bridge](./examples/express-basic)
- [Fastify + OTEL Bridge](./examples/fastify-basic)
- [Hono + OTEL Bridge](./examples/hono-basic)
- [Next.js + OTEL Bridge](./examples/nextjs-basic) (includes Edge runtime support)

## License

Apache 2.0
