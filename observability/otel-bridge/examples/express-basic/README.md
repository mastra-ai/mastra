# Express Basic Example - OtelBridge

> **Note**: This is a minimal example demonstrating the OtelBridge middleware integration. The Mastra agent configuration may need adjustments based on your specific setup and API version.

Minimal example demonstrating OpenTelemetry context propagation with Mastra using Express.

## What This Demonstrates

**Scenario A**: HTTP service receiving W3C trace context headers

- Express server with OtelBridge middleware
- Extracts `traceparent` and `tracestate` headers from incoming requests
- Passes trace context to Mastra agent
- Mastra spans become children of the incoming trace

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

Or with auto-reload:

```bash
pnpm dev
```

## Testing

### Without Trace Context (creates new trace)

```bash
curl -X POST http://localhost:3456/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello!"}'
```

### With Trace Context (continues existing trace)

```bash
curl -X POST http://localhost:3456/chat \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -d '{"message":"Hello!"}'
```

The `traceparent` header format is: `version-traceId-parentSpanId-flags`

- `00` = version
- `4bf92f3577b34da6a3ce929d0e0e4736` = 32-char hex traceId
- `00f067aa0ba902b7` = 16-char hex parentSpanId
- `01` = sampled flag

### With Trace State

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -H "tracestate: vendorname1=opaqueValue1,vendorname2=opaqueValue2" \
  -d '{"message":"Tell me a joke"}'
```

## How It Works

1. **Middleware Extraction**: `otelMiddleware()` extracts OTEL headers from the request and stores them in `req.requestContext`

2. **Bridge Configuration**: `OtelBridge` is configured to extract from headers:

   ```typescript
   new OtelBridge({
     extractFrom: 'headers',
     logLevel: 'debug',
   });
   ```

3. **Context Passing**: The `requestContext` is passed to the agent:

   ```typescript
   await mastra.agents.chatAgent.generate({
     messages: [{ role: 'user', content: message }],
     requestContext: req.requestContext,
   });
   ```

4. **Span Creation**: Mastra uses the bridge to extract `traceId` and `parentSpanId`, creating spans that belong to the same trace

## Expected Output

When you send a request with trace context, the server logs should show:

```
[OtelBridge] Extracted context from headers [traceId=4bf92f3577b34da6a3ce929d0e0e4736]
```

The Mastra spans will use the provided traceId and parentSpanId, maintaining trace continuity.

## Next Steps

- Add OpenTelemetry exporter (OTLP, Jaeger, Zipkin) to visualize traces
- Use `@opentelemetry/auto-instrumentations-node` for automatic HTTP instrumentation
- Connect to an observability backend (Arize, Honeycomb, Datadog, etc.)
