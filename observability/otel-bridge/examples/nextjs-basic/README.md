# Next.js Basic Example - OtelBridge

Minimal example demonstrating OpenTelemetry context propagation with Mastra using Next.js App Router.

## What This Demonstrates

Standard OTEL auto-instrumentation pattern:

- OTEL SDK sets up AsyncLocalStorage for context propagation
- OtelBridge reads from ambient context automatically
- No middleware or explicit context extraction needed
- Mastra spans automatically become children of incoming traces

## Setup

1. Install dependencies from the monorepo root:

```bash
pnpm install
```

2. Build the packages:

```bash
pnpm build
```

3. Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your_key_here
```

## Running the Example

From this directory:

```bash
pnpm start
```

Or with auto-reload in development:

```bash
pnpm dev
```

## Testing

### Without Trace Context (creates new trace)

```bash
curl -X POST http://localhost:3459/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!"}'
```

### With Trace Context (continues existing trace)

```bash
curl -X POST http://localhost:3459/api/chat \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -d '{"message":"Hello!"}'
```

The `traceparent` header format is: `version-traceId-parentSpanId-flags`

- `00` = version
- `4bf92f3577b34da6a3ce929d0e0e4736` = 32-char hex traceId
- `00f067aa0ba902b7` = 16-char hex parentSpanId
- `01` = sampled flag

## How It Works

1. **Instrumentation Setup** (`instrumentation.ts`):
   - Next.js automatically loads `instrumentation.ts` at server startup
   - Configures OTEL SDK with tracer provider and span processor
   - Sets up AsyncLocalStorage-based context propagation
   - Registers Node HTTP auto-instrumentation

2. **OtelBridge Configuration**:

   ```typescript
   new Observability({
     configs: {
       default: {
         serviceName: 'otel-bridge-example-nextjs-basic',
         bridge: new OtelBridge(),
       },
     },
   });
   ```

3. **Automatic Context Propagation**:
   - OTEL SDK automatically extracts `traceparent` headers
   - Context is stored in AsyncLocalStorage
   - OtelBridge reads from active context automatically
   - No middleware or manual context passing needed

4. **Agent Usage** in API routes:

   ```typescript
   const result = await chatAgent.generate([{ role: 'user', content: message }]);
   ```

   - No requestContext parameter needed
   - Bridge automatically reads from ambient OTEL context

## Next.js Instrumentation

Next.js has built-in support for OpenTelemetry instrumentation:

- Place `instrumentation.ts` in the root directory
- Next.js automatically loads it before any other code
- No need to manually import it in your application code
- Works with both Node.js and Edge runtimes (Node.js only for this example)

## Expected Output

When you send a request with trace context, the server logs should show:

```
[OtelBridge] Extracted context from active span [traceId=4bf92f3577b34da6a3ce929d0e0e4736]
```

The Mastra spans will use the provided traceId and parentSpanId, maintaining trace continuity.

## Key Implementation Details

- **Instrumentation File**: `instrumentation.ts` is automatically loaded by Next.js
- **No Middleware**: OTEL auto-instrumentation handles everything
- **No Config**: `OtelBridge()` needs no configuration parameters
- **AsyncLocalStorage**: Context propagates automatically through async calls
- **Runtime**: This example uses Node.js runtime (Edge runtime not yet supported)

## Build Status

The build for this example is currently disabled due to webpack bundling issues with `@mastra/core`. This is being addressed separately. You can still run the example in development mode with `pnpm dev`.

## Next Steps

- Add OpenTelemetry exporter (OTLP, Jaeger, Zipkin) to visualize traces
- Configure additional auto-instrumentations for databases, HTTP clients, etc.
- Connect to an observability backend (Arize, Honeycomb, Datadog, etc.)
- Explore Next.js built-in tracing configuration options
