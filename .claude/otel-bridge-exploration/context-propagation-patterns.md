# OTEL Context Propagation Patterns Analysis

## Executive Summary

After analyzing two user examples and comparing them to our OtelBridge implementation, we discovered that **both examples use standard OTEL auto-instrumentation** rather than manual middleware patterns. This represents a fundamental architectural difference from our current approach.

## Examples Analyzed

### 1. mastra-hono-tracing-example

- **Source**: https://github.com/treasur-inc/mastra-hono-tracing-example
- **Pattern**: `@hono/otel` middleware with W3C Trace Context propagator
- **Key**: Uses standard OTEL libraries for automatic context extraction/injection

### 2. stripped-agent-hub-export (Fastify Production System)

- **Source**: `examples/stripped-agent-hub-export`
- **Pattern**: Full OTEL Node SDK with auto-instrumentation
- **Key**: Loads OTEL hooks before application starts using `--import` flag

---

## Standard OTEL Auto-Instrumentation Pattern

### Fastify Example (Gold Standard)

**Startup Command:**

```bash
node \
  --import=./instrumentation-hook.js \      # Load OTEL hooks FIRST
  --import=./src/core/telemetry/init.ts \   # Initialize OTEL SDK
  src/server.ts
```

**instrumentation-hook.js:**

```javascript
import * as module from 'module';

// Registers OTEL hooks that patch all modules
module.register('@opentelemetry/instrumentation/hook.mjs', import.meta.url, {
  data: { exclude: [/openai/] },
});
```

**telemetry/init.ts:**

```javascript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import FastifyOtelInstrumentation from '@fastify/otel';

const sdk = new NodeSDK({
  instrumentations: [
    ...getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        headersToSpanAttributes: {
          server: {
            requestHeaders: ['x-request-id', 'x-api-key'],
          },
        },
        ignoreIncomingRequestHook: isIgnorableRequest,
      },
    }),
    new FastifyOtelInstrumentation(),
  ],
});

sdk.start(); // Patches all modules, enables AsyncLocalStorage
```

**Key Packages:**

- `@opentelemetry/auto-instrumentations-node` - Auto-patches HTTP, Fastify, fetch, etc.
- `@opentelemetry/sdk-node` - The standard OTEL Node SDK
- `@fastify/otel` - Fastify-specific instrumentation
- Uses **AsyncLocalStorage** under the hood (automatic, invisible)

### How Auto-Instrumentation Works

1. **Before app starts:** OTEL hooks are loaded via `--import`
2. **Auto-instrumentation:** Patches all HTTP/framework modules automatically
3. **Incoming request:** OTEL extracts `traceparent` from headers → stores in AsyncLocalStorage
4. **Application code:** Zero changes needed! Context is ambient
5. **Outgoing requests:** OTEL auto-injects trace headers
6. **Mastra calls:** Would work automatically if Mastra reads from OTEL API

**Application Code:**

```javascript
// NO MIDDLEWARE NEEDED IN APP CODE!

app.post('/api', async (req, res) => {
  // Context is ambient - no manual extraction
  await agent.generate(messages); // Mastra would read from OTEL automatically
});
```

---

## Our OtelBridge Pattern

### Current Implementation

**Express Example:**

```javascript
import { expressMiddleware } from '@mastra/otel-bridge';

// Manual middleware
app.use(expressMiddleware());

app.post('/chat', (req, res) => {
  // Extract context from request
  const requestContext = req.requestContext;

  // Explicitly pass to Mastra
  await agent.generate(messages, { requestContext });
});
```

**Next.js Example:**

```javascript
// middleware.ts (Edge runtime)
export { nextjsMiddleware as middleware } from '@mastra/otel-bridge/nextjs-middleware';

// app/api/chat/route.ts
import { getNextOtelContext } from '@mastra/otel-bridge';

export async function POST(request: Request) {
  // Manual extraction
  const requestContext = getNextOtelContext(request);

  // Explicit passing
  await agent.generate(messages, { requestContext });
}
```

---

## Comparison Table

| Aspect                | Our OtelBridge                          | Auto-Instrumentation (Examples) |
| --------------------- | --------------------------------------- | ------------------------------- |
| **Setup**             | Import middleware in app                | Load hooks before app starts    |
| **Middleware**        | Manual `expressMiddleware()`            | Automatic, no code changes      |
| **Context Storage**   | Attach to `req` object                  | AsyncLocalStorage (ambient)     |
| **In Routes**         | `const ctx = getOtelContext(req)`       | Nothing - automatic             |
| **Passing to Mastra** | `agent.generate(m, { requestContext })` | `agent.generate(m)`             |
| **Standard Pattern**  | Custom                                  | ✅ Standard OTEL                |
| **Framework Support** | Need middleware per framework           | Works automatically             |
| **Edge Runtime**      | ✅ Works (Next.js)                      | ❌ Node.js only                 |
| **Explicitness**      | ✅ Visible                              | ❌ "Magic"                      |
| **Boilerplate**       | More code                               | Less code                       |

---

## Context Propagation Methods Comparison

