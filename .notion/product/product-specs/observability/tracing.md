# Tracing

Captures the causal structure and timing of executions in Mastra applications.

---

## Overview

Traces capture the causal structure and timing of executions. Mastra automatically instruments agent runs, workflow steps, tool calls, and model generations as hierarchical spans. Traces answer: *"How did it flow? What was slow? What called what?"*

---

## Core Concepts

### Trace

A trace represents a complete execution flow, containing multiple spans arranged in a parent-child hierarchy.

```typescript
interface Trace {
  id: string;
  projectId: string;
  buildId?: string;
  name: string;
  sessionId?: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'running' | 'success' | 'error';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  totalTokens?: number;
  totalCost?: number;
  tags?: string[];
  createdAt: Date;
}
```

### Span

A span represents a single unit of work within a trace.

```typescript
interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  projectId: string;
  name: string;
  type: SpanType;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'success' | 'error';
  level: 'debug' | 'info' | 'warn' | 'error';
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  toolName?: string;
  createdAt: Date;
}
```

---

## Span Types

Mastra supports 16+ span types for comprehensive instrumentation:

| Type | Description |
|------|-------------|
| `AGENT_RUN` | Agent execution |
| `MODEL_GENERATION` | LLM model call |
| `TOOL_CALL` | Tool invocation |
| `llm` | LLM operations |
| `tool` | Tool operations |
| `retrieval` | RAG retrieval |
| `embedding` | Embedding generation |
| `agent` | Agent operations |
| `workflow` | Workflow execution |
| `memory` | Memory operations |
| `custom` | Custom spans |

---

## Token Usage Tracking

Mastra tracks detailed token usage across multiple dimensions:

- Input tokens
- Output tokens
- Cached tokens
- Audio tokens
- Image tokens
- Reasoning tokens

---

## Span Attributes

### Standard Attributes

| Attribute | Description |
|-----------|-------------|
| `traceId` | Unique trace identifier |
| `spanId` | Unique span identifier |
| `parentSpanId` | Parent span for hierarchy |
| `startTime` | Span start timestamp |
| `endTime` | Span end timestamp |
| `duration` | Calculated duration |
| `status` | running/success/error |

### LLM-Specific Attributes

| Attribute | Description |
|-----------|-------------|
| `model` | Model name/identifier |
| `promptTokens` | Input token count |
| `completionTokens` | Output token count |
| `cost` | Calculated cost (if available) |

### Error Attributes

| Attribute | Description |
|-----------|-------------|
| `error.domain` | Error classification |
| `error.category` | Error category |
| `error.details` | Detailed error information |

---

## Data Masking

Control what data is captured in traces:

- `hideInput` - Exclude input from trace
- `hideOutput` - Exclude output from trace

---

## Sampling

Mastra supports multiple sampling strategies:

| Strategy | Description |
|----------|-------------|
| `Always` | Capture all traces |
| `Never` | Capture no traces |
| `Ratio` | Capture a percentage of traces |
| `Custom` | Custom sampling logic |

---

## Session Tracking

Traces can be grouped by session for multi-turn conversation tracking:

- `sessionId` - Groups traces from the same user session
- `threadId` - Thread-based grouping via memory system

**Current Gap:** Session replay UI is not yet implemented.

---

## User Tracking

User context can be attached to traces:

- `userId` - User identifier
- `resourceId` - Resource identifier

**Current Gap:** User-level analytics are not yet available.

---

## Distributed Tracing

Mastra supports distributed tracing via trace ID propagation:

- Trace IDs flow across service boundaries
- Parent-child relationships maintained
- Compatible with OpenTelemetry context propagation

---

## Comparison with Langfuse

| Feature | Mastra | Langfuse |
|---------|--------|----------|
| Trace/Span Hierarchy | Full | Full |
| Span Types | 16+ types | Similar |
| Token Usage Tracking | Detailed | Detailed |
| Cost Tracking | Token counts only | Cost calculation with model pricing |
| Latency Tracking | Start/end times, duration | Same |
| Input/Output Capture | With serialization controls | Same |
| Metadata & Tags | Custom metadata, tags | Same |
| Error Tracking | Domain, category, details | Similar |
| Session Tracking | Thread-based only | Dedicated sessionId with replay |
| User Tracking | Via resourceId/userId in context | Dedicated userId with analytics |
| Agent Graph Visualization | No | Yes |
| Data Masking | hideInput/hideOutput | Similar |
| Sampling | Always/Never/Ratio/Custom | Similar |

---

## Storage

Traces are stored via the observability storage domain. Supported backends:

- **LibSQL** - Local development
- **PostgreSQL** - Production (OLTP)
- **ClickHouse** - High-volume analytics (OLAP)

### ClickHouse Schema

```sql
CREATE TABLE traces (
  id String,
  project_id String,
  build_id Nullable(String),
  name String,
  session_id Nullable(String),
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  duration Nullable(UInt64),
  status Enum8('running' = 1, 'success' = 2, 'error' = 3),
  input Nullable(String),
  output Nullable(String),
  total_tokens Nullable(UInt64),
  total_cost Nullable(Float64),
  tags Array(String),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, start_time, id)
TTL start_time + INTERVAL 90 DAY;

CREATE TABLE spans (
  id String,
  trace_id String,
  parent_span_id Nullable(String),
  project_id String,
  name String,
  type Enum8('llm'=1, 'tool'=2, 'retrieval'=3, 'embedding'=4, 'agent'=5, 'workflow'=6, 'memory'=7, 'custom'=8),
  start_time DateTime64(3),
  end_time Nullable(DateTime64(3)),
  status Enum8('running' = 1, 'success' = 2, 'error' = 3),
  level Enum8('debug' = 1, 'info' = 2, 'warn' = 3, 'error' = 4),
  model Nullable(String),
  prompt_tokens Nullable(UInt64),
  completion_tokens Nullable(UInt64),
  cost Nullable(Float64),
  created_at DateTime64(3) DEFAULT now64(3)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(start_time)
ORDER BY (project_id, trace_id, start_time, id)
TTL start_time + INTERVAL 90 DAY;
```

---

## Related Documents

- [Observability](./README.md) (parent)
- [Metrics](./metrics.md)
- [Logging](./logging.md)
- [Exporters](./exporters.md)
- [Architecture & Configuration](./architecture-configuration.md)
