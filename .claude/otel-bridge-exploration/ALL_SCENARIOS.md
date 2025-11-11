# Complete OTEL Integration Scenarios

This document identifies all scenarios where Mastra needs to integrate with OpenTelemetry infrastructure in distributed systems.

## Overview

In production environments, Mastra can be deployed in various configurations:

- Standalone microservices
- Within larger applications
- As serverless functions
- In async/background processing
- In streaming/real-time systems

Each deployment pattern has different context propagation requirements.

## Scenario A: HTTP/REST Services (Inter-Service)

### Description

Microservices communicating via HTTP/REST APIs with W3C Trace Context headers.

### Example

Hono example: https://github.com/treasur-inc/mastra-hono-tracing-example

### Context Flow

```
Service A                     Service B (Mastra)
   │                                │
   ├─ HTTP Request ─────────────────>│
   │  Headers:                       │
   │  - traceparent: 00-{trace}-{span}-01
   │  - tracestate: vendor=data      │
   │                                 │
   │                         Extract context
   │                         Create child span
   │                         Process with agent
   │                                 │
   │<──── HTTP Response ──────────────┤
```

### Context Location

- HTTP headers: `traceparent`, `tracestate`
- W3C Trace Context format

### Frameworks Supported

- Hono, Express, Fastify, NestJS, Remix, Next.js API routes

### Current Status

✅ **Planned in Phase 1** - User extracts headers into RequestContext

### Bridge Implementation

```typescript
// Option 1: Manual (current plan)
await RuntimeContext.with(
  new Map([['otel.headers', {
    traceparent: req.header('traceparent'),
    tracestate: req.header('tracestate')
  }]]),
  () => agent.generate(...)
);

// Option 2: Middleware (future)
app.use(otelContextMiddleware());
await agent.generate(...); // Auto-detected
```

---

## Scenario B: Active OTEL Context (In-Process)

### Description

Mastra running inside an application that has OpenTelemetry SDK initialized and managing active context.

### Example

Internal example: `examples/stripped-agent-hub-export`

### Context Flow

```
Application (OTEL Initialized)
   │
   ├─ NodeSDK.start()
   │  └─ Auto-instrumentation active
   │
   ├─ HTTP Request arrives
   │  └─ HTTP instrumentation creates span
   │     └─ Sets active context
   │
   ├─ Route Handler
   │  └─ agent.generate() ← Active context exists!
   │     └─ Bridge detects via trace.getSpan(context.active())
   │        └─ Creates child span with parent's traceId
```

### Context Location

- OTEL Context API: `context.active()`
- Accessed via: `trace.getSpan(context.active())`

### Frameworks Supported

- Any framework with OTEL auto-instrumentation
- Fastify, Express, NestJS, Koa, Hapi

### Current Status

✅ **Planned in Phase 1** - Bridge reads from active context

### Bridge Implementation

```typescript
// No user code changes needed!
app.post('/api/chat', async (req, reply) => {
  // OTEL auto-instrumentation has set active context
  // Bridge automatically detects it
  const result = await agent.generate(...);
  return result;
});
```

---

## Scenario C: Message Queues (Async)

### Description

Trace context propagated through message queue systems (Kafka, RabbitMQ, SQS, Redis, etc.).

### Example Use Case

```
API Service                   Worker Service (Mastra)
    │                               │
    ├─ Receive HTTP request         │
    │  traceId: abc123              │
    │                               │
    ├─ Enqueue message ─────────────>│
    │  { payload: {...},            │
    │    _trace: {                  │
    │      traceparent: "00-abc123-..."
    │    }                           │
    │  }                             │
    │                               │
    │                        Extract _trace
    │                        agent.generate()
    │                        with parent traceId
```

### Context Flow

```
Producer Side:
1. Get active span context
2. Inject into message metadata/headers
3. Publish message with context

Consumer Side:
1. Receive message
2. Extract context from metadata
3. Create span with extracted parent context
4. Process message (call Mastra agent)
```

### Context Location

**Kafka:**

- Message headers: `traceparent`, `tracestate`

**RabbitMQ:**

- Message properties: `headers` object

**AWS SQS:**

- MessageAttributes: `traceparent`, `tracestate`

**Redis/BullMQ:**

- Job data: `_trace` metadata field

### Frameworks/Libraries

- Kafka: `kafkajs`, `node-rdkafka`
- RabbitMQ: `amqplib`
- AWS SQS: `@aws-sdk/client-sqs`
- Redis: `ioredis`, `bull`, `bullmq`

### Current Status

❌ **Not covered** - Needs separate consideration

### Bridge Implementation Requirements

**Option 1: Manual Extraction**

