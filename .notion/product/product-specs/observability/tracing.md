# Tracing

Captures the causal structure and timing of executions in Mastra applications.

---

## Overview

Traces capture the causal structure and timing of executions. Mastra automatically instruments agent runs, workflow steps, tool calls, and model generations as hierarchical spans. Traces answer: *"How did it flow? What was slow? What called what?"*

**Note:** This is a post-implementation design document. Tracing was implemented before formal design specs were created.

---

## Span Types

Mastra supports 16 span types for comprehensive AI instrumentation:

### Agent & Model Spans

| Type | Value | Description |
|------|-------|-------------|
| `AGENT_RUN` | `agent_run` | Root span for agent execution |
| `MODEL_GENERATION` | `model_generation` | LLM model call with token usage, prompts, completions |
| `MODEL_STEP` | `model_step` | Single model execution step within a generation |
| `MODEL_CHUNK` | `model_chunk` | Individual streaming chunk/event |
| `TOOL_CALL` | `tool_call` | Function/tool execution |
| `MCP_TOOL_CALL` | `mcp_tool_call` | MCP (Model Context Protocol) tool execution |
| `PROCESSOR_RUN` | `processor_run` | Input or Output Processor execution |

### Workflow Spans

| Type | Value | Description |
|------|-------|-------------|
| `WORKFLOW_RUN` | `workflow_run` | Root span for workflow execution |
| `WORKFLOW_STEP` | `workflow_step` | Workflow step execution |
| `WORKFLOW_CONDITIONAL` | `workflow_conditional` | Conditional execution |
| `WORKFLOW_CONDITIONAL_EVAL` | `workflow_conditional_eval` | Individual condition evaluation |
| `WORKFLOW_PARALLEL` | `workflow_parallel` | Parallel execution |
| `WORKFLOW_LOOP` | `workflow_loop` | Loop execution (foreach, dowhile, dountil) |
| `WORKFLOW_SLEEP` | `workflow_sleep` | Sleep operation |
| `WORKFLOW_WAIT_EVENT` | `workflow_wait_event` | Wait for event operation |

### Generic

| Type | Value | Description |
|------|-------|-------------|
| `GENERIC` | `generic` | Custom operations |

### Entity Types

Spans are also tagged with entity types for categorization:

| Entity Type | Description |
|-------------|-------------|
| `AGENT` | Agent execution |
| `TOOL` | Tool execution |
| `WORKFLOW_RUN` | Workflow execution |
| `WORKFLOW_STEP` | Workflow step |
| `INPUT_PROCESSOR` | Input processor |
| `OUTPUT_PROCESSOR` | Output processor |
| `INPUT_STEP_PROCESSOR` | Input step processor |
| `OUTPUT_STEP_PROCESSOR` | Output step processor |
| `EVAL` | Evaluation |

---

## Span Attributes

Each span type has type-specific attributes. Key attribute interfaces:

### Model Generation Attributes

```typescript
interface ModelGenerationAttributes {
  model?: string;              // Model name (e.g., 'gpt-4', 'claude-3')
  provider?: string;           // Provider (e.g., 'openai', 'anthropic')
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning' | 'planning';
  usage?: UsageStats;          // Token usage statistics
  parameters?: {               // Model parameters
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    // ... etc
  };
  streaming?: boolean;
  finishReason?: string;
  completionStartTime?: Date;  // For TTFT metrics
  responseModel?: string;      // Actual model used
}
```

### Token Usage Tracking

```typescript
interface UsageStats {
  inputTokens?: number;
  outputTokens?: number;
  inputDetails?: {
    text?: number;       // Regular text tokens
    cacheRead?: number;  // Cache hit tokens
    cacheWrite?: number; // Cache creation (Anthropic)
    audio?: number;      // Audio input tokens
    image?: number;      // Image/PDF tokens
  };
  outputDetails?: {
    text?: number;       // Regular text output
    reasoning?: number;  // Reasoning/thinking tokens
    audio?: number;      // Audio output tokens
    image?: number;      // Image output tokens
  };
}
```

### Workflow Attributes

Each workflow span type has specific attributes:
- **WorkflowLoopAttributes**: `loopType`, `iteration`, `totalIterations`, `concurrency`
- **WorkflowConditionalAttributes**: `conditionCount`, `truthyIndexes`, `selectedSteps`
- **WorkflowSleepAttributes**: `durationMs`, `untilDate`, `sleepType`
- **WorkflowWaitEventAttributes**: `eventName`, `timeoutMs`, `eventReceived`

### Common Span Fields

All spans include:

