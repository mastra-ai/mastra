# OtelBridge Migration Plan: Standard OTEL Auto-Instrumentation

## Decision

Migrate from custom middleware pattern to standard OTEL auto-instrumentation where:

- **Users** set up OTEL using standard `@opentelemetry/sdk-node` and `@opentelemetry/auto-instrumentations-node`
- **OtelBridge** reads from OTEL's ambient context (implements `ObservabilityBridge` interface)
- **No OTEL dependencies** in `@mastra/core` or `@mastra/observability`

This aligns with industry standards and user expectations based on real-world examples (Fastify, Hono tracing example).

## Critical Discovery

**The bridge already supports this pattern!** OtelBridge currently implements `ObservabilityBridge` interface and already reads from active OTEL context via `trace.getSpan(context.active())` at `bridge.ts:125`. The migration is primarily about:

1. Updating examples to use standard OTEL setup
2. Improving documentation
3. Deprecating the custom middleware (which is now redundant)

---

## Current vs Target Architecture

### Current (Custom Middleware)

```typescript
// User must add middleware in app code
import { expressMiddleware } from '@mastra/otel-bridge';
app.use(expressMiddleware());

// User must extract and pass context explicitly
app.post('/chat', (req, res) => {
  const requestContext = req.requestContext;
  agent.generate(messages, { requestContext });
});
```

**Problems:**

- Non-standard pattern
- Requires middleware in every framework
- Manual context extraction
- More boilerplate
- Doesn't work with existing OTEL tooling
- Bridge tries to do too much (initialization + extraction)

### Target (Standard OTEL + Bridge as Context Reader)

```typescript
// instrumentation.js - User provides (standard OTEL)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'my-app',
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

// server.ts - User imports instrumentation FIRST
import './instrumentation'; // FIRST!
import express from 'express';
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'my-app',
        bridge: new OtelBridge(), // Reads from OTEL ambient context!
      },
    },
  }),
});

// NO MIDDLEWARE NEEDED!
app.post('/chat', async (req, res) => {
  // Context is ambient - no manual passing!
  const result = await agent.generate(messages);
  res.json({ response: result.text });
});
```

**Benefits:**
✅ Standard OTEL pattern (AsyncLocalStorage)
✅ No middleware in app code
✅ Automatic context propagation
✅ Works with existing OTEL ecosystem
✅ No OTEL deps in @mastra/core or @mastra/observability
✅ Bridge is simple adapter (ObservabilityBridge interface)
✅ Clear separation: OTEL setup (user) vs context reading (bridge)

---

## Architecture: Separation of Concerns

### User Responsibility: OTEL Setup

