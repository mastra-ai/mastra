# @mastra/otel-bridge

OpenTelemetry Bridge for Mastra Observability.

Enables bidirectional integration between Mastra and OpenTelemetry infrastructure, creating real OTEL spans for Mastra operations and maintaining proper trace hierarchy.

## Overview

`@mastra/otel-bridge` connects Mastra's observability system with standard OpenTelemetry instrumentation through bidirectional integration:

**From OTEL to Mastra:**

- Reads from OTEL ambient context (AsyncLocalStorage) automatically
- Inherits trace ID and parent span ID from active OTEL spans
- Works with standard OTEL auto-instrumentation (no middleware needed)

**From Mastra to OTEL:**

- Creates real OTEL spans for Mastra operations (agents, LLM calls, tools, workflows)
- Maintains proper parent-child relationships in distributed traces
- Allows OTEL-instrumented code (DB calls, HTTP clients) within Mastra operations to nest correctly
- Exports spans with OTEL semantic conventions for GenAI operations

## Installation

```bash
npm install @mastra/otel-bridge
# or
pnpm add @mastra/otel-bridge
```

For the standard OTEL setup (recommended), also install:

```bash
npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
# or
pnpm add @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node
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

### 3. Use Your Agent

The OTEL SDK's auto-instrumentation handles context propagation automatically via AsyncLocalStorage. The bridge creates OTEL spans for all Mastra operations.

```typescript
// Example: Express endpoint using Mastra agent
app.post('/chat', async (req, res) => {
  // OTEL auto-instrumentation creates HTTP span
  // Bridge inherits trace context and creates child spans for agent operations
  const result = await myAgent.generate(req.body.message);
  res.json(result);
});
```

## How It Works

### Span Creation

When Mastra creates a span (agent run, LLM call, tool execution, etc.):

1. **Bridge creates OTEL span** at span creation time with:
   - SpanKind (SERVER for agents/workflows, CLIENT for LLM/MCP tools, INTERNAL for others)
   - Parent context (from active OTEL context or parent Mastra span)
   - Initial span name

2. **Mastra uses OTEL IDs**:
   - `spanId` = OTEL span's 16-char hex ID
   - `traceId` = OTEL span's 32-char hex trace ID
   - `parentSpanId` = parent OTEL span's ID

3. **Internal spans are skipped**:
   - Only external spans (user-facing operations) create OTEL spans
   - Internal spans (workflow internals) don't create OTEL spans to avoid orphaned references

### Span Finalization

When a Mastra span ends:

1. **Bridge retrieves OTEL span** from map using span ID
2. **Sets all final attributes** using SpanConverter (same formatting as otel-exporter):
   - OTEL semantic conventions for GenAI (`gen_ai.*`)
   - Model parameters, usage, finish reasons
   - Tool names, inputs, outputs
   - Error information
3. **Updates span name** to OTEL-compliant format (e.g., `chat gpt-4`, `agent.my-agent`)
4. **Ends OTEL span** and removes from map

### Context Execution

The bridge provides `executeInContext()` and `executeInContextSync()` to run code within a Mastra span's OTEL context. This allows OTEL-instrumented code (DB clients, HTTP clients) to nest correctly under Mastra spans.

## Requirements

- **Dependencies**:
  - `@mastra/core` >= 1.0.0
  - `@opentelemetry/api` >= 1.9.0

**For Standard OTEL Setup:**

- `@opentelemetry/sdk-node` >= 0.205.0
- `@opentelemetry/auto-instrumentations-node` >= 0.64.1

## License

Apache 2.0
