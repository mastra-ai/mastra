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
│                         TRACE SOURCES                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────┐     ┌──────────────────────────────┐  │
│  │    Agent.generate()      │     │    Workflow.start()          │  │
│  │    Agent.stream()        │     │    Workflow.stream()         │  │
│  └──────────────┬───────────┘     └──────────────┬───────────────┘  │
│                 │                                │                  │
│                 │  auto-creates spans            │                  │
│                 │  with context                  │                  │
│                 └────────────┬───────────────────┘                  │
│                              ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    TracingContext                            │   │
│  │         { currentSpan, createChildSpan(), traceId }          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Signal Processors  │  (SensitiveDataFilter, etc.)
                    └──────────┬──────────┘
                               │
                               ▼
                    Exporters (that support traces)
```

→ See [Architecture & Configuration](./architecture-configuration.md) for configuration, sampling, and exporter setup

---

## Span Processors

Span processors transform, filter, or enrich spans before export. They run once and affect all exporters. Span processing is part of the unified Signal Processor system that works across traces, logs, and metrics.

→ See [Architecture & Configuration - Signal Processors](./architecture-configuration.md#signal-processors) for the unified processor model

### Built-in Processors

- **SensitiveDataFilter** - Redacts passwords, tokens, API keys

### Custom Span Processor Example

```typescript
class LowercaseInputProcessor implements SignalProcessor {
  name = "lowercase-processor";

