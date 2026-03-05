# Metrics

Aggregate health and trend data for Mastra applications.

---

## Overview

Metrics provide aggregate health and trend data. Counters track totals (requests, errors, tokens), histograms capture distributions (latency, token counts). Metrics answer: *"Is something wrong? How bad? Where?"*

---

## Metrics Architecture

Mastra uses a **hybrid approach** for metrics:

1. **Auto-extracted from traces** - Built-in metrics are automatically extracted from span lifecycle events
2. **Direct API** - Custom metrics can be emitted via context-aware or direct APIs

```
┌─────────────────────────────────────────────────────────────────────┐
│                        METRIC SOURCES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────┐         ┌──────────────────────────────┐  │
│  │   Span Lifecycle     │         │   Context-Aware Metrics API  │  │
│  │   Events             │         │   context.metrics.counter()  │  │
│  │   (start, end)       │         │   mastra.metrics.counter()   │  │
│  └──────────┬───────────┘         └──────────────┬───────────────┘  │
│             │                                    │                  │
│             │ extract built-in                   │ emit custom      │
│             │ metrics + auto-labels              │ + auto-labels    │
│             ▼                                    ▼                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              Metric Events (unified format)                  │   │
│  │         { name, type, value, labels, timestamp }             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    Exporters (that support metrics)
```

### Why Hybrid?

- **Metrics outlive traces** - Traces have short retention (10 days), metrics can be kept longer (90 days aggregated)
- **Built-in metrics are free** - No instrumentation needed for standard metrics
- **Custom metrics for business logic** - Direct API for metrics that don't map to traces

---

## Metrics API

### ObservabilityContext API (Inside Tools/Workflows)

Metrics methods are flattened directly on the observability context. Auto-captures labels from trace context (tool, agent, workflow, env):

```typescript
execute: async (input, { observability }) => {
  // Auto-labels: { tool: 'search', agent: 'support', env: 'prod' }
  observability.counter('my_custom_counter').add(1, {
    custom_label: 'foo'  // User adds only custom labels
  });

  observability.histogram('my_latency_ms').record(elapsed, {
    operation: 'fetch'
  });
}
```

**With destructuring:**

```typescript
execute: async (input, { observability: obs }) => {
  obs.counter('items_processed').add(1);
  obs.histogram('processing_time_ms').record(elapsed);
}
```

### Direct API (Outside Trace Context)

For background jobs, startup metrics, or other non-trace scenarios:

```typescript
mastra.metrics.counter('background_jobs_total').add(1, { job_type: 'cleanup' });
mastra.metrics.gauge('queue_depth').set(42, { queue: 'high_priority' });
```

---

## Metric Types

Mastra supports the modern standard metric types used across OpenTelemetry and Prometheus ecosystems:

### Counter

Monotonic "only goes up" metric for totals and rates.

**Examples:**
- `mastra_workflow_runs_started{workflow="support_agent", env="prod"}`
- `mastra_workflow_runs_ended{workflow="support_agent", status="ok", env="prod"}`
- `mastra_errors_total`

### Gauge

Point-in-time absolute value for current state.

**Examples:**
- `mastra_active_runs`
- `mastra_queue_depth`
- `mastra_inflight_tool_calls`

### Histogram

Distribution metric for latency, sizes, and token distributions.

**Examples:**
- `mastra.tool.latency_ms{tool="web_search", env="prod"}`
- `mastra_tool_duration_ms`
- `mastra_llm_latency_ms`
- `mastra_tokens_in` / `mastra_tokens_out` distributions

---

## Built-in Metrics Catalog

These metrics are automatically extracted from span lifecycle events when observability is enabled.

### Workflow Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_workflow_runs_started` | Counter | workflow, env | Span start |
| `mastra_workflow_runs_ended` | Counter | workflow, status, env | Span end |
| `mastra_workflow_duration_ms` | Histogram | workflow, status, env | Span end |
| `mastra_workflow_errors_total` | Counter | workflow, error_type, env | Error |

### Agent Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_agent_runs_started` | Counter | agent, env | Span start |
| `mastra_agent_runs_ended` | Counter | agent, status, env | Span end |
| `mastra_agent_duration_ms` | Histogram | agent, env | Span end |
| `mastra_agent_errors_total` | Counter | agent, error_type, env | Error |

