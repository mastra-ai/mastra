# Metrics

Aggregate health and trend data for Mastra applications.

---

## Overview

Metrics provide aggregate health and trend data. Counters track totals (requests, errors, tokens), histograms capture distributions (latency, token counts). Metrics answer: *"Is something wrong? How bad? Where?"*

---

## Metric Types

Mastra supports the modern standard metric types used across OpenTelemetry and Prometheus ecosystems:

### Counter

Monotonic "only goes up" metric for totals and rates.

**Examples:**
- `mastra.workflow.runs_total{workflow="support_agent", env="prod"}`
- `mastra_tool_calls_total`
- `mastra_llm_requests_total`
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

## UpDownCounter

An UpDownCounter is like a counter that can go up **and down** via positive/negative deltas.

- Counter: monotonic (+ only)
- UpDownCounter: can apply + and - deltas
- Gauge: absolute "set value"

### Use Cases

Primarily for concurrency / inflight tracking via start/end events:
- `+1` when a run starts
- `-1` when a run ends

**Examples:**
- `mastra.workflow.active{workflow="support_agent", env="prod"}`
- Active LLM generations
- Inflight tool calls
- Inflight workflow runs
- Open streaming responses
- "Slots used" / capacity consumption

### Important Notes

- UpDownCounters do **not** have reset semantics in standard models (Prometheus/OTel)
- Resetting breaks aggregation semantics and is not reliable in distributed systems
- If you need "reset-to-truth", use a **Gauge** instead

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

### Reliability Metrics

- Error rate
- Timeout rate
- Tool failure rate
- Model failure / invalid output rate

### Concurrency Metrics (UpDownCounter candidates)

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

Telemetry systems die by label cardinality. Mastra needs:

**Ban by default:**
- `trace_id`, `span_id`, `run_id`, `request_id`, `user_id`
- Free-form strings as labels

**Prefer:**
- Small, stable dimensions like: `workflow`, `agent`, `step`, `tool`, `model`, `status`, `env`, `service`

---

## Histogram Design

### Histogram Datapoint Payload

A histogram time slice includes:
- `count`
- `sum`
- `buckets` (distribution)

This aligns well with both Prometheus and OTel.

### Bucket Representation

**Option A (recommended v1): Explicit bucket boundaries**

Bounds: `[5, 10, 25, 50, 100, 250, 500, 1000, +Inf]` (example in ms)

Pros:
- Easy to understand
- Easy to merge and roll up
- Maps well to Prometheus

Cons:
- Bucket choice matters (standardize it)

**Option B: Exponential histogram / sketch**

Pros:
- Compact
- Dynamic range

Cons:
- Harder to implement/query
- Less universally supported across backends

### Recommended Default Bucket Sets

**Latency (ms):**
```
[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, +Inf]
```

**Tokens:**
```
[16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, +Inf]
```

**Bytes:**
```
[256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, +Inf]
```

### Merge Rules

Given identical bucket boundaries:
- `count = sum of counts`
- `sum = sum of sums`
- `bucket[i] = sum of bucket[i]`

If boundaries differ:
- Reject, or
- Down-convert into a canonical bucket set (recommended per metric name)

---

## Multi-Writer Considerations

### Gauges: Multi-writer is usually bad

A gauge is absolute. If multiple components call `set()` on the same series, you get "last write wins" chaos.

**Avoid "global shared gauges"** written by multiple components.

Solutions:
- Enforce single-writer ownership per series, or
- Add a label like `component` and aggregate in query

**Example:**
```
mastra_inflight_runs{workflow="X", component="worker"}
mastra_inflight_runs{workflow="X", component="scheduler"}
```
Then sum in query.

### Counters: Multi-writer is fine

Counters are additive by design, so multiple writers are safe. This is why "started_total / finished_total" is often the best base signal.

### Histograms: Multi-writer is fine with constraints

Histograms merge well when:
- Bucket schema matches
- Label set is controlled

---

## Better Patterns for Inflight Tracking

### Pattern 1: Started + Finished Counters (recommended)

Emit two monotonic counters:
- `mastra_runs_started_total`
- `mastra_runs_finished_total{status="ok|error|canceled|timeout"}`

Then derive: `inflight = started - finished`

Why it's robust:
- Multi-writer safe
- Crash-safe (unfinished work remains unfinished, which is true)
- No reliance on symmetric +1/-1 inside one process lifetime

### Pattern 2: Gauge Computed from Truth (recommended)

Maintain actual local state (e.g., a map of active runs) and export:
- `mastra_runs_inflight` (gauge) = `active.size`

If the process crashes, its series disappears naturally.

### Pattern 3: Coordinator Leases/Heartbeats with TTL

If you have a control plane:
- Create a lease with `expires_at`
- Refresh while running
- Inflight is derived from active leases

---

## Spec Language

### Gauges Must Be Owned

> Gauges MUST have a single authoritative writer per `(metric name + attribute set)` time series. Distributed "global truth" values MUST be expressed as per-instance gauges and aggregated at query time, or computed centrally by a designated control-plane component.

### Counters and Histograms Are Mergeable

> Counters and histograms MAY be emitted by multiple components for the same time series. Aggregation is performed by summation across writers.

### Histogram Schema Control

> Histogram metrics MUST define a canonical bucket schema per metric name. Ingestion MUST reject or normalize incompatible bucket layouts to ensure histograms remain mergeable across instances and time rollups.

---

## Temporality

OTel supports:
- **Delta**: change since last export
- **Cumulative**: total since process start

**Design recommendation:**
- SDK exports **delta per flush interval**
- Ingestion can accept cumulative and convert to delta
- Storage uses a canonical temporality consistently

---

## Storage Provider Considerations

Metrics should only be stored in backends designed for high-volume telemetry ingestion:
- Bursty writes
- Heavy cardinality
- High retention needs
- Read patterns: "scan & aggregate"

**Recommended:**
- LibSQL for local installs
- PostgreSQL for mid-size
- ClickHouse for large/cloud/distributed

---

## Related Documents

- [Observability](./README.md) (parent)
- [Tracing](./tracing.md)
- [Logging](./logging.md)
- [Architecture & Configuration](./architecture-configuration.md)
