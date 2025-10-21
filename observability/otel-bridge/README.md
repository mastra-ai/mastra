# @mastra/otel-bridge

OpenTelemetry bridge for Mastra - enables in-process interop with existing OpenTelemetry traces.

## Overview

The `@mastra/otel-bridge` package makes Mastra participate in your application's existing OpenTelemetry trace context. Unlike `@mastra/otel-exporter` which sends Mastra spans to OTEL backends, this bridge integrates Mastra spans directly into your app's active OTEL traces.

### Key Differences

| Feature | `@mastra/otel-bridge` | `@mastra/otel-exporter` |
|---------|----------------------|------------------------|
| **Purpose** | In-process interop with existing OTEL traces | Export Mastra spans to OTEL backends |
| **Context Join** | Reads active OTEL context and creates child spans | Creates independent trace trees |
| **Sampling** | Respects OTEL sampling decisions | All spans exported (unless filtered) |
| **Use Case** | Teams using OTEL instrumentation in their app | Teams wanting to send to OTEL collectors |
| **Parent Traces** | Mastra spans appear under existing OTEL traces | Mastra spans are root-level |

## Installation

```bash
npm install @mastra/otel-bridge
```

## Prerequisites

You must have OpenTelemetry already set up in your application:

```bash
npm install @opentelemetry/api @opentelemetry/sdk-trace-node
```

## Usage

### Basic Setup

```typescript
import { OtelBridge } from '@mastra/otel-bridge';
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  observability: {
    configs: {
      myTracing: {
        serviceName: 'my-service',
        exporters: [
          new OtelBridge({
            tracerName: 'mastra',
            attributePrefix: 'mastra.',
          }),
        ],
      },
    },
  },
});
```

### Configuration Options

```typescript
interface OtelBridgeConfig {
  /**
   * Name of the tracer to use for creating OTEL spans
   * @default 'mastra'
   */
  tracerName?: string;

  /**
   * Version of the tracer
   * @default '1.0.0'
   */
  tracerVersion?: string;

  /**
   * Prefix for Mastra-specific attributes
   * @default 'mastra.'
   */
  attributePrefix?: string;

  /**
   * Force export even for non-sampled spans
   * When true, creates OTEL spans even if OTEL sampling decision is negative
   * @default false
   */
  forceExport?: boolean;

  /**
   * Debug logging level
   * @default 'warn'
   */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';

  /**
   * Additional resource attributes to attach to spans
   */
  resourceAttributes?: Record<string, string | number | boolean>;
}
```

### With Multiple Exporters

You can combine the bridge with other exporters like Langfuse or Braintrust:

```typescript
import { OtelBridge } from '@mastra/otel-bridge';
import { LangfuseExporter } from '@mastra/langfuse';

const mastra = new Mastra({
  observability: {
    configs: {
      myTracing: {
        serviceName: 'my-service',
        exporters: [
          // Bridge to existing OTEL traces
          new OtelBridge({
            tracerName: 'mastra',
            attributePrefix: 'mastra.',
          }),
          // Also send to Langfuse
          new LangfuseExporter({
            apiKey: process.env.LANGFUSE_API_KEY,
          }),
        ],
      },
    },
  },
});
```

### Example: Mastra in Express with OTEL

```typescript
import express from 'express';
import { trace } from '@opentelemetry/api';
import { OtelBridge } from '@mastra/otel-bridge';
import { Mastra } from '@mastra/core';

// Set up your OTEL instrumentation (SDK, exporters, etc.)
// ... OTEL setup code ...

const app = express();

// Configure Mastra with OTEL bridge
const mastra = new Mastra({
  observability: {
    configs: {
      myTracing: {
        serviceName: 'my-express-app',
        exporters: [new OtelBridge()],
      },
    },
  },
});

app.get('/chat', async (req, res) => {
  // This handler is already instrumented by OTEL
  // The active span context will be automatically picked up by Mastra

  const agent = mastra.getAgent('myAgent');

  // Mastra spans will appear as children of the Express route span
  const response = await agent.generate('Hello!');

  res.json({ response });
});
```

## How It Works

### Context Join

When a Mastra span starts, the bridge:

1. Reads the current OTEL context using `context.active()`
2. Checks if there's an active OTEL span
3. Creates a new OTEL span as a child of the active span (or root if none)
4. Stores the mapping between Mastra span ID and OTEL span

### Dual Lifecycle

The bridge mirrors Mastra span lifecycle events to OTEL spans:

- **SPAN_STARTED**: Create and start an OTEL span
- **SPAN_UPDATED**: Update OTEL span attributes
- **SPAN_ENDED**: Set final attributes, status, and end the OTEL span

### Sampling Alignment

The bridge respects OTEL sampling decisions:

- If the active OTEL context is not sampled (`traceFlags & 0x01 === 0`), Mastra spans are skipped
- Use `forceExport: true` to override this and always create OTEL spans

### Attribute Mapping

Mastra attributes are mapped to OTEL semantic conventions:

| Mastra Attribute | OTEL Attribute |
|-----------------|----------------|
| `model` | `gen_ai.request.model` |
| `provider` | `gen_ai.system` |
| `usage.inputTokens` | `gen_ai.usage.input_tokens` |
| `usage.outputTokens` | `gen_ai.usage.output_tokens` |
| `toolId` | `gen_ai.tool.name` |

Custom Mastra attributes use the configured prefix (default `mastra.`):

- `mastra.span.type`
- `mastra.trace_id`
- `mastra.span_id`
- `mastra.latency_ms`
- etc.

## Debugging

Enable debug logging to see bridge operations:

```typescript
new OtelBridge({
  logLevel: 'debug',
})
```

This will log:
- Span start/update/end events
- Parent-child relationships
- Sampling decisions
- Registry cleanup

## When to Use

Use `@mastra/otel-bridge` when:

- Your app is already instrumented with OpenTelemetry
- You want Mastra spans woven into your existing distributed traces
- You need parent/child relationships preserved between OTEL and Mastra spans
- You're using vendors like Datadog, New Relic, Grafana, Jaeger, etc. with OTEL

Use `@mastra/otel-exporter` when:

- You want to send Mastra spans to OTEL backends but don't use OTEL in-process
- You want Mastra to have independent trace trees
- You're sending to multiple backends in parallel

## License

Apache-2.0
