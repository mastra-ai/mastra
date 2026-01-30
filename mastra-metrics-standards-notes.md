# Mastra Observability – Metrics Standards Notes (Graphite vs Prometheus vs OpenTelemetry vs Grafana)

_(Conversation capture: metric types, histograms, gauges, counters, UpDownCounter, and multi-writer concerns)_

## Executive summary

For Mastra’s future metrics/logging platform (integrated with the existing tracing system), the **most future-proof metric type set** is:

- **Counter**
- **Gauge**
- **Histogram**

(Optionally later: **UpDownCounter**, Summary)

In practice, **Counters + Gauges + Histograms** cover almost everything you want for LLM/agent systems, with **histograms** being the most design-impactful type because they drive storage schema, aggregation rules, temporality, and query semantics.

---

## Metric type standards: Graphite vs Prometheus vs OpenTelemetry (OTel)

### High-level comparison

| Ecosystem              | Main model                                  | Types                                                               | Labels/Dimensions?                     | Query style        |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- | ------------------ |
| **Graphite (classic)** | hierarchical metric names                   | mostly “numeric samples” (types are conventions)                    | not first-class (encoded in name/path) | Graphite functions |
| **Prometheus**         | time series by `(name + labels)`            | Counter, Gauge, Histogram, Summary                                  | yes (core)                             | PromQL             |
| **OpenTelemetry**      | instruments export datapoints w/ attributes | Counter, UpDownCounter, Gauge, Histogram (incl exponential options) | yes (attributes)                       | depends on backend |

---

## Graphite (classic)

### Mental model

Metric names are hierarchical paths, e.g.:

- `servers.web01.cpu.user`
- `servers.web01.cpu.system`

“Dimensions” (host/region/route/etc.) are typically baked into the name.

### Metric “types”

Graphite itself mainly stores **time-stamped numeric values**.
“Counter vs gauge” is usually a convention imposed by:

- the emitter
- statsd conventions
- dashboard assumptions

### Aggregation style

Graphite pipelines typically include:

- **statsd flush intervals**
- Graphite retention + rollups (`storage-schemas.conf`, `storage-aggregation.conf`)

Graphite is often:

- **pre-aggregated per interval**
- then downsampled for long-term storage

### Strengths

- Simple ingestion and storage shape
- Great for low-cardinality / host-metrics era
- Built-in downsampling story

### Weaknesses

- Hard to represent modern “slice/dice” app metrics cleanly
- Dimensions encoded in names are awkward to evolve
- No strong standard semantics for counters/histograms

---

## Prometheus

### Mental model

A metric is many time series:

- **metric name**
- **labels** (dimensions)

Example:

```
http_requests_total{service="api", route="/users", method="GET", status="200"}
```

### Standard metric types

1. **Counter**

- monotonic increasing
- resets on restart
- example: `http_requests_total`

2. **Gauge**

- arbitrary up/down
- example: `memory_usage_bytes`

3. **Histogram**

- distribution as:
  - `_bucket{le="..."}`
  - `_count`
  - `_sum`
- supports quantiles via `histogram_quantile()`

4. **Summary**

- client-side quantiles + count/sum
- **not mergeable across instances** (quantiles aren’t aggregatable)

**Trend:** prefer histograms over summaries in distributed systems.

### Strengths

- PromQL + ecosystem is excellent
- Clear semantics for counters/histograms
- Strong dashboard/alerting ecosystem

### Weaknesses

- Label cardinality can explode storage and cost
- Scrape model can be awkward in serverless / short-lived tasks
- Summary is a distributed footgun

---

## OpenTelemetry Metrics (OTel)

### What OTel “is”

OTel is **not a database**: it’s a spec + SDK + OTLP export model.

It defines:

- instruments
- datapoints
- attributes (dimensions)
- aggregation temporality

### Instrument types (relevant ones)

- **Counter**
- **UpDownCounter**
- **Gauge**
- **Histogram** (explicit buckets; optionally exponential)

### The critical concept: temporality

OTel supports:

- **Delta**: change since last export
- **Cumulative**: total since process start

This choice matters for:

- storage design
- rollups
- rate calculations
- idempotency

**Design recommendation (common):**

- SDK exports **delta per flush interval**
- ingestion can accept cumulative and convert → delta
- storage uses a canonical temporality consistently