| Field | Description |
|-------|-------------|
| `id` | Unique span identifier |
| `traceId` | OpenTelemetry-compatible trace ID (32 hex chars) |
| `name` | Span name |
| `type` | SpanType enum value |
| `entityType` | EntityType for categorization |
| `entityId` | Entity identifier |
| `entityName` | Entity name |
| `startTime` | When span started |
| `endTime` | When span ended |
| `input` | Input data |
| `output` | Output data |
| `metadata` | User-defined metadata |
| `tags` | Labels for filtering (root spans only) |
| `errorInfo` | Error details if failed |

---

## Architecture

Tracing is built on OpenTelemetry concepts but provides a Mastra-specific abstraction layer for AI-focused observability.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Mastra Tracing Architecture                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                      │
│  │  Agent.generate  │    │  Workflow.start  │                      │
│  │  Agent.stream    │    │  Workflow.stream │                      │
│  └────────┬─────────┘    └────────┬─────────┘                      │
│           │                       │                                 │
│           └───────────┬───────────┘                                │
│                       ▼                                             │
│           ┌───────────────────────┐                                │
│           │   TracingContext      │                                │
│           │   - currentSpan       │                                │
│           │   - createChildSpan() │                                │
│           └───────────┬───────────┘                                │
│                       │                                             │
│                       ▼                                             │
│           ┌───────────────────────┐                                │
│           │   Span Processors     │  (transform/filter/enrich)     │
│           │   - SensitiveDataFilter                                │
│           │   - Custom processors │                                │
│           └───────────┬───────────┘                                │
│                       │                                             │
│                       ▼                                             │
│     ┌─────────────────────────────────────────────────┐            │
│     │              Exporters (parallel)                │            │
│     │  ┌─────────┐ ┌─────────┐ ┌─────────┐           │            │
│     │  │ Default │ │ Cloud   │ │External │           │            │
│     │  │(Storage)│ │(Mastra) │ │(Langfuse│           │            │
│     │  │         │ │         │ │ Arize,  │           │            │
│     │  │         │ │         │ │ etc.)   │           │            │
│     │  └─────────┘ └─────────┘ └─────────┘           │            │
│     └─────────────────────────────────────────────────┘            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

Tracing is configured through the `Observability` class with named configurations:

```typescript
import { Mastra } from "@mastra/core";
import {
  Observability,
  DefaultExporter,
  CloudExporter,
  SensitiveDataFilter,
} from "@mastra/observability";

export const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        serviceName: "my-service",
        sampling: { type: "always" },
        exporters: [
          new DefaultExporter(),   // Persists to storage for Studio
          new CloudExporter(),     // Sends to Mastra Cloud
        ],
        spanOutputProcessors: [
          new SensitiveDataFilter(),
        ],
        serializationOptions: {
          maxStringLength: 1024,
          maxDepth: 6,
          maxArrayLength: 50,
          maxObjectKeys: 50,
        },
        requestContextKeys: ["userId", "environment"],
      },
    },
    configSelector: (context, availableConfigs) => {
      // Dynamic config selection based on context
      return "default";
    },
  }),
});
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `serviceName` | string | Identifies your service in traces |
| `sampling` | object | Sampling strategy configuration |
| `exporters` | Exporter[] | Where to send trace data |
| `spanOutputProcessors` | Processor[] | Transform spans before export |
| `serializationOptions` | object | Control payload truncation |
| `requestContextKeys` | string[] | Auto-extract metadata from RequestContext |

---

## Sampling Strategies

Control which traces are collected:

| Strategy | Config | Description |
|----------|--------|-------------|
| Always | `{ type: "always" }` | Capture 100% of traces (default) |
| Never | `{ type: "never" }` | Disable tracing entirely |
| Ratio | `{ type: "ratio", probability: 0.1 }` | Sample percentage (0-1) |
| Custom | `{ type: "custom", sampler: fn }` | Custom logic based on context |

### Custom Sampler Example

```typescript
sampling: {
  type: 'custom',
  sampler: (options) => {
    // Sample premium users at higher rate
    if (options?.metadata?.userTier === 'premium') {
      return Math.random() < 0.5; // 50%
    }
    return Math.random() < 0.01; // 1% default
  }
}
```

---

## Exporters

Exporters determine where trace data is sent. Multiple exporters can be used simultaneously.

### Internal Exporters

| Exporter | Package | Description |
|----------|---------|-------------|
| DefaultExporter | @mastra/observability | Persists to storage for Studio |
| CloudExporter | @mastra/observability | Sends to Mastra Cloud |

### External Exporters

| Exporter | Package | Description |
|----------|---------|-------------|
| ArizeExporter | @mastra/arize | Arize Phoenix/AX (OpenInference) |
| BraintrustExporter | @mastra/braintrust | Braintrust eval platform |
| DatadogExporter | @mastra/datadog | Datadog APM via OTLP |
| LaminarExporter | @mastra/laminar | Laminar via OTLP/HTTP |
| LangfuseExporter | @mastra/langfuse | Langfuse LLM platform |
| LangSmithExporter | @mastra/langsmith | LangSmith observability |
| PostHogExporter | @mastra/posthog | PostHog AI analytics |
| SentryExporter | @mastra/sentry | Sentry via OTel |
| OtelExporter | @mastra/observability | Any OTel-compatible backend |

### Per-Exporter Formatters

Each exporter can have a custom span formatter for platform-specific formatting:

```typescript
new BraintrustExporter({
  customSpanFormatter: (span) => ({
    ...span,
    input: extractPlainText(span.input),
  }),
})
```

Formatters support async operations and can be chained:

```typescript
import { chainFormatters } from "@mastra/observability";

