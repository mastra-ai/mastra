# Phase 1 Implementation Guide

## Code Review Responses

### Response 1: Simplify tracingOptions handling

**Question**: "Can we just update the existing tracingOptions type/interface to optionally include the new properties?"

**Answer**: Yes! We can simplify by reassigning `tracingOptions` instead of creating `enhancedTracingOptions`. The original is already spread into a new object when passed to `startSpan()`.

**Updated code**:

```typescript
if (!tracingOptions?.traceId && bridgeContext) {
  tracingOptions = {
    ...tracingOptions,
    traceId: bridgeContext.traceId,
    parentSpanId: bridgeContext.parentSpanId,
  };
}
```

### Response 2: Avoid duplicate getInstance() calls

**Question**: "maybe move this get higher up in the call, so we don't need to duplicate get in the 'if (!tracingOptions?.traceId) {' section?"

**Answer**: Absolutely! Get instance once at the top after checking for current span.

## Updated getOrCreateSpan() Implementation

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

  // Get instance once - used for both bridge access and span creation
  const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
  if (!instance) {
    return undefined;
  }

  // Try to get OTEL context from bridge if no explicit traceId
  let finalTracingOptions = tracingOptions;

  if (!tracingOptions?.traceId) {
    const bridge = instance.getBridge();

    if (bridge) {
      try {
        const bridgeContext = bridge.getCurrentContext(requestContext);

        if (bridgeContext) {
          // Respect OTEL sampling decision
          if (!bridgeContext.isSampled) {
            return undefined; // Don't create span
          }

          // Inject OTEL context
          finalTracingOptions = {
            ...tracingOptions,
            traceId: bridgeContext.traceId,
            parentSpanId: bridgeContext.parentSpanId,
          };
        }
      } catch (error) {
        // Log warning and continue with new trace
        instance.getLogger().warn('Failed to get OTEL context from bridge, creating new trace:', error);
      }
    }
  }

  // Create new root span with potentially enhanced options
  return instance.startSpan<T>({
    type,
    attributes,
    ...rest,
    metadata,
    requestContext,
    tracingOptions: finalTracingOptions,
    traceId: finalTracingOptions?.traceId,
    parentSpanId: finalTracingOptions?.parentSpanId,
    customSamplerOptions: {
      requestContext,
      metadata,
    },
  });
}
```

## Phase 1 Tasks (Approved)

### Task 1: Core Interface Changes ✅

**Files to modify**:

1. `packages/core/src/observability/types/tracing.ts`
2. `packages/core/src/observability/utils.ts`
3. `observability/mastra/src/instances/base.ts`

**Changes detailed in UPDATED_PLAN.md**

### Task 2: OtelBridge Package ✅

**New package**: `observability/otel-bridge/`

**Structure**:

```
observability/otel-bridge/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── README.md
├── src/
│   ├── index.ts              # Main export
│   ├── bridge.ts             # OtelBridge class
│   ├── helpers.ts            # Generic utilities
│   └── middleware/
│       ├── hono.ts          # Hono middleware
│       ├── fastify.ts       # Fastify plugin
│       ├── express.ts       # Express middleware
│       └── index.ts         # Export all middleware
└── __tests__/
    ├── bridge.test.ts
    ├── helpers.test.ts
    └── middleware/
        ├── hono.test.ts
        ├── fastify.test.ts
        └── express.test.ts