  processSpan(span: AnySpan): AnySpan {
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

## Scores

Scores attach quality signals to traces or individual spans. They flow through the observability pipeline alongside other tracing events, enabling exporters to handle them appropriately.

### Event Types

```typescript
export enum TracingEventType {
  SPAN_STARTED = 'span_started',
  SPAN_UPDATED = 'span_updated',
  SPAN_ENDED = 'span_ended',
  SCORE_ADDED = 'score_added',
  FEEDBACK_ADDED = 'feedback_added',
}
```

### SCORE_ADDED — Evaluation Scores

Automated scores from running evaluations on traces or spans.

```typescript
interface ScoreEventPayload {
  traceId: string;
  spanId?: string;           // Optional - trace-level OR span-level
  scorerName: string;        // e.g., 'relevance', 'hallucination', 'factuality'
  score: number;             // Numeric value within defined range
  range: { min: number; max: number };  // Score range for this scorer
  reason?: string;           // Explanation from scorer
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
```

**Usage:**

```typescript
// Trace-level score (0-1 normalized)
observability.emitScore({
  traceId: "abc123",
  scorerName: "overall_quality",
  score: 0.85,
  range: { min: 0, max: 1 },
  reason: "Response was relevant and well-structured",
});

// Span-level score (percentage scale)
observability.emitScore({
  traceId: "abc123",
  spanId: "def456",
  scorerName: "factuality",
  score: 92,
  range: { min: 0, max: 100 },
  reason: "92% of claims verified against sources",
});
```

### FEEDBACK_ADDED — User Feedback

Feedback from end users or human annotators.

```typescript
interface FeedbackEventPayload {
  traceId: string;
  spanId?: string;           // Optional - trace-level OR span-level
  source: 'USER' | 'ANNOTATION';
  feedbackType: 'thumbs' | 'rating' | 'comment';
  value: number | string;    // Numeric for thumbs/rating, text for comment
  range?: { min: number; max: number };  // Required for numeric feedback
  comment?: string;          // Optional additional context
  userId?: string;           // Who submitted the feedback
  metadata?: Record<string, unknown>;
  timestamp: Date;
}
```

**Usage:**

```typescript
// Thumbs up/down
mastra.submitFeedback({
  traceId: "abc123",
  source: 'USER',
  feedbackType: "thumbs",
  value: 1,
  range: { min: -1, max: 1 },
  userId: "user_456",
});

// Star rating (1-5)
mastra.submitFeedback({
  traceId: "abc123",
  source: 'USER',
  feedbackType: "rating",
  value: 4,
  range: { min: 1, max: 5 },
  comment: "Good but could be more concise",
  userId: "user_456",
});

// 10-point rating
mastra.submitFeedback({
  traceId: "abc123",
  source: 'USER',
  feedbackType: "rating",
  value: 8,
  range: { min: 1, max: 10 },
  userId: "user_456",
});

// Annotation (text comment - no range needed)
mastra.submitFeedback({
  traceId: "abc123",
  spanId: "def456",
  source: 'ANNOTATION',
  feedbackType: "comment",
  value: "This response contains outdated pricing information",
  userId: "reviewer_789",
});
```

**Feedback types:**
- **Thumbs up/down** — Binary quality signal (range: -1 to 1)
- **Star ratings** — Granular quality (range: 1-5, 1-10, etc.)
- **Comments** — Qualitative feedback (text, no range)
- **Implicit signals** — Copy action, retry, time on page (future)

### Pipeline Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  ┌──────────────────────────┐     ┌──────────────────────────────┐  │
│  │     Eval Scorers         │     │   User / Annotator Feedback  │  │
│  │     (automated)          │     │   (client SDK, review UI)    │  │
│  └──────────┬───────────────┘     └──────────────┬───────────────┘  │
│             │                                    │                  │
│             ▼                                    ▼                  │
│  ┌──────────────────────┐          ┌──────────────────────────┐    │
│  │  ScoreEventPayload   │          │  FeedbackEventPayload    │    │
│  │  { traceId, spanId?, │          │  { traceId, spanId?,     │    │
│  │    scorerName, score,│          │    source, feedbackType, │    │
│  │    reason }          │          │    value, comment }      │    │
│  └──────────┬───────────┘          └──────────────┬───────────┘    │
│             │                                     │                 │
│             ▼                                     ▼                 │
│        SCORE_ADDED                         FEEDBACK_ADDED          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                         TracingBus
                               │
                               ▼
                    Exporters (that support scores/feedback)
```

### Exporter Handling

Exporters receive both event types and handle them separately:

```typescript
async exportTracingEvent(event: TracingEvent): Promise<void> {
  switch (event.type) {
    case TracingEventType.SCORE_ADDED:
      await this.handleScore(event.score);
      break;
    case TracingEventType.FEEDBACK_ADDED:
      await this.handleFeedback(event.feedback);
      break;
    // ... other event types
  }
}
```

**Exporter support:**

| Exporter | Scores | Feedback | Notes |
|----------|:------:|:--------:|-------|
| DefaultExporter | ✓ | ✓ | Persists to storage for Studio |
| CloudExporter | ✓ | ✓ | Sends to Mastra Cloud |
| LangfuseExporter | ✓ | ✓ | Maps to Langfuse scores |
| BraintrustExporter | ✓ | ✓ | Maps to Braintrust scores |
| LangSmithExporter | ✓ | ✓ | Maps to LangSmith feedback |
| OtelExporter | ✗ | ✗ | OTLP has no score concept |
| PinoExporter | ✗ | ✗ | Log-only exporter |

### Analytics

Scores enable:
- Correlation between automated scores and user satisfaction
- Identification of traces needing review
- Quality trends over time by agent/workflow/model
- A/B testing of prompts or models
- Regression detection across deployments

→ See [Plan Analysis](./plan-analysis.md) for competitive comparison with Langfuse score handling

---

## Inline Logs in Trace UI (Future)

**Status:** Planned

Display logs as events within their related spans in the tracing UI. Since logs are auto-correlated with `traceId` and `spanId`, they can be rendered inline as timestamped events within the span timeline.

### Benefits

- **Context preservation** — See logs alongside the span that produced them
- **Seamless navigation** — Moving from logs to traces (or vice versa) maintains full context
- **Debugging workflow** — No need to copy trace IDs and search separately

### Concept

```
┌─ AGENT_RUN (support-agent) ────────────────────────────────┐
│  ├─ MODEL_GENERATION (gpt-4) ──────────────────────────────┤
│  │    📝 LOG [info] "Processing user query..."             │
│  │    📝 LOG [debug] "Token count: 1,523"                  │
│  │                                                         │
│  ├─ TOOL_CALL (search) ────────────────────────────────────┤
│  │    📝 LOG [info] "Searching for: pricing plans"         │
│  │    📝 LOG [warn] "Rate limit approaching"               │
│  │                                                         │
│  └─ MODEL_GENERATION (gpt-4) ──────────────────────────────┤
│       📝 LOG [info] "Generating response..."               │
└────────────────────────────────────────────────────────────┘
```

→ See [Logging](./logging.md) for log correlation details

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Logging](./logging.md)
- [Exporters](./exporters.md)
- [Architecture & Configuration](./architecture-configuration.md)