new LangfuseExporter({
  customSpanFormatter: chainFormatters([
    plainTextFormatter,      // sync
    userEnrichmentFormatter, // async
  ]),
})
```

---

## Bridges

Bridges provide bidirectional integration with external tracing systems, unlike exporters which only send data out.

| Bridge | Description |
|--------|-------------|
| OtelBridge | Integrates with existing OpenTelemetry infrastructure |

### Bridges vs Exporters

| Feature | Bridges | Exporters |
|---------|---------|-----------|
| Creates native spans in external systems | Yes | No |
| Inherits context from external systems | Yes | No |
| Sends data to backends | Via external SDK | Directly |
| Use case | Existing distributed tracing | Standalone Mastra tracing |

---

## Span Processors

Span processors transform, filter, or enrich spans before export. They run once and affect all exporters.

### Built-in Processors

- **SensitiveDataFilter** - Redacts passwords, tokens, API keys

### Custom Processor Interface

```typescript
interface SpanOutputProcessor {
  name: string;
  process(span: AnySpan): AnySpan;
  shutdown(): Promise<void>;
}
```

### Example Custom Processor

```typescript
class LowercaseInputProcessor implements SpanOutputProcessor {
  name = "lowercase-processor";

  process(span: AnySpan): AnySpan {
    span.input = `${span.input}`.toLowerCase();
    return span;
  }

  async shutdown(): Promise<void> {}
}
```

---

## Auto-Instrumentation

Mastra automatically creates spans for:

### Agent Operations

| Operation | Span Created |
|-----------|--------------|
| `agent.generate()` | Agent run span |
| `agent.stream()` | Agent run span |
| LLM calls | Model generation span (child) |
| Tool executions | Tool call span (child) |
| Memory operations | Memory span (child) |

### Workflow Operations

| Operation | Span Created |
|-----------|--------------|
| `workflow.start()` | Workflow run span |
| `workflow.stream()` | Workflow run span |
| Step execution | Step span (child) |
| Control flow | Conditional/loop spans |
| Wait operations | Wait span |

---

## Tracing Options

Per-execution tracing options can be passed to `generate()`, `stream()`, or `start()`:

```typescript
const result = await agent.generate("Hello", {
  tracingOptions: {
    // Tags for filtering
    tags: ["production", "experiment-v2"],

    // Custom metadata
    metadata: { userId: "user-123" },

    // Additional RequestContext keys to extract
    requestContextKeys: ["experimentId"],

    // Data masking
    hideInput: true,
    hideOutput: true,

    // External trace context propagation
    traceId: parentTraceId,
    parentSpanId: parentSpanId,
  },
});
```

### Tags

String labels for categorization and filtering:
- Applied to root span only
- Supported by most exporters (Langfuse, Braintrust, Arize, OTel)

### Metadata

Structured key-value data attached to spans:
- Can be set via `tracingOptions.metadata`
- Auto-extracted from RequestContext via `requestContextKeys`
- Dot notation supported for nested values (`"user.id"`)

### Data Masking

| Option | Effect |
|--------|--------|
| `hideInput: true` | Exclude input from all spans in trace |
| `hideOutput: true` | Exclude output from all spans in trace |

---

## Child Spans

Create child spans within tools or workflow steps for fine-grained tracking:

```typescript
execute: async (inputData, context) => {
  const querySpan = context?.tracingContext.currentSpan?.createChildSpan({
    type: "generic",
    name: "database-query",
    input: { query: inputData.query },
    metadata: { database: "production" },
  });

  try {
    const results = await db.query(inputData.query);
    querySpan?.end({
      output: results.data,
      metadata: { rowsReturned: results.length },
    });
    return results;
  } catch (error) {
    querySpan?.error({ error });
    throw error;
  }
}
```

---

## Serialization Options

Control how span data is truncated before export:

| Option | Default | Description |
|--------|---------|-------------|
| `maxStringLength` | 1024 | Max length for string values |
| `maxDepth` | 6 | Max depth for nested objects |
| `maxArrayLength` | 50 | Max items in arrays |
| `maxObjectKeys` | 50 | Max keys in objects |

---

## Multi-Config Setup

Use `configSelector` for dynamic configuration selection:

```typescript
new Observability({
  configs: {
    development: { /* full tracing */ },
    production: { /* sampled tracing */ },
    debug: { /* detailed tracing */ },
  },
  configSelector: (context, availableConfigs) => {
    if (context.requestContext?.get("supportMode")) {
      return "debug";
    }
    return process.env.NODE_ENV || "development";
  },
})
```

**Note:** Only one config is used per execution, but a single config can have multiple exporters.

---

## External Trace Context

Integrate Mastra traces into existing distributed traces:

```typescript
import { trace } from "@opentelemetry/api";