```

### Task 3: Middleware Implementation ✅

**Priority order**:

1. **Hono** (most universal, works on edge)
2. **Fastify** (used in Internal example)
3. **Express** (most common)

All three will be completed in Phase 1.

## Implementation Order

### Step 1: Core Changes (Day 1)

- [ ] Update `ObservabilityBridge` interface
- [ ] Update `ObservabilityInstanceConfig`
- [ ] Add `getBridge()` to `ObservabilityInstance`
- [ ] Update `getOrCreateSpan()` (with simplified logic)
- [ ] Update `BaseObservabilityInstance`

### Step 2: OtelBridge Core (Day 2)

- [ ] Setup `otel-bridge` package
- [ ] Implement `OtelBridge` class
- [ ] Implement `getCurrentContext()` with active context extraction
- [ ] Implement `getCurrentContext()` with header extraction
- [ ] Implement `exportTracingEvent()`
- [ ] Write unit tests for bridge

### Step 3: Generic Helpers (Day 2)

- [ ] Implement `extractOtelHeaders()`
- [ ] Implement `createOtelContext()`
- [ ] Write tests for helpers

### Step 4: Hono Middleware (Day 3)

- [ ] Implement Hono middleware
- [ ] Test with Hono example
- [ ] Document usage

### Step 5: Fastify Middleware (Day 3)

- [ ] Implement Fastify plugin
- [ ] Test with Internal example
- [ ] Document usage

### Step 6: Express Middleware (Day 4)

- [ ] Implement Express middleware
- [ ] Create test app
- [ ] Document usage

### Step 7: Integration Testing (Day 4-5)

- [ ] Test Scenario A (Hono example)
- [ ] Test Scenario B (Internal example)
- [ ] Test export to OTLP collector
- [ ] Test sampling behavior

### Step 8: Documentation (Day 5)

- [ ] Package README.md
- [ ] Quick Start guide
- [ ] Framework-specific guides
- [ ] Troubleshooting guide

## Detailed Implementation Specs

### Hono Middleware

````typescript
// observability/otel-bridge/src/middleware/hono.ts
import { createMiddleware } from 'hono/factory';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { extractOtelHeaders } from '../helpers';

/**
 * Hono middleware to automatically extract OTEL trace context headers
 * and make them available to Mastra agents/workflows
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { otelMiddleware } from '@mastra/otel-bridge/middleware/hono';
 *
 * const app = new Hono();
 * app.use('*', otelMiddleware());
 *
 * app.post('/api/chat', async (c) => {
 *   // OTEL context automatically extracted
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   });
 *   return c.json(result);
 * });
 * ```
 */
export function otelMiddleware() {
  return createMiddleware(async (c, next) => {
    const otelHeaders = extractOtelHeaders({
      traceparent: c.req.header('traceparent'),
      tracestate: c.req.header('tracestate'),
    });

    // Only wrap if we have trace context
    if (otelHeaders.traceparent) {
      await RuntimeContext.with(new Map([['otel.headers', otelHeaders]]), () => next());
    } else {
      await next();
    }
  });
}
````

### Fastify Plugin

````typescript
// observability/otel-bridge/src/middleware/fastify.ts
import type { FastifyPluginCallback } from 'fastify';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { extractOtelHeaders } from '../helpers';

declare module 'fastify' {
  interface FastifyRequest {
    otelContext?: Map<string, any>;
  }
}

/**
 * Fastify plugin to automatically extract OTEL trace context headers
 *
 * @example
 * ```typescript
 * import Fastify from 'fastify';
 * import { otelPlugin } from '@mastra/otel-bridge/middleware/fastify';
 *
 * const fastify = Fastify();
 * await fastify.register(otelPlugin);
 *
 * fastify.post('/api/chat', async (request, reply) => {
 *   // OTEL context automatically extracted
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   });
 *   return result;
 * });
 * ```
 */
export const otelPlugin: FastifyPluginCallback = (fastify, opts, done) => {
  fastify.addHook('onRequest', async request => {
    const otelHeaders = extractOtelHeaders({
      traceparent: request.headers.traceparent as string | undefined,
      tracestate: request.headers.tracestate as string | undefined,
    });

    if (otelHeaders.traceparent) {
      request.otelContext = new Map([['otel.headers', otelHeaders]]);
    }
  });

  // Wrap handler execution in RuntimeContext
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.otelContext) {
      // Store original handler
      const originalHandler = reply.context.handler;

      // Wrap in RuntimeContext
      reply.context.handler = async function (req, rep) {
        return RuntimeContext.with(request.otelContext!, () => originalHandler.call(this, req, rep));
      };
    }
  });

  done();
};
````

### Express Middleware

````typescript
// observability/otel-bridge/src/middleware/express.ts
import type { Request, Response, NextFunction } from 'express';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { extractOtelHeaders } from '../helpers';

declare global {
  namespace Express {
    interface Request {
      otelContext?: Map<string, any>;
    }
  }
}

/**
 * Express middleware to automatically extract OTEL trace context headers
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { otelMiddleware } from '@mastra/otel-bridge/middleware/express';
 *
 * const app = express();
 * app.use(otelMiddleware());
 *
 * app.post('/api/chat', async (req, res) => {
 *   // OTEL context automatically extracted
 *   const result = await agent.generate({
 *     messages: [{ role: 'user', content: 'Hello' }],
 *   });
 *   res.json(result);
 * });
 * ```
 */