### Tool Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_tool_calls_started` | Counter | tool, agent, env | Span start |
| `mastra_tool_calls_ended` | Counter | tool, agent, status, env | Span end |
| `mastra_tool_duration_ms` | Histogram | tool, agent, env | Span end |
| `mastra_tool_errors_total` | Counter | tool, agent, error_type | Error |

### Model/LLM Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_model_requests_started` | Counter | model, agent | Span start |
| `mastra_model_requests_ended` | Counter | model, agent, status | Span end |
| `mastra_model_duration_ms` | Histogram | model, agent | Span end |
| `mastra_model_input_tokens` | Counter | model, agent, type | Span end |
| `mastra_model_output_tokens` | Counter | model, agent, type | Span end |

**Token type labels:**
- Input: `text`, `cache_read`, `cache_write`, `audio`, `image`
- Output: `text`, `reasoning`, `audio`, `image`

### Processor Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_processor_calls_started` | Counter | processor, env | Span start |
| `mastra_processor_calls_ended` | Counter | processor, status, env | Span end |
| `mastra_processor_duration_ms` | Histogram | processor, env | Span end |
| `mastra_processor_errors_total` | Counter | processor, error_type, env | Error |

### Score & Feedback Metrics

| Metric | Type | Labels | Extracted On |
|--------|------|--------|--------------|
| `mastra_scores_total` | Counter | scorer, agent, workflow, env | Score added |
| `mastra_score_value` | Histogram | scorer, agent, workflow, env | Score added |
| `mastra_feedback_total` | Counter | feedback_type, source, agent, workflow, env | Feedback added |
| `mastra_feedback_value` | Histogram | feedback_type, source, agent, workflow, env | Feedback added (numeric only) |

**Range-based bucketing:**

Scores and feedback include a `range` field that defines the expected min/max. Histogram buckets are generated dynamically based on this range:

| Range | Generated Buckets |
|-------|-------------------|
| 0-1 (normalized) | `[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]` |
| 0-100 (percentage) | `[10, 20, 30, 40, 50, 60, 70, 80, 90, 100]` |
| 1-5 (star rating) | `[1, 2, 3, 4, 5]` |
| -1 to 1 (thumbs) | `[-1, 0, 1]` |
| 1-10 (10-point) | `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` |

**Notes:**
- Buckets are derived from the `range` field in score/feedback events
- Scores/feedback with the same `scorer`/`feedbackType` should use consistent ranges
- Text-only feedback increments `mastra_feedback_total` but not the histogram

---

## Naming Conventions

**Pattern:** `mastra_{domain}_{metric}_{unit}`

**Suffixes:**

| Type | Suffix | Example |
|------|--------|---------|
| Counter (started) | `_started` | `mastra_workflow_runs_started` |
| Counter (ended) | `_ended` | `mastra_workflow_runs_ended` |
| Counter (generic) | `_total` | `mastra_errors_total` |
| Duration | `_ms` | `mastra_tool_duration_ms` |
| Bytes | `_bytes` | `mastra_response_size_bytes` |
| Tokens | `_tokens` | `mastra_model_input_tokens` |

**Labels:** snake_case throughout

**OTLP export:** Convert `_` to `.` (e.g., `mastra_workflow_runs_started` → `mastra.workflow.runs.started`)

---

## LLM/Agent-Specific Metrics

The Mastra domain makes certain metrics unusually important:

### Volume / Throughput Metrics

- Workflow runs started / completed
- Agent steps executed
- Tool calls per workflow
- Number of spans emitted per run

### Latency Histograms

- Workflow end-to-end duration
- Step execution duration
- Tool latency
- Model call latency
- Queue delay time

### Cost / Budget Metrics

- Prompt tokens
- Completion tokens
- Total tokens
- Estimated cost (USD)
- Retries per request

