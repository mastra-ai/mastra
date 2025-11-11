# Framework-Agnostic OTEL Integration Design

## Goal

Create a universal OTEL bridge that works with any framework/runtime by:

1. Using standard OTEL packages for context extraction
2. Providing optional convenience utilities for popular frameworks
3. Relying on OTEL's own propagation standards (W3C Trace Context)

## Core Principle: OTEL-First

**Use OTEL packages wherever possible** to maintain compatibility and leverage existing instrumentation.

## Strategy Overview

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: OTEL Standard APIs (core bridge)              │
│  - @opentelemetry/api                                    │
│  - @opentelemetry/core (propagators)                     │
│  - Works everywhere, framework-agnostic                  │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Automatic Detection (if available)            │
│  - OTEL auto-instrumentation                             │
│  - Detects active context automatically                  │
│  - NO user code needed                                   │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Optional Helpers (convenience)                │
│  - Framework-specific middleware                         │
│  - Simplifies header extraction                          │
│  - Distributed as separate packages                      │
└─────────────────────────────────────────────────────────┘
```

## Layer 1: Core Bridge (Framework-Agnostic)

### Dependencies

```json
{
  "dependencies": {
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/core": "^2.1.0"
  }
}
```

### Context Extraction

The bridge uses OTEL's standard APIs:

```typescript
import { trace, context } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

class OtelBridge implements ObservabilityBridge {
  private propagator = new W3CTraceContextPropagator();

  getCurrentContext(requestContext?: RequestContext) {
    // Strategy 1: Active OTEL context (works with any auto-instrumentation)
    const activeContext = this.getActiveContext();
    if (activeContext) return activeContext;

    // Strategy 2: W3C headers from RequestContext
    const headerContext = this.getHeaderContext(requestContext);
    if (headerContext) return headerContext;

    return undefined;
  }

  private getActiveContext() {
    try {
      // Standard OTEL API - works everywhere
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
      // Get headers stored by user (or middleware)
      const headers = requestContext.get('otel.headers');
      if (!headers?.traceparent) return undefined;

      // Use OTEL's W3C propagator (standard)
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
}
```

**Key Points:**

- Uses `@opentelemetry/api` - the stable, framework-agnostic API
- Uses `W3CTraceContextPropagator` - standard propagation format
- NO framework-specific code
- NO hard dependencies on HTTP libraries

## Layer 2: Automatic Detection

### OTEL Auto-Instrumentation

When OTEL auto-instrumentation is active, the bridge **automatically works** with NO user code changes:

```typescript
// Setup (usually in separate init file)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

// Application code - NO CHANGES NEEDED
app.post('/api/chat', async (req, reply) => {
  // Auto-instrumentation has set active context
  // Bridge detects it automatically
  const result = await agent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  return result;
});
```

### Supported Auto-Instrumentations

OTEL provides auto-instrumentation for many frameworks:

| Framework  | Package                                  | Status       |
| ---------- | ---------------------------------------- | ------------ |
| HTTP/HTTPS | `@opentelemetry/instrumentation-http`    | ✅ Built-in  |
| Fastify    | `@opentelemetry/instrumentation-fastify` | ✅ Available |
| Express    | `@opentelemetry/instrumentation-express` | ✅ Available |
| Koa        | `@opentelemetry/instrumentation-koa`     | ✅ Available |
| Hapi       | `@opentelemetry/instrumentation-hapi`    | ✅ Available |
| NestJS     | Uses underlying HTTP/Express/Fastify     | ✅ Works     |
| Next.js    | Uses HTTP instrumentation                | ✅ Works     |
| gRPC       | `@opentelemetry/instrumentation-grpc`    | ✅ Available |
| GraphQL    | `@opentelemetry/instrumentation-graphql` | ✅ Available |

**Key Benefit:** If users already have OTEL initialized, Mastra integration is **zero-configuration**.

## Layer 3: Optional Helpers

For scenarios where auto-instrumentation isn't available or users want simpler setup, provide **optional** helper packages.

### Design Principle

```typescript
// Core pattern (always works)
await RuntimeContext.with(
  new Map([['otel.headers', extractHeaders(req)]]),
  () => agent.generate(...)
);

// Helper simplifies to:
app.use(otelMiddleware());
await agent.generate(...); // Headers extracted automatically
```

### Example Helpers

#### Generic HTTP Helper

```typescript
// @mastra/otel-bridge/helpers
export function extractOtelHeaders(headers: Record<string, string | undefined>) {
  return {
    traceparent: headers['traceparent'],
    tracestate: headers['tracestate'],
    // Could also extract baggage, etc.
  };
}

export function createOtelContext(headers: Record<string, string | undefined>) {
  return new Map([['otel.headers', extractOtelHeaders(headers)]]);
}
```

#### Hono Middleware

```typescript
// @mastra/otel-bridge/middleware/hono
import { createMiddleware } from 'hono/factory';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { extractOtelHeaders } from '@mastra/otel-bridge/helpers';

export function otelContextMiddleware() {
  return createMiddleware(async (c, next) => {
    const otelHeaders = extractOtelHeaders({
      traceparent: c.req.header('traceparent'),
      tracestate: c.req.header('tracestate'),
    });

    await RuntimeContext.with(
      new Map([['otel.headers', otelHeaders]]),
      () => next()
    );
  });
}

// Usage
import { otelContextMiddleware } from '@mastra/otel-bridge/middleware/hono';

app.use('*', otelContextMiddleware());

app.post('/api/chat', async (c) => {
  // Context automatically available
  const result = await agent.generate(...);
  return c.json(result);
});
```

#### Fastify Plugin

```typescript
// @mastra/otel-bridge/middleware/fastify
import { FastifyPluginCallback } from 'fastify';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { extractOtelHeaders } from '@mastra/otel-bridge/helpers';

export const otelContextPlugin: FastifyPluginCallback = (fastify, opts, done) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const otelHeaders = extractOtelHeaders({
      traceparent: request.headers['traceparent'] as string,
      tracestate: request.headers['tracestate'] as string,
    });

    // Store in request for later retrieval
    request.otelContext = new Map([['otel.headers', otelHeaders]]);
  });

  done();
};