const currentSpan = trace.getActiveSpan();
const spanContext = currentSpan?.spanContext();

const result = await agent.generate(message, {
  tracingOptions: spanContext ? {
    traceId: spanContext.traceId,
    parentSpanId: spanContext.spanId,
  } : undefined,
});
```

### ID Format Requirements

- **Trace IDs**: 1-32 hexadecimal characters
- **Span IDs**: 1-16 hexadecimal characters

Invalid IDs are handled gracefully (logged and ignored).

---

## Retrieving Trace IDs

Trace IDs are returned from execution methods:

```typescript
// Agent
const result = await agent.generate("Hello");
console.log(result.traceId);

// Workflow
const run = await workflow.createRun();
const result = await run.start({ inputData });
console.log(result.traceId);
```

---

## Serverless Flush

In serverless environments, call `flush()` to ensure spans are exported before termination:

```typescript
export async function POST(req: Request) {
  const result = await agent.generate(await req.text());

  // Ensure spans are exported
  const observability = mastra.getObservability();
  await observability.flush();

  return Response.json(result);
}
```

### flush() vs shutdown()

| Method | Behavior | Use Case |
|--------|----------|----------|
| `flush()` | Exports buffered spans, keeps exporter active | Serverless, periodic flushing |
| `shutdown()` | Exports buffered spans, releases resources | Application termination |

---

## Cross-Signal Correlation

Traces provide the foundation for correlating all observability signals:

| Signal | Correlation |
|--------|-------------|
| **Logs** | traceId, spanId automatically attached |
| **Metrics** | Auto-labeled with entity type/name from span context |

See [Architecture & Configuration](./architecture-configuration.md) for details.

---

## User Feedback on Traces (Future)

**Status:** Planned

Allow users to attach feedback scores to traces or spans, enabling quality tracking from real user interactions.

### Concept

```typescript
// Client-side SDK
mastra.submitFeedback({
  traceId: "abc123",
  spanId: "def456",         // Optional: target specific span
  type: "thumbs",           // thumbs | rating | text
  value: 1,                 // 1 (up) or -1 (down) for thumbs; 1-5 for rating
  comment: "Great response", // Optional text
});
```

### Score Source

Feedback scores are stored with a `source` field to distinguish from automated scoring:

| Source | Description |
|--------|-------------|
| `SCORER` | Automated LLM-as-judge or code-based scorer |
| `USER` | End-user feedback (thumbs, ratings) |
| `ANNOTATION` | Human reviewer via annotation queue |

### Use Cases

- **Thumbs up/down** on agent responses
- **Star ratings** (1-5) for quality
- **Text comments** for detailed feedback
- **Implicit signals** (copy action, retry, time on page)

### Analytics

User feedback enables:
- Correlation between automated scores and user satisfaction
- Identification of traces needing review
- Quality trends over time by agent/workflow

→ See [Plan Analysis](./plan-analysis.md) for competitive comparison with Langfuse feedback collection

---

## Storage

Traces are persisted via `DefaultExporter` to the configured storage backend. Supported backends:

| Backend | Package | Notes |
|---------|---------|-------|
| DuckDB | npm-only | Recommended local dev |
| LibSQL | @mastra/libsql | Legacy / simple demos |
| PostgreSQL | @mastra/pg | Mid-size production |

**Note:** External exporters handle their own storage. ClickHouse and other backends are accessed via external platforms (Langfuse, Arize, etc.).

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Logging](./logging.md)
- [Exporters](./exporters.md)
- [Architecture & Configuration](./architecture-configuration.md)