### Strengths

- vendor-neutral instrumentation
- great for push pipelines (OTLP)
- best fit for correlating traces + logs + metrics

### Weaknesses

- backend behavior differs (OTel is not “one system”)
- histogram conversion/temporality handling can be tricky

---

## “Grafana land” differences

### Key idea

Grafana is primarily:

- a **UI and query frontend**
- not the metric “type standard” owner

Your “standards” depend on the **backend** Grafana connects to:

- **Prometheus/Mimir** → Prometheus types + PromQL
- **InfluxDB** → tags/fields + InfluxQL/Flux
- **Graphite** → metric paths + Graphite functions
- **SQL sources** (Postgres/ClickHouse/etc.) → SQL queries shaped into time series

### Grafana’s “native stack”

The common Grafana cloud / OSS “LGTM” style is:

- **Mimir** = metrics (Prometheus-compatible)
- **Loki** = logs
- **Tempo** = traces
- Grafana UI on top

So in practice, Grafana-world expectations for metrics are heavily **Prometheus-like**.

### Mastra implication

If you want to be Grafana-friendly:

- use Prometheus-like naming + types
- support OTLP export for interoperability
- consider exemplars for trace correlation later

---

## Core Mastra metric types: Counter, Gauge, Histogram

### Counter (monotonic)

Use for totals and rates:

- `mastra_tool_calls_total`
- `mastra_llm_requests_total`
- `mastra_errors_total`

### Gauge (absolute value)

Use for current state:

- `mastra_active_runs`
- `mastra_queue_depth`
- `mastra_inflight_tool_calls`

### Histogram (distribution)

Use for latency/size/tokens distributions:

- `mastra_tool_duration_ms`
- `mastra_llm_latency_ms`
- `mastra_tokens_in` / `mastra_tokens_out` distributions (optional)

**Histograms** are the most design-impactful because they require:

- merge rules
- consistent bucket schemas
- bigger storage footprint per time series

---

## Why histograms should be part of initial design thinking

Even if you do not ship them first, the **schema and query model** should reserve space for them.

Histograms influence:

- data model (count/sum/buckets)
- bucket schema constraints
- temporality normalization
- storage layout choices (arrays vs normalized bucket rows)
- query requirements (quantiles, averages, rates)

---

## Histogram design plan (recommended)

### Histogram datapoint payload

A histogram time slice should include:

- `count`
- `sum`
- `buckets` (distribution)

This aligns well with both Prometheus and OTel.

### Bucket representation options

**Option A (recommended v1): explicit bucket boundaries**

- bounds: `[5, 10, 25, 50, 100, 250, 500, 1000, +Inf]` (example in ms)
- counts per bucket

Pros:

- easy to understand
- easy to merge and roll up
- maps well to Prometheus

Cons:

- bucket choice matters (standardize it)

**Option B: exponential histogram / sketch**
Pros:

- compact
- dynamic range

Cons:

- harder to implement/query
- less universally supported across backends

**Spec suggestion:** support explicit buckets first, reserve for exponential later.

### Temporality choice

Strong recommendation:

- Normalize internally to one canonical temporality (commonly **delta per interval** for efficient writes).
- Accept other formats (cumulative) but convert at ingestion.

### Merge rules

Given identical bucket boundaries:

- `count = Σ count`
- `sum = Σ sum`
- `bucket[i] = Σ bucket[i]`

If boundaries differ:

- reject, or
- down-convert into a canonical bucket set (recommended per metric name)

### Cardinality controls (even stricter for histograms)

Histograms are expensive, so:

- allowlist dimension keys per metric name
- cap bucket count (e.g., 20–40)
- cap unique time series per tenant per time window

### Recommended default bucket sets

Latency (ms):

- `[1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, +Inf]`

Tokens:

- `[16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, +Inf]`

Bytes:

- `[256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, +Inf]`

---

## UpDownCounter: what it is, and when it helps

### What is an UpDownCounter?

An **UpDownCounter** is like a counter that can go up **and down** via positive/negative deltas.

- Counter: monotonic (+ only)
- UpDownCounter: can apply + and - deltas
- Gauge: absolute “set value”

### Where it can be useful in Mastra / LLM systems

