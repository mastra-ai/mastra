# @mastra/otel-bridge

OpenTelemetry Bridge for Mastra Observability.

Enables Mastra to integrate with existing OpenTelemetry infrastructure by extracting trace context from either active OTEL spans or W3C trace headers, and injecting that context into Mastra span creation.

## Installation

```bash
npm install @mastra/otel-bridge
# or
pnpm add @mastra/otel-bridge
# or
yarn add @mastra/otel-bridge
```

Depending on which framework you're using, you may also need:

```bash
# For Express
npm install express

# For Fastify
npm install fastify

# For Hono
npm install hono
```

## Quick Start

### 1. Configure the Bridge

Add the OtelBridge to your Mastra configuration:

```typescript
import { OtelBridge } from '@mastra/otel-bridge';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  agents: { myAgent },
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'both', // Try active context first, then headers
        }),
      },
    },
  },
});
```

### 2. Add Middleware (Framework-Specific)

#### Hono

```typescript
import { Hono } from 'hono';
import { honoMiddleware } from '@mastra/otel-bridge';

const app = new Hono();

// Add middleware globally
app.use('*', honoMiddleware());

app.post('/api/chat', async c => {
  // OTEL context automatically extracted from headers
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  return c.json(result);
});
```

Works universally across all Hono platforms: Node.js, Bun, Deno, Cloudflare Workers, Vercel Edge, Netlify Edge.

#### Fastify

```typescript
import Fastify from 'fastify';
import { fastifyPlugin } from '@mastra/otel-bridge';

const fastify = Fastify();

// Register plugin
await fastify.register(fastifyPlugin);

fastify.post('/api/chat', async (request, reply) => {
  // OTEL context automatically extracted from headers
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  return result;
});
```

#### Express

```typescript
import express from 'express';
import { expressMiddleware } from '@mastra/otel-bridge';

const app = express();

// Add middleware globally
app.use(expressMiddleware());

app.post('/api/chat', async (req, res) => {
  // OTEL context automatically extracted from headers
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  res.json(result);
});
```

## Usage Scenarios

### Scenario A: HTTP Services with W3C Headers

When incoming HTTP requests include W3C trace context headers (`traceparent`, `tracestate`), the middleware automatically extracts them and makes them available to Mastra.

```typescript
// Client sends request with headers:
// traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
// tracestate: vendorname1=opaqueValue1

// Your handler (any framework)
app.post('/api/chat', async req => {
  // Bridge extracts context from headers
  // Mastra spans will use: traceId=4bf92f3577b34da6a3ce929d0e0e4736
  //                        parentSpanId=00f067aa0ba902b7
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: req.body.message }],
  });
  return result;
});
```

### Scenario B: Mastra Inside OTEL-Instrumented Applications

When Mastra runs inside an application already instrumented with OpenTelemetry, the bridge automatically extracts context from the active OTEL span.

```typescript
import { trace } from '@opentelemetry/api';
import { OtelBridge } from '@mastra/otel-bridge';

// Configure bridge to extract from active context
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'active-context', // Only look at active OTEL spans
        }),
      },
    },
  },
});

// Your OTEL-instrumented function
const tracer = trace.getTracer('my-app');
await tracer.startActiveSpan('process-request', async span => {
  // Bridge extracts context from active span
  // Mastra spans will inherit traceId and parentSpanId
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });

  span.end();
  return result;
});
```

## Manual Context Extraction

For frameworks without built-in middleware, you can manually extract and inject OTEL context:

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createOtelContext } from '@mastra/otel-bridge';

// Extract headers from your framework
const context = createOtelContext({
  traceparent: req.headers['traceparent'],
  tracestate: req.headers['tracestate'],
});

// Wrap your Mastra calls
await RuntimeContext.with(context, async () => {
  const result = await myAgent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  return result;
});
```

## Configuration

### OtelBridgeConfig

```typescript
interface OtelBridgeConfig {
  /**
   * Where to extract OTEL context from
   * - 'active-context': From trace.getSpan(context.active())
   * - 'headers': From RequestContext with 'otel.headers' key
   * - 'both': Try active context first, then headers (DEFAULT)
   */
  extractFrom?: 'active-context' | 'headers' | 'both';