→ See [Cost Tracking](#cost-tracking) for implementation details

### Reliability Metrics

- Error rate
- Timeout rate
- Tool failure rate
- Model failure / invalid output rate

### Concurrency Metrics

- Active workflows
- Active steps
- In-flight tool calls
- Active model requests

---

## Attributes / Labels

To make metrics useful and avoid "multi-writer chaos":
- A metric isn't uniquely identified by name alone
- It's identified by: `name + attributes`

### Recommended Attributes

- `workflow` - workflow name
- `step` - step name
- `tool` - tool name
- `model` - model provider / model name
- `status` - success/error status
- `env` - environment (dev/staging/prod)
- `service` - app/service name

### Cardinality Controls

Telemetry systems die by label cardinality. Mastra enforces guardrails on metric labels only (logs and traces can have these fields in metadata).

**Blocked label keys (rejected):**
- `trace_id`, `span_id`, `run_id`, `request_id`, `user_id`
- Free-form strings, UUIDs

**Allowed labels (bounded cardinality):**
- `workflow`, `agent`, `step`, `tool`, `model`, `status`, `env`, `service`

**Rejection behavior:**
- First occurrence: Reject + log warning
- Subsequent: Reject silently (no log spam)

**Override config:**
```typescript
metrics: {
  // ⚠️ Use with caution - high cardinality degrades query performance
  allowedLabels: ['user_id'],
}
```

**Guardrails:**
- Denylist of blocked keys (hard reject)
- UUID pattern detection (reject)
- Runtime cardinality monitoring (warn at threshold)
- Value length cap (128 chars)

**Note:** Step labels in workflow mapping operations may need special handling to avoid cardinality explosion.

---

## Histogram Design

### Histogram Datapoint Payload

A histogram time slice includes:
- `count`
- `sum`
- `buckets` (distribution)

This aligns well with both Prometheus and OTel.

### Bucket Representation

Mastra uses **explicit bucket boundaries** for histograms:

- Easy to understand
- Easy to merge and roll up
- Maps well to Prometheus

### Default Bucket Sets

**Duration (ms) — 12 buckets:**
```
[10, 50, 100, 500, 1000, 5000, 15000, 60000, 300000, 900000, 3600000, +Inf]
```
Or readable: `[10ms, 50ms, 100ms, 500ms, 1s, 5s, 15s, 1min, 5min, 15min, 1hr, +Inf]`

Covers AI workloads: fast tools (10-100ms), quick responses (100ms-1s), model calls (1-15s), agent runs (15s-5min), long workflows (5min-1hr).

**Tokens (12 buckets, 4x jumps, future-proofed for large context windows):**
```
[128, 512, 2048, 8192, 32768, 131072, 524288, 2097152, 8388608, 33554432, 134217728, +Inf]
```
Or in readable form: `[128, 512, 2K, 8K, 32K, 128K, 512K, 2M, 8M, 32M, 128M, +Inf]`

Covers small completions through 128M+ token contexts (future models).

**Bytes — 12 buckets:**
```
[256, 1024, 4096, 16384, 65536, 262144, 1048576, 4194304, 16777216, 67108864, 268435456, +Inf]
```
Or readable: `[256B, 1KB, 4KB, 16KB, 64KB, 256KB, 1MB, 4MB, 16MB, 64MB, 256MB, +Inf]`

Covers small tool responses up to large file attachments/PDFs.

### Merge Rules

Given identical bucket boundaries:
- `count = sum of counts`
- `sum = sum of sums`
- `bucket[i] = sum of bucket[i]`

If boundaries differ:
- Reject, or
- Down-convert into a canonical bucket set (recommended per metric name)

---

## Concurrency Tracking

Real-world deployments need visibility into concurrent load—concurrent users chatting with agents, parallel requests being processed, tools executing in parallel.

→ See [User Anecdotes](./user-anecdotes.md) for specific user requirements

### Why Not UpDownCounter?

An UpDownCounter can increment and decrement, but has a critical flaw: if a process crashes before emitting `-1`, the counter drifts upward forever.

### Started + Ended Counters

Instead, Mastra uses paired counters:
- `mastra_{entity}_runs_started` - Incremented when span starts
- `mastra_{entity}_runs_ended` - Incremented when span ends (with status label)

**Why this is robust:**
- Multi-writer safe (counters are additive)
- Crash-safe (unfinished work remains unfinished, which is true)
- No reliance on symmetric +1/-1 inside one process lifetime

### Example Queries

**Current active runs:**
```promql
mastra_agent_runs_started - mastra_agent_runs_ended
```

**Concurrent tool calls:**
```promql
mastra_tool_calls_started - mastra_tool_calls_ended
```

**Peak concurrency over time window:**
```promql
max_over_time((mastra_agent_runs_started - mastra_agent_runs_ended)[1h])
```

These metrics integrate with external alerting systems to catch capacity issues before user impact.

→ See [Alerting](#alerting) for alert configuration guidance

---

## Multi-Writer Considerations

| Type | Multi-Writer Safe? | Notes |
|------|-------------------|-------|
| **Counters** | ✓ Yes | Additive by design |
| **Histograms** | ✓ Yes | If bucket schema matches |
| **Gauges** | ✗ No | "Last write wins" chaos |

**Gauge ownership:** If multiple components need to report the same gauge, add a `component` label and aggregate in query:
```
sum(mastra_inflight_runs{workflow="X"}) by (workflow)
```

---

## Cost Tracking

Cost tracking derives monetary values from token counts combined with model pricing.

### Model Pricing Configuration

```typescript
interface ModelPricing {
  modelId: string;           // e.g., 'gpt-4', 'claude-3-opus'
  provider: string;          // e.g., 'openai', 'anthropic'
  inputPricePerMillion: number;   // USD per 1M input tokens
  outputPricePerMillion: number;  // USD per 1M output tokens
  // Optional: tiered pricing for high-volume
  tiers?: {
    threshold: number;       // Token threshold
    inputPrice: number;
    outputPrice: number;
  }[];
}
```

### Cost Calculation

Cost is calculated at query time from token usage captured in `MODEL_GENERATION` spans:

```
cost = (inputTokens × inputPrice / 1_000_000) + (outputTokens × outputPrice / 1_000_000)
```

**Approach:** Query-time calculation with cached pricing tables. This allows price corrections and updates without re-processing historical data.

### Built-in Pricing

Mastra includes default pricing for common models (OpenAI, Anthropic, Google, etc.) that is periodically updated.

### Cost Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `mastra_model_cost_usd` | Counter | model, agent | Cumulative cost in USD |

**Note:** Cost can also be computed from existing token metrics at query time using Grafana/Prometheus recording rules.

→ See [Plan Analysis](./plan-analysis.md) for competitive comparison with Langfuse cost tracking

---

## Alerting

Mastra exports metrics to observability backends; **alerting is configured in those backends** rather than in Mastra itself. For the first iteration, Mastra will not implement any alerting functionality—we rely entirely on third-party systems.

This approach:
- Leverages mature alerting infrastructure (Grafana, Datadog, PagerDuty)
- Avoids reinventing alert routing, escalation, silencing
- Allows teams to use their existing on-call workflows

### Recommended Setup

1. **Export metrics** via GrafanaCloudExporter, DatadogExporter, or OtelExporter
2. **Configure alert rules** in your observability platform
3. **Route alerts** to PagerDuty, OpsGenie, Slack, email, etc.

### Example Alert Rules

**High error rate:**
```yaml
# Grafana alert rule
alert: MastraHighErrorRate
expr: rate(mastra_agent_errors_total[5m]) / rate(mastra_agent_runs_ended[5m]) > 0.05
for: 5m
labels:
  severity: warning
annotations:
  summary: "Agent error rate above 5%"
```

**Capacity warning:**
```yaml
alert: MastraHighConcurrency
expr: (mastra_agent_runs_started - mastra_agent_runs_ended) > 100
for: 2m
labels:
  severity: warning
annotations:
  summary: "More than 100 concurrent agent runs"
```

**Latency degradation:**
```yaml
alert: MastraSlowAgentRuns
expr: histogram_quantile(0.95, rate(mastra_agent_duration_ms_bucket[5m])) > 30000
for: 5m
labels:
  severity: warning
annotations:
  summary: "p95 agent latency above 30 seconds"
```

### External Alerting Platforms

| Platform | Integration |
|----------|-------------|
| Grafana Cloud | GrafanaCloudExporter → built-in alerting |
| Datadog | DatadogExporter → Monitors |
| PagerDuty | Via Grafana/Datadog alert routing |
| OpsGenie | Via Grafana/Datadog alert routing |
| Slack | Via Grafana/Datadog notifications |

→ See [Exporters](./exporters.md) for exporter configuration

---

## Related Documents

- [Observability](./README.md) (parent)
- [Tracing](./tracing.md)
- [Logging](./logging.md)
- [Architecture & Configuration](./architecture-configuration.md)
- [Plan Analysis](./plan-analysis.md) - Competitive analysis and feature gaps
- [User Anecdotes](./user-anecdotes.md) - User feedback on observability needs