Primarily for concurrency / inflight tracking via start/end events:

- `+1` when a run starts
- `-1` when a run ends

Examples:

- active LLM generations
- inflight tool calls
- inflight workflow runs
- open streaming responses
- “slots used” / capacity consumption

### Do UpDownCounters have reset()?

**No**, in standard models (Prometheus/OTel), there is no reset concept.

Resetting breaks aggregation semantics and is not reliable in distributed systems.

If you need “reset-to-truth”, use a **Gauge**.

---

## Failure mode: process crash → missed “-1” deltas

A classic risk:

- you emit `+1`
- process crashes before `-1`
- inflight drift upward forever (or becomes misleading)

### Better patterns than UpDownCounter for inflight

#### Pattern 1: Started + Finished counters (recommended)

Emit two monotonic counters:

- `mastra_runs_started_total`
- `mastra_runs_finished_total{status="ok|error|canceled|timeout"}`

Then derive:

- `inflight = started - finished`

Why it’s robust:

- multi-writer safe
- crash-safe (unfinished work remains unfinished, which is true)
- no reliance on symmetric +1/-1 inside one process lifetime

#### Pattern 2: Gauge computed from truth (recommended)

Maintain actual local state (e.g., a map of active runs) and export:

- `mastra_runs_inflight` (gauge) = `active.size`

If the process crashes, its series disappears naturally.

#### Pattern 3: Coordinator leases/heartbeats with TTL

If you have a control plane:

- create a lease with `expires_at`
- refresh while running
- inflight is derived from active leases

---

## Multi-writer problems: “many parts of the system write one gauge/counter”

This is a key distributed system concern.

### Gauges: multi-writer is usually **bad**

A gauge is absolute. If multiple components call `set()` on the same series, you get “last write wins” chaos.

**Avoid “global shared gauges”** written by multiple components.

Solutions:

- enforce single-writer ownership per series, or
- add a label like `component` and aggregate in query

Example:

- Good:
  - `mastra_inflight_runs{workflow="X", component="worker"}`
  - `mastra_inflight_runs{workflow="X", component="scheduler"}`
  - then sum in query

### Counters: multi-writer is **fine**

Counters are additive by design, so multiple writers are safe.

This is why “started_total / finished_total” is often the best base signal.

### Histograms: multi-writer is **fine with constraints**

Histograms merge well when:

- bucket schema matches
- label set is controlled

---

## Practical Mastra recommendations (from this discussion)

### Adopt a simple, standard metric type set

- Counter
- Gauge
- Histogram
  (+ optionally UpDownCounter, but carefully)

### Guardrails for cardinality (critical)

Ban by default:

- `trace_id`, `span_id`, `run_id`, `request_id`, `user_id`
- free-form strings as labels

Prefer:

- small, stable dimensions like:
  - `workflow`, `agent`, `step`, `tool`, `model`, `status`, `env`, `service`

### For inflight/concurrency metrics

Best options:

1. counters (`started_total` / `finished_total`) + derived inflight
2. per-instance gauge computed from truth
3. coordinator lease model for accuracy

### For histograms

Define early:

- canonical bucket schema per metric name
- merge rules
- temporality normalization policy
- storage layout plan (provider-specific physical schemas)

---

## Suggested “spec language” snippets (copy/paste ready)

### Gauges must be owned

> Gauges MUST have a single authoritative writer per `(metric name + attribute set)` time series. Distributed “global truth” values MUST be expressed as per-instance gauges and aggregated at query time, or computed centrally by a designated control-plane component.

### Counters and histograms are mergeable

> Counters and histograms MAY be emitted by multiple components for the same time series. Aggregation is performed by summation across writers.

### Histogram schema control

> Histogram metrics MUST define a canonical bucket schema per metric name. Ingestion MUST reject or normalize incompatible bucket layouts to ensure histograms remain mergeable across instances and time rollups.

---

## Next steps (if you want to extend this into the Mastra design doc)

- Define a canonical **MetricPoint** schema (counter/gauge/histogram)
- Decide internal temporality (delta vs cumulative) and normalization rules
- Define provider contracts:
  - `MetricStore.write(points)`
  - `MetricStore.query_range(...)`
- Draft a “Mastra standard metrics catalog” for LLM/agent systems