```typescript
// Consumer extracts from message
consumer.on('message', async (message) => {
  const traceContext = message.headers?.traceparent;

  await RuntimeContext.with(
    new Map([['otel.headers', { traceparent: traceContext }]]),
    async () => {
      await agent.generate(...);
    }
  );
});
```

**Option 2: OTEL Auto-Instrumentation**

```typescript
// If OTEL has messaging instrumentation
import { MessagingInstrumentation } from '@opentelemetry/instrumentation-messaging';

// Context is automatically active when message handler runs
consumer.on('message', async (message) => {
  // Bridge detects active context automatically
  await agent.generate(...);
});
```

### Recommendation

- **Phase 1**: Support via manual extraction (Option 1)
- **Phase 2**: Document patterns for each message system
- **Phase 3**: Create helper utilities for common systems

---

## Scenario D: Background/Scheduled Jobs

### Description

Periodic jobs, cron tasks, or delayed job execution where trace context needs to persist across time and process boundaries.

### Example Use Case

```
API Request                   Job Queue              Worker (later)
    │                            │                        │
    ├─ POST /analyze             │                        │
    │  traceId: abc123           │                        │
    ├─ Queue job ───────────────>│                        │
    │  runAt: +5min              │                        │
    │  context: {traceparent}    │                        │
    └─ Return 202 Accepted       │                        │
                                 │                        │
                              5 min later                 │
                                 │                        │
                                 ├─ Dequeue ─────────────>│
                                 │                  Extract context
                                 │                  agent.generate()
                                 │                  Continue trace!
```

### Context Flow

```
Job Creation:
1. API handler has active context
2. Serialize context to job metadata
3. Store job with context

Job Execution:
1. Worker picks up job
2. Deserialize context from metadata
3. Create span with original traceId as parent
4. Execute Mastra agent/workflow
```

### Context Location

- Job metadata/payload
- Database columns (for persisted jobs)
- Redis job data (BullMQ, Bee-Queue)

### Frameworks/Libraries

- BullMQ, Bull, Bee-Queue (Redis)
- node-cron, node-schedule
- Temporal, Inngest
- AWS Step Functions
- Google Cloud Tasks

### Current Status

❌ **Not covered** - Needs separate consideration

### Bridge Implementation Requirements

**Job Creation:**

```typescript
import { trace, context } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';

// When creating job
const propagator = new W3CTraceContextPropagator();
const carrier = {};
propagator.inject(context.active(), carrier, ...);

await queue.add('process-data', {
  data: { ... },
  _trace: carrier,  // Store trace context
});
```

**Job Execution:**

```typescript
worker.process(async (job) => {
  const traceContext = job.data._trace;

  // Option 1: Manual
  await RuntimeContext.with(
    new Map([['otel.headers', traceContext]]),
    () => agent.generate(...)
  );

  // Option 2: Use tracingOptions directly
  await agent.generate({
    messages: [...],
    tracingOptions: {
      traceId: extractedTraceId,
      parentSpanId: extractedParentSpanId,
    }
  });
});
```

### Recommendation

- **Phase 1**: Document pattern for manual context passing
- **Phase 2**: Create utilities for popular job queues
- **Phase 3**: Consider Mastra-native job queue with built-in context

---

## Scenario E: Serverless/Edge Functions

### Description

Mastra running in serverless functions (AWS Lambda, Cloudflare Workers, Vercel Edge) where context arrives in event metadata.

### Example Use Case

```
API Gateway                    Lambda (Mastra)
    │                               │
    ├─ HTTP Request                 │
    │  Headers: traceparent         │
    │                               │
    ├─ Create event ────────────────>│
    │  {                             │
    │    headers: {                  │
    │      traceparent: "00-..."    │
    │    },                          │
    │    body: {...}                 │
    │  }                             │
    │                          Extract from event
    │                          agent.generate()
    │                                │
    │<──── Response ─────────────────┤
```

### Context Flow

```
Serverless Platforms:
1. Platform receives request with headers
2. Creates event object with headers
3. Invokes function with event
4. Function extracts context from event.headers
5. Creates Mastra span with parent context
```

### Context Location

**AWS Lambda:**

- `event.headers['traceparent']` (via API Gateway)
- X-Ray trace header: `event.headers['x-amzn-trace-id']`

**Cloudflare Workers:**

- `request.headers.get('traceparent')`

**Vercel Edge Functions:**

- `request.headers.get('traceparent')`

**Netlify Functions:**

- `event.headers['traceparent']`

### Frameworks

- Hono (works on all platforms)
- tRPC, Remix, Next.js, SvelteKit
- itty-router (Cloudflare)

### Current Status