export function otelMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const otelHeaders = extractOtelHeaders({
      traceparent: req.headers.traceparent as string | undefined,
      tracestate: req.headers.tracestate as string | undefined,
    });

    if (otelHeaders.traceparent) {
      req.otelContext = new Map([['otel.headers', otelHeaders]]);

      // Wrap remaining middleware chain in RuntimeContext
      RuntimeContext.with(req.otelContext, () => next()).catch(next);
    } else {
      next();
    }
  };
}
````

## Package Configuration

### package.json

```json
{
  "name": "@mastra/otel-bridge",
  "version": "1.0.0-beta.0",
  "description": "OpenTelemetry observability bridge for Mastra",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./middleware/hono": {
      "import": "./dist/middleware/hono.js",
      "types": "./dist/middleware/hono.d.ts"
    },
    "./middleware/fastify": {
      "import": "./dist/middleware/fastify.js",
      "types": "./dist/middleware/fastify.d.ts"
    },
    "./middleware/express": {
      "import": "./dist/middleware/express.js",
      "types": "./dist/middleware/express.d.ts"
    },
    "./helpers": {
      "import": "./dist/helpers.js",
      "types": "./dist/helpers.d.ts"
    }
  },
  "scripts": {
    "build": "tsup --silent --config tsup.config.ts",
    "test": "vitest run",
    "test:watch": "vitest watch"
  },
  "dependencies": {
    "@mastra/observability": "workspace:*",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/core": "^2.1.0",
    "@opentelemetry/resources": "^2.1.0",
    "@opentelemetry/sdk-trace-base": "^2.1.0",
    "@opentelemetry/semantic-conventions": "^1.37.0"
  },
  "devDependencies": {
    "@mastra/core": "workspace:*",
    "@types/express": "^4.17.21",
    "express": "^4.18.2",
    "fastify": "^4.25.0",
    "hono": "^4.0.0",
    "vitest": "^3.2.4"
  },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0"
  },
  "peerDependenciesMeta": {
    "hono": {
      "optional": true
    },
    "fastify": {
      "optional": true
    },
    "express": {
      "optional": true
    }
  }
}
```

## Testing Strategy

### Unit Tests

1. **OtelBridge class**
   - getCurrentContext() with active context
   - getCurrentContext() with headers
   - exportTracingEvent()
   - Error handling

2. **Helpers**
   - extractOtelHeaders()
   - createOtelContext()

3. **Middleware**
   - Hono middleware
   - Fastify plugin
   - Express middleware

### Integration Tests

1. **Scenario A**: Test with Hono example
   - Start 3 services
   - Send request through chain
   - Verify single trace in backend

2. **Scenario B**: Test with Internal example
   - Start app with OTEL SDK
   - Send request
   - Verify trace continuity

3. **Export Testing**
   - Export to OTLP collector (Jaeger)
   - Verify spans appear correctly
   - Verify span relationships

## Success Criteria

### Must Have (Phase 1)

- ✅ Core bridge interfaces implemented
- ✅ OtelBridge extracts from active context
- ✅ OtelBridge extracts from headers
- ✅ OtelBridge exports to OTEL
- ✅ Hono middleware works
- ✅ Fastify middleware works
- ✅ Express middleware works
- ✅ Sampling respected
- ✅ Hono example works end-to-end
- ✅ Internal example works end-to-end
- ✅ Basic documentation

### Should Have (Nice to Have for Phase 1)

- Performance benchmarks
- Error scenarios documented
- Migration guide

## Timeline

| Day | Tasks                       | Deliverables                        |
| --- | --------------------------- | ----------------------------------- |
| 1   | Core changes                | Updated interfaces, getOrCreateSpan |
| 2   | OtelBridge + helpers        | Bridge class, utilities, tests      |
| 3   | Hono + Fastify middleware   | Two middleware implementations      |
| 4   | Express + Integration tests | Third middleware, end-to-end tests  |
| 5   | Documentation + Polish      | README, guides, cleanup             |

**Total**: 5 days for Phase 1 MVP

## Next Steps

Ready to start implementation! Which file should I begin with?

**Recommendation**: Start with core interface changes since everything else depends on them.

1. `packages/core/src/observability/types/tracing.ts` - Add interface
2. `packages/core/src/observability/utils.ts` - Update getOrCreateSpan
3. `observability/mastra/src/instances/base.ts` - Bridge support

Then move to OtelBridge package.

Let me know when you're ready and I'll start implementing! 🚀