// Usage
import { otelContextPlugin } from '@mastra/otel-bridge/middleware/fastify';

fastify.register(otelContextPlugin);

fastify.post('/api/chat', async (request, reply) => {
  await RuntimeContext.with(
    request.otelContext,
    async () => {
      const result = await agent.generate(...);
      return result;
    }
  );
});
```

### Package Structure

```
@mastra/otel-bridge/
├── index.ts              # Core OtelBridge class
├── helpers.ts            # Generic utilities
└── middleware/
    ├── hono.ts          # Hono middleware
    ├── fastify.ts       # Fastify plugin
    ├── express.ts       # Express middleware
    ├── koa.ts           # Koa middleware
    └── README.md        # Middleware docs
```

## Universal Pattern for All Frameworks

### Pattern 1: With Auto-Instrumentation (Recommended)

```typescript
// 1. Initialize OTEL once at startup
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {},
      '@opentelemetry/instrumentation-fastify': {},
      // etc.
    }),
  ],
});
sdk.start();

// 2. Configure Mastra with bridge
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'active-context',  // Prioritize active context
          export: {
            useActiveProvider: true,  // Use existing OTEL SDK
          }
        }),
      }
    }
  }
});

// 3. Use Mastra - NO EXTRA CODE
app.post('/api/chat', async (req, res) => {
  // Auto-instrumentation has set active context
  // Bridge detects it - ZERO CONFIG
  const result = await agent.generate(...);
  res.json(result);
});
```

**Works with:** Fastify, Express, Koa, Hapi, NestJS, Next.js, Remix, any HTTP framework

### Pattern 2: Manual Header Extraction (Fallback)

```typescript
// 1. Configure Mastra with bridge
const mastra = new Mastra({
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'headers',  // Headers only
          export: {
            provider: {
              endpoint: 'http://localhost:4318/v1/traces',
            }
          }
        }),
      }
    }
  }
});

// 2. Extract headers manually
app.post('/api/chat', async (req, res) => {
  await RuntimeContext.with(
    new Map([
      ['otel.headers', {
        traceparent: req.headers.traceparent,
        tracestate: req.headers.tracestate,
      }]
    ]),
    async () => {
      const result = await agent.generate(...);
      res.json(result);
    }
  );
});
```

**Works with:** ANY framework, runtime, or environment

### Pattern 3: With Middleware Helper (Convenience)

```typescript
import { otelContextMiddleware } from '@mastra/otel-bridge/middleware/hono';

// 1. Add middleware once
app.use('*', otelContextMiddleware());

// 2. Use Mastra normally
app.post('/api/chat', async (c) => {
  // Middleware has extracted headers
  const result = await agent.generate(...);
  return c.json(result);
});
```

**Works with:** Frameworks with middleware support (most of them)

## Edge/Serverless Considerations

### Vercel Edge Functions

```typescript
import { OtelBridge } from '@mastra/otel-bridge';