⚠️ **Partially covered** - Works with header extraction pattern

### Bridge Implementation

```typescript
// AWS Lambda
export async function handler(event) {
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

// Cloudflare Workers with Hono
app.use('*', async (c, next) => {
  const traceparent = c.req.header('traceparent');
  await RuntimeContext.with(
    new Map([['otel.headers', { traceparent }]]),
    () => next()
  );
});
```

### Special Considerations

- **Cold starts**: Each invocation may be isolated
- **X-Ray integration**: AWS Lambda uses X-Ray format, needs conversion
- **Edge runtime limits**: Must work with edge-compatible OTEL packages

### Recommendation

- **Phase 1**: Support via header extraction (already planned)
- **Phase 2**: Document platform-specific patterns
- **Phase 3**: Helper for AWS X-Ray trace ID conversion

---

## Scenario F: Streaming/Real-time (WebSockets, SSE)

### Description

Long-lived connections (WebSockets, Server-Sent Events) where trace context is established once and maintained throughout connection lifecycle.

### Example Use Case

```
Client                 WebSocket Server (Mastra)
  │                           │
  ├─ Connect ────────────────>│
  │  traceparent in upgrade   │
  │                    Create connection span
  │                    Store context with connection
  │                           │
  ├─ Message 1 ──────────────>│
  │                    agent.generate()
  │                    (child of connection span)
  │                           │
  │<──── Response ─────────────┤
  │                           │
  ├─ Message 2 ──────────────>│
  │                    agent.generate()
  │                    (child of connection span)
```

### Context Flow

```
Connection Establishment:
1. Client sends traceparent in upgrade headers or first message
2. Server stores context with WebSocket connection object
3. Creates a connection-level span

Message Processing:
1. Receive message on connection
2. Retrieve stored context for this connection
3. Create message span as child of connection span
4. Process with Mastra agent
```

### Context Location

**WebSocket:**

- Upgrade headers: `req.headers.traceparent`
- Store in connection metadata: `ws.metadata = { traceparent }`

**Server-Sent Events:**

- Initial GET request headers

**Socket.io:**

- Handshake auth: `socket.handshake.auth.traceparent`

### Frameworks

- ws, uWebSockets.js
- Socket.io
- Fastify WebSocket plugin
- Hono WebSocket helper

### Current Status

❌ **Not covered** - Needs separate consideration

### Bridge Implementation

```typescript
import WebSocket from 'ws';

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  // Extract context from upgrade request
  const traceparent = req.headers.traceparent;

  // Store with connection
  ws.traceContext = { traceparent };

  ws.on('message', async data => {
    // Use stored context for all messages
    await RuntimeContext.with(new Map([['otel.headers', ws.traceContext]]), async () => {
      const result = await agent.generate({
        messages: [{ role: 'user', content: data }],
      });
      ws.send(JSON.stringify(result));
    });
  });
});
```

### Recommendation

- **Phase 1**: Document connection context pattern
- **Phase 2**: Create WebSocket context middleware
- **Phase 3**: Built-in support for streaming responses

---

## Scenario G: gRPC Services

### Description

Mastra as a gRPC service or calling Mastra from gRPC handlers, with context in gRPC metadata.

### Example Use Case

```
gRPC Client              gRPC Server (Mastra)
    │                          │
    ├─ RPC Call ──────────────>│
    │  Metadata:               │
    │  - traceparent           │
    │                   Extract from metadata
    │                   agent.generate()
    │                          │
    │<──── Response ────────────┤
```

### Context Flow

```
Client Side:
1. Get active context
2. Inject into gRPC metadata
3. Send RPC call

Server Side:
1. Receive RPC call
2. Extract context from metadata
3. Create span with parent context
4. Process with Mastra
```

### Context Location

- gRPC Metadata: `traceparent` key

### Frameworks

- @grpc/grpc-js
- @connectrpc/connect (Connect protocol)
- NestJS with gRPC

### Current Status

❌ **Not covered** - Needs separate consideration

### Bridge Implementation

**Server:**

```typescript
import * as grpc from '@grpc/grpc-js';

function handleChat(call, callback) {
  const metadata = call.metadata;
  const traceparent = metadata.get('traceparent')[0];

  await RuntimeContext.with(
    new Map([['otel.headers', { traceparent }]]),
    async () => {
      const result = await agent.generate(...);
      callback(null, result);
    }
  );
}
```

**OTEL Auto-instrumentation:**

```typescript
// With @opentelemetry/instrumentation-grpc
// Context is automatically active!
function handleChat(call, callback) {
  // Bridge auto-detects active context
  const result = await agent.generate(...);
  callback(null, result);
}
```