  /**
   * Log level for the bridge
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

### Examples

**Extract only from active OTEL context** (Scenario B):

```typescript
new OtelBridge({
  extractFrom: 'active-context',
});
```

**Extract only from HTTP headers** (Scenario A):

```typescript
new OtelBridge({
  extractFrom: 'headers',
});
```

**Try both (default)**:

```typescript
new OtelBridge({
  extractFrom: 'both', // Tries active context first, falls back to headers
});
```

## How It Works

1. **Context Extraction**: The bridge extracts OTEL trace context from:
   - Active OTEL spans via `trace.getSpan(context.active())`
   - W3C headers (`traceparent`, `tracestate`) from HTTP requests

2. **Context Injection**: When Mastra creates a new span, it calls `bridge.getCurrentContext()` to get:
   - `traceId`: Links Mastra spans to existing OTEL trace
   - `parentSpanId`: Makes Mastra spans children of OTEL spans
   - `isSampled`: Respects OTEL sampling decisions

3. **Span Creation**: Mastra creates spans with the injected context, maintaining trace continuity across OTEL and Mastra instrumentation.

## Sampling Behavior

The bridge respects OTEL sampling decisions:

- If `isSampled: false` is received from OTEL context, Mastra will not create spans
- If no OTEL context is found, Mastra creates spans according to its own configuration
- This prevents duplicate or conflicting sampling decisions

## Framework Support

| Framework | Support Level | Import                                                    |
| --------- | ------------- | --------------------------------------------------------- |
| Hono      | Middleware    | `import { honoMiddleware } from '@mastra/otel-bridge'`    |
| Fastify   | Plugin        | `import { fastifyPlugin } from '@mastra/otel-bridge'`     |
| Express   | Middleware    | `import { expressMiddleware } from '@mastra/otel-bridge'` |
| Other     | Manual        | `import { createOtelContext } from '@mastra/otel-bridge'` |

## Helper Functions

### `extractOtelHeaders(headers)`

Extracts W3C trace context headers from an HTTP headers object.

```typescript
import { extractOtelHeaders } from '@mastra/otel-bridge';

const otelHeaders = extractOtelHeaders({
  traceparent: req.header('traceparent'),
  tracestate: req.header('tracestate'),
});
// Returns: { traceparent?: string, tracestate?: string }
```

### `createOtelContext(headers)`

Creates a RequestContext Map with OTEL headers for use with `RuntimeContext.with()`.

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';
import { createOtelContext } from '@mastra/otel-bridge';

const context = createOtelContext({
  traceparent: req.header('traceparent'),
  tracestate: req.header('tracestate'),
});

await RuntimeContext.with(context, async () => {
  // Your Mastra code here
});
```

## Exports

All exports are available from the main package:

```typescript
import {
  // Core bridge
  OtelBridge,
  type OtelBridgeConfig,

  // Helper functions
  extractOtelHeaders,
  createOtelContext,

  // Framework middleware
  expressMiddleware,
  fastifyPlugin,
  honoMiddleware,
} from '@mastra/otel-bridge';
```

### Legacy Subpath Exports (still supported)

For backwards compatibility, you can still import from subpaths:

- `@mastra/otel-bridge/middleware/express`
- `@mastra/otel-bridge/middleware/fastify`
- `@mastra/otel-bridge/middleware/hono`

## TypeScript Support

Full TypeScript support included with type definitions for all APIs and middleware.

## Requirements

- Node.js 18+
- `@mastra/core` >= 1.0.0
- `@opentelemetry/api` >= 1.9.0
- `@opentelemetry/core` >= 1.28.0

Framework-specific requirements (optional):

- Hono 4.x (if using Hono middleware)
- Fastify 5.x (if using Fastify middleware)
- Express 4.x or 5.x (if using Express middleware)

## License

Apache 2.0
