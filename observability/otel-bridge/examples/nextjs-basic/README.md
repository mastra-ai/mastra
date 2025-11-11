# Next.js Basic Example - OtelBridge

> **Note**: This is a minimal example demonstrating the OtelBridge middleware integration with Next.js App Router. The Mastra agent configuration may need adjustments based on your specific setup and API version.

Minimal example demonstrating OpenTelemetry context propagation with Mastra using Next.js App Router.

## What This Demonstrates

**Scenario A**: HTTP service receiving W3C trace context headers

- Next.js App Router with OtelBridge middleware
- Extracts `traceparent` and `tracestate` headers from incoming requests
- Passes trace context to Mastra agent
- Mastra spans become children of the incoming trace
- Compatible with both Node.js and Edge runtimes

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

### With Trace State

```bash
curl -X POST http://localhost:3459/api/chat \
  -H "Content-Type: application/json" \
  -H "traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01" \
  -H "tracestate: vendorname1=opaqueValue1,vendorname2=opaqueValue2" \
  -d '{"message":"Tell me a joke"}'
```

## How It Works

1. **Middleware Registration**: The `nextjsMiddleware` is exported in `middleware.ts` at the app root. Next.js automatically runs this before all requests to extract OTEL headers and store them in internal headers.

2. **Bridge Configuration**: `OtelBridge` is configured to extract from headers:

   ```typescript
   new OtelBridge({
     extractFrom: 'headers',
     logLevel: 'debug',
   });
   ```

3. **Context Extraction**: The `getOtelContext()` helper is used in API routes to read the internal headers and create a RequestContext:

   ```typescript
   const requestContext = getOtelContext(request);
   await chatAgent.generate([{ role: 'user', content: message }], {
     requestContext,
   });
   ```

4. **Span Creation**: Mastra uses the bridge to extract `traceId` and `parentSpanId`, creating spans that belong to the same trace

## Architecture

Next.js doesn't allow extending Request objects, so the middleware uses internal headers:

1. Middleware extracts `traceparent`/`tracestate` from incoming request
2. Stores them in `x-mastra-otel-traceparent`/`x-mastra-otel-tracestate` headers
3. API routes use `getOtelContext()` to read internal headers and create RequestContext
4. RequestContext is passed to Mastra agent for trace continuity

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
- Deploy to Edge runtime (Vercel Edge, Cloudflare Workers, Netlify Edge)