Users create `instrumentation.js` following **standard OTEL pattern**:

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const sdk = new NodeSDK({
  serviceName: process.env.OTEL_SERVICE_NAME || 'my-app',
  traceExporter: new OTLPTraceExporter(),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

**Load via:**

- `--import` flag: `node --import ./instrumentation.js server.js`
- OR top-level import: `import './instrumentation'` as first line in server.js

### OtelBridge Responsibility: Context Reader

OtelBridge implements **`ObservabilityBridge`** interface (defined at `packages/core/src/observability/types/tracing.ts:851`):

```typescript
// Current implementation at observability/otel-bridge/src/bridge.ts
import { trace, context as otelContext } from '@opentelemetry/api';
import type { ObservabilityBridge } from '@mastra/core/observability';

export class OtelBridge implements ObservabilityBridge {
  /**
   * Get current OTEL context for span creation
   * Called by Mastra observability when creating root spans
   *
   * @param requestContext - Optional request context with headers
   * @returns OTEL context or undefined if not available
   */
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined {
    // Strategy 1: Try active OTEL context (AsyncLocalStorage)
    const activeSpan = trace.getSpan(otelContext.active());

    if (activeSpan) {
      const spanContext = activeSpan.spanContext();
      return {
        traceId: spanContext.traceId,
        parentSpanId: spanContext.spanId,
        isSampled: (spanContext.traceFlags & 1) === 1,
      };
    }

    // Strategy 2: Fallback to W3C headers from RequestContext
    // (for scenarios where AsyncLocalStorage isn't available)
    return this.getHeaderContext(requestContext);
  }
}
```

**Key Points:**

- ✅ Already implements `ObservabilityBridge` interface correctly
- ✅ Already reads from active OTEL span via `trace.getSpan(otelContext.active())`
- ✅ Supports both ambient context AND explicit headers (configurable)
- ✅ No changes needed to interface or core logic

### @mastra/core & @mastra/observability: OTEL-Agnostic

**No changes needed!** Already designed with `ObservabilityBridge` interface:

```typescript
// Existing interface at packages/core/src/observability/types/tracing.ts:851
export interface ObservabilityBridge {
  name: string;
  init?(options: InitBridgeOptions): void;
  __setLogger?(logger: IMastraLogger): void;

  /**
   * Get current OTEL context for span creation
   * Called by getOrCreateSpan() when creating root spans
   */
  getCurrentContext(requestContext?: RequestContext):
    | {
        traceId: string;
        parentSpanId?: string;
        isSampled: boolean;
      }
    | undefined;

  exportTracingEvent(event: TracingEvent): Promise<void>;
  shutdown(): Promise<void>;
}
```

The observability system already calls `bridge.getCurrentContext()` when creating spans - no changes required!

---

## Implementation Phases

### Phase 1: ~~Update OtelBridge~~ Already Done! ✅

**Discovery:** OtelBridge already implements `ObservabilityBridge` correctly and reads from ambient OTEL context!

**What's already working:**

- ✅ Implements `ObservabilityBridge` interface
- ✅ `getCurrentContext()` method reads from `trace.getSpan(otelContext.active())`
- ✅ Supports both ambient context (AsyncLocalStorage) and explicit headers
- ✅ Configurable via `extractFrom` option

**No code changes needed to bridge.ts!**

The only task is to document the `extractFrom` config option better and set default to `'active-context'` (currently defaults to `'both'`).

### Phase 2: Update Examples to Standard OTEL

**Goal:** Show users the standard pattern.

**Tasks:**

**For Node.js runtime examples (express, fastify, hono, nextjs):**

1. Create `instrumentation.js` files for each example
   - Include commented-out framework-specific instrumentation imports
   - Show both minimal (auto-instrumentations only) and enhanced (with framework package) patterns
   - Add explanatory comments about what each package provides
2. Remove middleware usage from server files
3. Update package.json scripts to use `--import` flag or top-level import
4. Update route handlers to remove explicit context extraction
5. Add README sections on OTEL setup
   - Document minimal vs enhanced setup
   - Explain when to use framework-specific packages

**For Next.js specifically:**

- Split current `nextjs-basic` into TWO examples:
  - **`nextjs-basic`**: Standard OTEL pattern (Node.js runtime)
    - Uses `instrumentation.js` like other examples
    - No middleware needed
    - Bridge reads from ambient context
  - **`nextjs-edge`**: Edge runtime pattern (for edge functions)
    - Uses `nextjs-middleware` for header extraction
    - Uses `getNextOtelContext()` helper
    - Bridge configured with `extractFrom: 'headers'`

6. Update integration tests to match new pattern

**Deliverables:**

- All Node.js examples use standard OTEL auto-instrumentation
- Next.js has both Node.js and Edge runtime examples
- Clear documentation of setup pattern for each
- Tests passing

### Phase 3: Documentation

**Goal:** Document the standard OTEL pattern clearly.

**Tasks:**

1. Document standard OTEL setup as the pattern
2. Update README with architecture explanation
3. Add troubleshooting guide for common issues
4. Document the `extractFrom` configuration option

**Deliverables:**

- Clear documentation of standard OTEL setup
- Architecture diagram showing user→OTEL→bridge→Mastra flow
- Troubleshooting guide

### Phase 4: Clean Up Middleware Files

**Goal:** Remove all custom middleware code.

**Tasks:**

1. Delete `src/middleware/express.ts`
2. Delete `src/middleware/fastify.ts`
3. Delete `src/middleware/hono.ts`
4. Keep only `src/middleware/nextjs-middleware.ts` (for Edge runtime)
5. Update exports in `package.json` to remove middleware paths
6. Update `src/index.ts` to export only `OtelBridge` class

**Deliverables:**

- Clean codebase with no middleware exports
- Only bridge class and nextjs-middleware export

### Phase 5: Edge Runtime Support (Future)

**Goal:** Separate solution for Edge runtime (Next.js Edge, Cloudflare Workers, etc.)

**Tasks:**

1. Keep `nextjs-middleware.ts` for Edge runtime
2. Document when to use Edge pattern vs Node.js pattern
3. Create separate example for Next.js with both Node + Edge routes
4. Consider separate package or clear subpath exports

---

## New Package Structure

```
@mastra/otel-bridge/
├── src/
│   ├── bridge.ts                    # Main: OtelBridge class (ObservabilityBridge)
│   ├── index.ts                     # Re-exports bridge
│   └── middleware/
│       └── nextjs-middleware.ts     # Keep for Edge runtime only
├── examples/
│   ├── express-basic/
│   │   ├── instrumentation.js       # Standard OTEL setup
│   │   ├── server.ts                # No middleware!
│   │   └── package.json
│   ├── fastify-basic/
│   │   ├── instrumentation.js       # Standard OTEL setup
│   │   ├── server.ts                # No middleware!
│   │   └── package.json
│   ├── hono-basic/
│   │   ├── instrumentation.js       # Standard OTEL setup
│   │   ├── server.ts                # No middleware!
│   │   └── package.json
│   ├── nextjs-basic/                # Node.js runtime (standard OTEL)
│   │   ├── instrumentation.ts       # Standard OTEL setup
│   │   ├── app/api/chat/route.ts    # No middleware, no getNextOtelContext!
│   │   └── package.json
│   └── nextjs-edge/                 # Edge runtime (custom middleware)
│       ├── middleware.ts            # Edge middleware for header extraction
│       ├── app/api/chat/route.ts    # Uses getNextOtelContext()
│       └── package.json
├── package.json
└── tsup.config.ts
```

**Key changes:**

- ❌ Removed all Node.js framework middleware files (express, fastify, hono)
- ✅ Keep only nextjs-middleware for Edge runtime support
- ✅ Node.js examples (express, fastify, hono, nextjs-basic) all use standard OTEL instrumentation
- ✅ Split Next.js into two examples: `nextjs-basic` (Node.js runtime) and `nextjs-edge` (Edge runtime)
- ✅ Clean, simple structure focused on standard OTEL

---

## Framework-Specific OTEL Packages

### When to Use Them

Framework-specific OTEL packages are **optional but recommended** for enhanced observability:

| Framework   | Package                                  | Required?   | What It Adds                                         |
| ----------- | ---------------------------------------- | ----------- | ---------------------------------------------------- |
| **Express** | `@opentelemetry/instrumentation-express` | No\*        | Route-level spans, middleware tracking               |
| **Fastify** | `@fastify/otel`                          | Recommended | Enhanced route spans, request context utilities      |
| **Hono**    | `@hono/otel`                             | Optional    | Middleware for Hono-specific spans                   |
| **Next.js** | `@vercel/otel`                           | Built-in    | Full Next.js instrumentation (pages, API, rendering) |

\*Already included in `@opentelemetry/auto-instrumentations-node`

### Minimal vs Enhanced Setup

**Minimal (works for context propagation):**

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

**Enhanced (better observability):**

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import FastifyOtelInstrumentation from '@fastify/otel';

const sdk = new NodeSDK({
  instrumentations: [
    ...getNodeAutoInstrumentations(),
    new FastifyOtelInstrumentation(), // Better route-level visibility
  ],
});
sdk.start();
```

### What You Get

**Without framework package:**

- ✅ Context propagation works (AsyncLocalStorage)
- ✅ HTTP-level spans
- ✅ Mastra traces properly linked
- ⚠️ Generic span names: `HTTP POST`

**With framework package:**

- ✅ Everything from above, PLUS:
- ✅ Route-level spans: `POST /api/users/:id`
- ✅ Middleware tracking
- ✅ Framework-specific attributes
- ✅ Better debugging visibility

### Recommendation

- **Start minimal**: Use `getNodeAutoInstrumentations()` only
- **Add when debugging**: Install framework package if you need better visibility
- **Production**: Include framework packages for full observability (follows Fastify pattern)

---

## OtelBridge API

### Core Class

````typescript
// @mastra/otel-bridge - Current implementation

export interface OtelBridgeConfig {
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

/**
 * OtelBridge - Reads OTEL context from AsyncLocalStorage or headers
 *
 * Implements ObservabilityBridge interface for Mastra observability.
 * When OTEL SDK is initialized with auto-instrumentation, the bridge
 * automatically reads from ambient context (AsyncLocalStorage).
 *
 * @example
 * ```typescript
 * import { OtelBridge } from '@mastra/otel-bridge';
 *
 * const mastra = new Mastra({
 *   observability: new Observability({
 *     configs: {
 *       default: {
 *         serviceName: 'my-app',
 *         bridge: new OtelBridge({
 *           extractFrom: 'active-context',  // Recommended for standard OTEL setup
 *         }),
 *       }
 *     }
 *   })
 * });
 * ```
 */
export class OtelBridge implements ObservabilityBridge {
  constructor(config?: OtelBridgeConfig);

  /**
   * Get current OTEL context for span creation
   * Returns undefined if no active span exists
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

  /**
   * Shutdown the bridge and clean up resources
   */
  shutdown(): Promise<void>;
}
````

### Optional Helper (Can add later)

```typescript
// @mastra/otel-bridge/helpers

/**
 * Helper to create instrumentation.js content
 * Not required - users can use standard OTEL directly
 */
export function createInstrumentationTemplate(config: { serviceName?: string; exporterEndpoint?: string }): string;
```

---

## Example Updates

### Express Example

```
examples/express-basic/
├── instrumentation.js     # NEW - OTEL setup
├── server.ts             # Updated - no middleware
├── package.json          # Updated - start script
└── README.md            # Updated - setup docs
```

**instrumentation.js (NEW):**

```javascript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

// Optional: Add Express-specific instrumentation for enhanced spans
// import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';

const sdk = new NodeSDK({
  serviceName: 'express-example',
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    // Auto-instrumentations includes HTTP, Express, and many others
    getNodeAutoInstrumentations(),

    // Optional: Add framework-specific instrumentation for enhanced observability
    // This provides better route-level granularity and framework-specific attributes
    // new ExpressInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

**server.ts (UPDATED):**

```typescript
// MUST be first import!
import './instrumentation.js';

import express from 'express';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Observability } from '@mastra/observability';
import { OtelBridge } from '@mastra/otel-bridge';

const chatAgentDef = new Agent({
  name: 'chat-agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o-mini',
});

const mastra = new Mastra({
  agents: { chatAgent: chatAgentDef },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'express-example',
        bridge: new OtelBridge(), // Reads from OTEL!
      },
    },
  }),
});

const chatAgent = mastra.getAgent('chatAgent');
const app = express();
app.use(express.json());

// NO MIDDLEWARE NEEDED!
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // NO CONTEXT EXTRACTION!
    // Mastra reads from OTEL via bridge
    const result = await chatAgent.generate([{ role: 'user', content: message }]);

    res.json({ response: result.text });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(3456, () => {
  console.log('Server running on http://localhost:3456');
});
```

**package.json (UPDATED):**

```json
{
  "type": "module",
  "scripts": {
    "dev": "node --import ./instrumentation.js server.ts",
    "start": "node --import ./instrumentation.js server.ts"
  },
  "dependencies": {
    "@mastra/core": "workspace:*",
    "@mastra/observability": "workspace:*",
    "@mastra/otel-bridge": "workspace:*",
    "@opentelemetry/sdk-node": "^0.205.0",
    "@opentelemetry/auto-instrumentations-node": "^0.64.1",
    "@opentelemetry/exporter-trace-otlp-http": "^0.205.0",
    "express": "^4.21.2"
  }
}
```

### Fastify Example

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

// Optional: Add Fastify-specific instrumentation for enhanced spans
// Recommended - follows Fastify production example pattern
// import FastifyOtelInstrumentation from '@fastify/otel';

const sdk = new NodeSDK({
  serviceName: 'fastify-example',
  instrumentations: [
    // Auto-instrumentations includes HTTP, Fastify, and many others
    ...getNodeAutoInstrumentations(),

    // Optional: Add Fastify-specific instrumentation for enhanced observability
    // Provides better route-level granularity and Fastify-specific attributes
    // new FastifyOtelInstrumentation(),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

### Hono Example

```javascript
// instrumentation.js
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'hono-example',
  instrumentations: [
    // Auto-instrumentations includes HTTP and many others
    // Note: @hono/otel is middleware (added in server.ts), not an instrumentation
    getNodeAutoInstrumentations(),
  ],
});

sdk.start();

process.on('SIGTERM', async () => {
  await sdk.shutdown();
  process.exit(0);
});
```

```typescript
// server.ts - Optional: Add @hono/otel middleware for Hono-specific spans
import { Hono } from 'hono';
// import { instrument } from '@hono/otel';  // Optional

const app = new Hono();

// Optional: Add Hono middleware for enhanced observability
// app.use('*', instrument('hono-example'));

app.get('/api/chat', async c => {
  // Your handler code
});
```

---

## Package.json Updates

### @mastra/otel-bridge Dependencies

```json
{
  "name": "@mastra/otel-bridge",
  "dependencies": {
    "@opentelemetry/api": "^1.9.0"
  },
  "peerDependencies": {
    "@mastra/observability": "workspace:*"
  },
  "devDependencies": {
    "@opentelemetry/sdk-node": "^0.205.0",
    "@opentelemetry/auto-instrumentations-node": "^0.64.1",
    "next": "^15.1.4"
  }
}
```

**Note:** Only `@opentelemetry/api` is a runtime dependency (for reading context). SDK packages are devDeps for examples/tests.

### Export Paths

```json
{
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    },
    "./nextjs-middleware": {
      "import": {
        "types": "./dist/middleware/nextjs-middleware.d.ts",
        "default": "./dist/middleware/nextjs-middleware.js"
      }
    },
    "./package.json": "./package.json"
  }
}
```

**Simplified exports:**

- Main export: `OtelBridge` class only
- Next.js middleware: Separate export for Edge runtime
- No legacy exports

---

## Testing Strategy

### Integration Tests

```typescript
// integration.test.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OtelBridge } from '../src/bridge';

describe('OtelBridge Integration', () => {
  let sdk: NodeSDK;

  beforeAll(() => {
    // Initialize OTEL SDK before tests
    sdk = new NodeSDK({
      serviceName: 'test-service',
      instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
  });

  afterAll(async () => {
    await sdk.shutdown();
  });

  test('Express: reads context from OTEL', async () => {
    const bridge = new OtelBridge();

    // Make request with traceparent header
    // OTEL auto-instrumentation sets AsyncLocalStorage
    const response = await fetch('http://localhost:3456/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
      body: JSON.stringify({ message: 'test' }),
    });

    // Inside the request handler, bridge.extractContext() should return parent context
    expect(response.ok).toBe(true);
  });

  test('extractContext returns undefined when no active span', () => {
    const bridge = new OtelBridge();
    const context = bridge.extractContext();
    expect(context).toBeUndefined();
  });
});
```

---

## Risks and Mitigation

### Risk 1: Users Don't Set Up OTEL Correctly

**Impact:** Bridge returns undefined, no trace propagation
**Mitigation:**

- Clear documentation with examples
- Helpful error messages in bridge
- Debug mode that logs when context not found

### Risk 2: Edge Runtime Support

**Impact:** AsyncLocalStorage doesn't work in Edge
**Mitigation:**

- Keep separate Edge-compatible exports (nextjs-middleware)
- Clear docs on when to use each approach
- Different pattern for Next.js Edge routes

### Risk 3: Existing OTEL Users

**Impact:** May have existing setup that differs
**Mitigation:**

- OtelBridge works with ANY OTEL setup (just reads from API)
- Document how to integrate with existing OTEL
- No magic - just reads ambient context
- Support configurable `extractFrom` option for flexibility

---

## Success Criteria

- [x] OtelBridge reads from OTEL ambient context (already implemented!)
- [x] No OTEL deps in @mastra/core or @mastra/observability (already true!)
- [x] Implements `ObservabilityBridge` interface correctly (already done!)
- [ ] All framework middleware files removed (express, fastify, hono)
- [ ] All examples use standard OTEL auto-instrumentation
- [ ] Integration tests passing with new pattern
- [ ] Documentation complete showing standard OTEL setup
- [ ] Package exports simplified (only main + nextjs-middleware)

---

## Timeline Estimate

- **Phase 1:** ✅ Already done! (Bridge already implements ObservabilityBridge correctly)
- **Phase 2:** 1-2 days (Update examples with instrumentation.js)
- **Phase 3:** 1 day (Documentation)
- **Phase 4:** 1 day (Remove middleware files, clean up exports)
- **Phase 5:** Future (TBD)

**Total for MVP (Phases 2-4):** ~2-3 days

**Key insight:** Most of the hard work is already done. The bridge implementation is correct and ready to use with standard OTEL!

---

## Key Architectural Principles

### 1. Standard Over Custom

Use industry-standard OTEL patterns rather than Mastra-specific middleware.

### 2. Separation of Concerns

- **User:** Sets up OTEL (standard SDK)
- **Bridge:** Reads context (ObservabilityBridge)
- **Mastra:** Uses context (observability-agnostic)

### 3. No OTEL Lock-in for Core

Keep @mastra/core and @mastra/observability free of OTEL dependencies. Bridge is optional adapter.

### 4. Clear Mental Model

- OTEL handles trace propagation (incoming headers → AsyncLocalStorage)
- Bridge reads from AsyncLocalStorage
- Mastra creates spans with parent context

---

## Open Questions

1. ✅ **RESOLVED:** Bridge already implements `ObservabilityBridge` correctly and reads from OTEL ambient context!
2. ✅ **RESOLVED:** No backward compatibility needed - breaking change is acceptable
3. Should we provide example instrumentation.js files in each example, or just documentation?
4. Do we need helper functions for creating instrumentation.js, or just documentation?
5. Should we change the default `extractFrom` to `'active-context'` instead of `'both'`?
6. How should we handle the case where users forget to initialize OTEL SDK? (Current behavior: bridge returns undefined, Mastra creates root span)