export default async function handler(request: Request) {
  // Edge runtime - extract from Request object
  const traceparent = request.headers.get('traceparent');

  await RuntimeContext.with(
    new Map([['otel.headers', { traceparent }]]),
    async () => {
      const result = await agent.generate(...);
      return Response.json(result);
    }
  );
}
```

### Cloudflare Workers

```typescript
import { Hono } from 'hono';
import { otelContextMiddleware } from '@mastra/otel-bridge/middleware/hono';

const app = new Hono();

// Hono middleware works on Cloudflare Workers!
app.use('*', otelContextMiddleware());

app.post('/api/chat', async (c) => {
  const result = await agent.generate(...);
  return c.json(result);
});

export default app;
```

### AWS Lambda

```typescript
export async function handler(event: APIGatewayProxyEvent) {
  // Lambda + API Gateway
  const traceparent = event.headers?.traceparent;

  await RuntimeContext.with(
    new Map([['otel.headers', { traceparent }]]),
    async () => {
      const result = await agent.generate(...);
      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    }
  );
}
```

**Note:** AWS X-Ray uses different format. Could provide converter:

```typescript
import { convertXRayToW3C } from '@mastra/otel-bridge/helpers';

const xrayHeader = event.headers['x-amzn-trace-id'];
const traceparent = convertXRayToW3C(xrayHeader);
```

## Recommendation: Three-Tier Support

### Tier 1: Auto-Instrumentation (Best)

**For:** Production applications with proper OTEL setup

**Setup:** Initialize OTEL NodeSDK, configure bridge with `useActiveProvider`

**User Experience:** Zero configuration - works automatically

**Frameworks:** All supported by OTEL auto-instrumentation

### Tier 2: Manual with Helpers (Good)

**For:** Simpler applications, edge runtimes, specific frameworks

**Setup:** Use framework-specific middleware helper

**User Experience:** One-line middleware addition

**Frameworks:** Any with middleware support

### Tier 3: Manual (Universal Fallback)

**For:** Custom setups, unsupported frameworks, special requirements

**Setup:** Manual `RuntimeContext.with()` wrapper

**User Experience:** Requires understanding of pattern

**Frameworks:** ANY framework or runtime

## Documentation Strategy

### Quick Start

````markdown
# Quick Start

## If you have OTEL already:

1. Configure bridge:
   ```typescript
   new OtelBridge({ useActiveProvider: true });
   ```
````

2. Done! Mastra automatically integrates.

## If you don't have OTEL:

### Option A: Add OTEL (Recommended)

[Link to OTEL setup guide]

### Option B: Use Middleware

[Link to framework-specific middleware]

### Option C: Manual Setup

[Link to manual extraction guide]

```

### Framework-Specific Guides

Create guides for popular frameworks:
- **Hono** (most flexible)
- **Fastify** (fast backend)
- **Express** (most common)
- **NestJS** (enterprise)
- **Next.js** (full-stack)
- **Remix** (full-stack)
- **SvelteKit** (full-stack)

Each guide shows:
1. OTEL auto-instrumentation setup (Tier 1)
2. Middleware helper (Tier 2)
3. Manual extraction (Tier 3)

## Implementation Priority

### Phase 1: Core (Week 1)
- ✅ Core OtelBridge with standard OTEL APIs
- ✅ Active context detection
- ✅ W3C header extraction from RequestContext
- ✅ Export to OTEL collectors

### Phase 2: Helpers (Week 2)
- Generic helper functions
- Hono middleware (most universal)
- Fastify plugin
- Express middleware
- Documentation for manual extraction

### Phase 3: Advanced (Week 3+)
- Koa middleware
- NestJS module
- Edge runtime helpers (Cloudflare, Vercel)
- AWS Lambda + X-Ray converter
- gRPC metadata extraction

## Benefits of This Approach

1. **Standards-based**: Uses official OTEL packages
2. **Future-proof**: Compatible with OTEL ecosystem evolution
3. **Flexible**: Works with any framework through universal patterns
4. **Progressive**: Can start simple, add sophistication later
5. **Zero-config**: Best experience with auto-instrumentation
6. **Universal fallback**: Always works with manual extraction

## Answer to User's Question

> "How should mastra's custom tracing integrate into an OTEL world?"

**Answer**: Mastra should be a **good OTEL citizen** by:

1. **Respecting OTEL context**: Read from `context.active()` when available
2. **Using OTEL formats**: W3C Trace Context, not proprietary formats
3. **Exporting OTEL spans**: Convert to ReadableSpan, export via OTEL SDK
4. **Working with auto-instrumentation**: Detect and use existing OTEL setup
5. **Providing escape hatches**: Manual extraction for special cases

This makes Mastra **invisible** to OTEL users - it just works.
```