### Recommendation

- **Phase 1**: Document gRPC metadata extraction
- **Phase 2**: Test with OTEL gRPC auto-instrumentation
- **Phase 3**: Native gRPC support if needed

---

## Scenario H: Multi-tenant/Multi-region

### Description

Distributed systems with tenant isolation, multiple regions, or complex routing where context includes custom metadata.

### Example Use Case

```
Request with tenant ID
    │
    ├─ Region: US-West
    ├─ Tenant: acme-corp
    ├─ traceId: abc123
    │
    ├─ Route to tenant shard ────>│
    │                       Extract tenant + trace
    │                       agent.generate()
    │                       with tenant context
```

### Context Flow

- Standard trace context (traceId, spanId)
- PLUS custom baggage/metadata (tenant ID, region, etc.)
- Propagated via W3C `tracestate` header or baggage

### Context Location

```
Headers:
- traceparent: 00-{traceId}-{spanId}-01
- tracestate: tenant=acme-corp,region=us-west
```

Or OTEL Baggage:

```
baggage: tenantId=acme-corp,region=us-west
```

### Current Status

❌ **Not covered** - But supported by RequestContext pattern

### Bridge Implementation

```typescript
// Extract both trace context AND custom metadata
const traceparent = req.header('traceparent');
const tracestate = req.header('tracestate');

await RuntimeContext.with(
  new Map([
    ['otel.headers', { traceparent, tracestate }],
    ['tenant.id', extractTenant(tracestate)],
    ['region', extractRegion(tracestate)],
  ]),
  () => agent.generate(...)
);
```

### Recommendation

- **Phase 1**: RequestContext pattern already supports this
- **Phase 2**: Document tracestate/baggage extraction
- **Phase 3**: Built-in utilities for common metadata patterns

---

## Summary Matrix

| Scenario           | Context Source      | Bridge Support | Priority | Complexity |
| ------------------ | ------------------- | -------------- | -------- | ---------- |
| A: HTTP/REST       | Headers             | ✅ Planned     | P0       | Low        |
| B: Active Context  | OTEL API            | ✅ Planned     | P0       | Low        |
| C: Message Queues  | Message metadata    | ⚠️ Manual      | P1       | Medium     |
| D: Background Jobs | Job metadata        | ⚠️ Manual      | P1       | Medium     |
| E: Serverless      | Event headers       | ⚠️ Works       | P1       | Low        |
| F: WebSocket/SSE   | Connection metadata | ❌ Not covered | P2       | High       |
| G: gRPC            | gRPC metadata       | ⚠️ Manual      | P2       | Medium     |
| H: Multi-tenant    | tracestate/baggage  | ⚠️ Works       | P2       | Low        |

**Legend:**

- ✅ Planned: Will work in Phase 1
- ⚠️ Manual: Works with manual extraction
- ⚠️ Works: Already works with current plan
- ❌ Not covered: Needs additional work

## Universal Pattern

All scenarios can be supported through a common pattern:

```typescript
// 1. Extract context from source (headers, metadata, event, etc.)
const traceContext = extractFromSource(source);

// 2. Put in RequestContext
await RuntimeContext.with(
  new Map([['otel.headers', traceContext]]),
  () => {
    // 3. Call Mastra - bridge auto-detects
    return agent.generate(...);
  }
);
```

Or with active OTEL instrumentation:

```typescript
// If OTEL auto-instrumentation is active for this protocol,
// bridge auto-detects with NO user code changes
const result = await agent.generate(...);
```

## Recommendations

### Phase 1: Core (Scenarios A, B)

- HTTP headers extraction
- Active OTEL context detection
- Basic RequestContext pattern

### Phase 2: Async (Scenarios C, D, E)

- Document message queue patterns
- Document job queue patterns
- Test serverless platforms
- Create helper utilities

### Phase 3: Advanced (Scenarios F, G, H)

- WebSocket/SSE patterns
- gRPC testing
- Multi-tenant utilities
- Custom propagators

## Framework Compatibility Strategy

Instead of framework-specific implementations, use a **universal extraction pattern**:

```typescript
// Universal interface for context extraction
interface ContextExtractor {
  extract(source: any): { traceparent?: string; tracestate?: string };
}

// Implementations for each source type
const extractors = {
  httpHeaders: headers => ({
    traceparent: headers['traceparent'],
    tracestate: headers['tracestate'],
  }),

  grpcMetadata: metadata => ({
    traceparent: metadata.get('traceparent')[0],
  }),

  messageHeaders: message => ({
    traceparent: message.headers?.traceparent,
  }),

  // ... etc
};
```

This keeps the bridge framework-agnostic while supporting all scenarios.