### 1. AsyncLocalStorage (Standard OTEL)

**How it works:**

```javascript
const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();

// Middleware sets context
app.use((req, res, next) => {
  const store = { traceId: generateId() };
  storage.run(store, () => next());
});

// Deep in code - no passing needed
function someFunction() {
  const store = storage.getStore();
  console.log(store.traceId); // Available!
}
```

**Pros:**

- Context "follows" async execution chain automatically
- No explicit parameter passing
- Standard OTEL pattern in Node.js
- Clean API surface

**Cons:**

- Node.js only (doesn't work in Edge runtime)
- Slight performance overhead
- "Magic" - harder to debug
- Not compatible with all async patterns

### 2. Request Object Attachment (Our Pattern)

**How it works:**

```javascript
app.use((req, res, next) => {
  req.context = { traceId: '123' };
  next();
});

app.post('/api', (req, res) => {
  doWork(req.context); // Pass explicitly
});
```

**Pros:**

- Simple, explicit, no magic
- Works in any runtime
- Clear dependencies

**Cons:**

- Must pass everywhere
- More boilerplate

### 3. Other Patterns

- **Zones (Angular)**: More comprehensive than AsyncLocalStorage, heavyweight
- **DI Container (NestJS)**: Framework handles wiring, requires DI setup
- **Context Param (Go-style)**: Explicit context as first param (like `context.Context`)
- **Headers Only**: Just propagate headers, no in-process storage

---

## What Languages/Frameworks Use

| Language/Framework | Standard Pattern                                             |
| ------------------ | ------------------------------------------------------------ |
| Node.js            | AsyncLocalStorage (via `@opentelemetry/context-async-hooks`) |
| Go                 | Explicit `context.Context` parameter                         |
| Python             | Context managers with `contextvars`                          |
| Java               | ThreadLocal (threads) or Reactor Context                     |
| Rust               | Explicit context passing                                     |
| Angular            | Zones                                                        |
| NestJS             | Dependency Injection                                         |

---

## Critical Findings

### User Expectations

Both examples demonstrate that users **expect the standard OTEL pattern**:

- Load OTEL SDK at startup with `--import`
- Zero code changes in routes
- Context propagates automatically via AsyncLocalStorage
- Works with standard OTEL tooling

### Our Pattern Is Useful For

1. **Edge runtimes** (Next.js Edge) - AsyncLocalStorage not supported
2. **Explicit control** - Visible context flow
3. **Non-Node environments** - Deno, Bun, browsers
4. **Educational** - Clear what's happening

### But Users Want

1. **Standard OTEL auto-instrumentation**
2. **Ambient context via AsyncLocalStorage**
3. **Zero application code changes**
4. **Compatible with existing OTEL tooling**

---

## Options Forward

### Option 1: Keep Current Pattern

**Pros:**

- Works in Edge runtime
- Explicit and clear
- Already implemented

**Cons:**

- Non-standard
- More boilerplate for users
- Doesn't match user expectations

### Option 2: Add Auto-Instrumentation Support

Make OtelBridge work **with** standard OTEL SDK:

- Users use standard OTEL auto-instrumentation
- OtelBridge provides helper to read ambient context
- Mastra automatically reads from OTEL context

**Example:**

```javascript
// Setup (once at startup)
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();

// App code - NO CHANGES!
app.post('/chat', async (req, res) => {
  // Mastra reads from OTEL automatically
  await agent.generate(messages);
});
```

### Option 3: Document Both Patterns

- Auto-instrumentation as **primary/recommended**
- Manual middleware as **fallback** for Edge/special cases

### Option 4: Make Mastra OTEL-Aware

Change Mastra core to automatically read from OTEL's ambient context:

```javascript
// In Mastra core
import { trace } from '@opentelemetry/api';

class Agent {
  async generate(messages, options) {
    // Auto-detect OTEL context if not provided
    if (!options.requestContext) {
      const activeContext = trace.getActiveSpan()?.spanContext();
      // Use active OTEL context
    }
  }
}
```

---

## Recommendation

**Primary Path**: Option 2 + Option 4

1. **Make Mastra OTEL-aware** - Auto-read from standard OTEL context
2. **Keep manual middleware** - For Edge runtime and explicit control
3. **Document both patterns** - Auto-instrumentation (primary), manual (fallback)

This gives users:

- ✅ Standard OTEL pattern (what they expect)
- ✅ Works with existing OTEL setups (Fastify example)
- ✅ Edge runtime support (Next.js)
- ✅ Choice between explicit and automatic

---

## Questions to Answer

1. Should OtelBridge pivot to support auto-instrumentation as primary pattern?
2. Should Mastra core auto-detect OTEL ambient context?
3. Is the explicit pattern important for Mastra's architecture?
4. Do we need to support both patterns, or choose one?
5. What's the migration path for existing users?

---

## Next Steps

1. **Validate findings** with Mastra team
2. **Prototype OTEL-aware Mastra** - Test auto-detection of ambient context
3. **Document standard pattern** - Show auto-instrumentation setup
4. **Consider deprecation path** - If pivoting away from manual middleware
