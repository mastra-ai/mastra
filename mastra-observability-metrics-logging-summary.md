# Mastra Observability — Metrics & Logging Summary (Chat History Consolidation)

> **Status:** Working notes / design summary based on our conversation threads so far  
> **Scope:** How Mastra should approach _metrics_ and _logging_ as extensions to the existing tracing system.  
> **Audience:** Mastra maintainers + contributors (engineering design / spec groundwork)

---

## 1) Context: Where Mastra is today

Mastra already has an observability system built primarily around **tracing**:

- You produce traces composed of **spans**.
- You export spans to various storage backends / observability providers.
- You’ve learned the hard way that **high-volume telemetry** (hundreds/thousands of spans per minute) can overwhelm storage providers not designed for it.

You’ve been intentionally cautious about which storage providers you support for observability, even if you support them for other data / app storage use-cases.

---

## 2) Why add metrics + logging now?

You want Mastra to evolve from “tracing-only observability” to a fuller platform:

- **Tracing**: _what happened and where_ (causal structure, spans, timing)
- **Metrics**: _how much and how often_ (aggregates over time, counters/histograms)
- **Logging**: _what the system said_ (high-signal, human-readable events, errors)

But: you want to avoid building a platform that:

- explodes storage costs,
- becomes difficult to query across backends,
- is hard to test, evolve, or keep consistent.

---

## 3) Compatibility & Standards: metric types you’re converging on

### 3.1 “Modern standard” metric types

Your instinct is right: the “standard stable core” used across many ecosystems is:

- **Counter**
- **Gauge**
- **Histogram**

These map well to OpenTelemetry and Prometheus mental models.

### 3.2 Histograms should be included from day one

You initially considered skipping histograms, then revised that:

- Histograms are _the most complex_ but also _the most valuable_ for latency, token counts, queue times, etc.
- If Mastra does not support histograms early, you risk:
  - painting yourself into a corner,
  - forcing awkward “log-based metrics” workarounds,
  - accumulating tech debt where latency becomes “just logs.”

**Conclusion:** include histogram support in your initial design/spec.

### 3.3 UpDownCounter: what it is and why it matters

We discussed the concept of **UpDownCounter**:

- It’s like a counter, except it can **increment and decrement**
- Example use case: tracking “active items” (active requests, active agents, in-flight tools, etc.)

Potential Mastra/LLM-specific use cases:

- active workflow executions
- active tool invocations
- in-progress spans/steps
- number of queued tasks
- concurrent agent workers

You also asked about `.reset()`:

- In general, counters (including UpDownCounter) do **not** have reset semantics in normal systems.
- Resetting creates confusion and can break monitoring assumptions.
- If you “miss a -1”, resets don’t solve the deeper problem (event delivery / lifecycle tracking).

### 3.4 Multi-writer concerns

You flagged a key design concern:

> “What if multiple different parts of the system write to a single gauge/counter? That seems not ideal.”

This is a _very good_ instinct.

**Problem:** metrics are global and additive by nature, but your system has many actors:

- many workflows
- many agent instances
- many nodes / processes
- many tool calls

So to prevent chaos:

- metrics must be designed so they’re **safe under concurrency**
- and properly segmented using **labels/tags/attributes**

---

## 4) Query language & storage provider goals

### 4.1 Desired portability

You described a very specific product direction:

> You want a “generator solution” where many backends can be supported:
>
> - libsql for local installs
> - Postgres for mid-size
> - ClickHouse for large/cloud/distributed

And ideally you want to avoid giving up established industry patterns just to satisfy “libsql without docker” constraints.

### 4.2 Query language challenge

You want the “same QL” across multiple backends, if possible:

- SQL counts as a QL for you.
- PromQL is highly desirable (especially for Grafana).
- InfluxQL exists but is less compelling in 2026 for new designs unless required.

**Tension:** PromQL is hard to support unless you pick a Prometheus-compatible storage layer or implement a compatibility engine.

---

## 5) Storage provider safety: why some DBs shouldn’t handle observability

You’re wary about supporting observability on arbitrary DBs:

- Some stores are great for app data, but **not for high volume telemetry ingestion**.
- Telemetry has unique traits:
  - bursty writes
  - heavy cardinality
  - high retention needs
  - read patterns: “scan & aggregate”

### Example: Convex

You asked whether adding observability support to **Convex** is a good or bad idea.

Your current mental model:

- Mastra supports Convex for storage (app data)
- but not for observability
- because you don’t want users to accidentally overload it with spans

This becomes a general principle for metrics/logging too:

- observability ingestion should _not_ be enabled on backends that can’t cope with telemetry volume.

---

## 6) Logging: what it should mean in Mastra

You want **logging** to exist alongside tracing + metrics, but without turning into:

- infinite unstructured text ingestion,
- expensive indexing,
- noisy/low-signal output.

### Practical definition

**Mastra logging** should likely mean:

- structured events (JSON) tied to spans/workflows
- log levels (debug/info/warn/error)
- optional sampling
- linkable into traces (“logs as span events”)

### Relationship to traces

A clean strategy is:

- “Logs are events attached to spans” (span events)
- and optionally exported to a separate log pipeline

That gives you:

- correlation by trace/span IDs
- a natural place to store “what happened” without bloating spans

---

## 7) Metrics for the LLM / agent world (examples)

The Mastra domain makes certain metrics unusually important:

### 7.1 Volume / throughput metrics

- workflow runs started / completed
- agent steps executed
- tool calls per workflow
- number of spans emitted per run

### 7.2 Latency histograms

- workflow end-to-end duration
- step execution duration
- tool latency
- model call latency
- queue delay time

### 7.3 Cost / budget metrics

- prompt tokens
- completion tokens
- total tokens
- estimated cost (USD)
- retries per request

### 7.4 Reliability metrics

- error rate
- timeout rate
- tool failure rate
- model failure / invalid output rate

### 7.5 Concurrency metrics (UpDownCounter candidates)

- active workflows
- active steps
- in-flight tool calls
- active model requests

---

## 8) Data model principles for metrics/logging

### 8.1 Attributes/labels must be first-class

To make metrics useful and avoid “multi-writer chaos”:

- a metric isn’t uniquely identified by name alone
- it’s identified by: `name + attributes`

Attributes you’ll probably want:

- workflow name
- step name
- tool name
- model provider / model name
- environment (dev/staging/prod)
- app/service name
- instance ID / process ID
- user/org (careful with cardinality!)

### 8.2 Cardinality management is a product requirement

Telemetry systems die by label cardinality.

So Mastra needs:

- recommended attribute keys
- guardrails against accidental high-cardinality attributes (e.g., raw user IDs)
- potentially “attribute allow-list / deny-list”
- sampling strategies

---

## 9) Testing problem: why this matters to metrics/logging too

You previously described trace testing pain:

- tests break because span shapes change (extra spans appear)
- you end up with long `except()` chains
- hard to see the full trace shape

You were leaning toward a **record/replay** or snapshot-style approach:

- export trace output as JSON/YAML
- compare to expected “TraceSpec” definition
- fail if there are extra or missing spans

This same lesson applies to **metrics and logs**:

- you’ll want tests for expected metrics/log events emitted by a workflow
- you need “shape-based” expectations (not fragile exact byte matches)
- you probably need:
  - ordering-insensitive comparisons
  - allowlist/denylist of fields
  - stable normalization (timestamps, ids)

---

## 10) Suggested design direction (high level)

### 10.1 Build a unified “Telemetry API” in Mastra

A single mental model for:

- trace spans
- log events
- metric points

**But** preserve backend-specific exporters.

### 10.2 Instrumentation should be simple

A dev should be able to write:

- `trace(...)`
- `log.info(...)`
- `metrics.counter(...).add(1)`
- `metrics.histogram(...).record(value)`

### 10.3 Exporting: pick “safe defaults”

For local:

- libsql for persistence is great,
- but might require _aggregation strategies_ so it doesn’t explode in size.

For cloud/large:

- ClickHouse becomes attractive for raw event storage + analytics
- OTLP-compatible backend support would be ideal

---

## 11) Open questions to answer in the spec

### 11.1 What is the minimum viable metric set?

- standard system metrics?
- LLM-specific metrics?
- do we provide “built-in dashboards”?

### 11.2 Do we store raw metric events or aggregated series?

- raw: flexible but expensive
- aggregated: smaller but less flexible

### 11.3 How do we define metric identity?

- name + attributes
- do we enforce a naming convention?
- do we namespace metrics per workflow/package?

### 11.4 How do we integrate with Grafana?

- PromQL support?
- “Grafana via SQL” patterns (ClickHouse/PG)
- OTLP → Grafana Alloy → Mimir/Loki/Tempo pipeline?

### 11.5 Logging retention & indexing

- do we index everything?
- do we store logs as trace span events only?
- do we allow full-text search?

---

## 12) Summary: the main principles you’re converging on

- **Tracing alone is not enough**; metrics/logging fill essential gaps.
- **Counter/Gauge/Histogram** is the correct core set; include histogram early.
- **UpDownCounter** is useful for concurrency tracking but must be used carefully.
- **Storage backends must be chosen based on ingestion safety**, not only convenience.
- **Cardinality and sampling** must be treated as first-class product design problems.
- **Testing must improve** using shape-based specs/snapshots; apply the same thinking to metrics/logging.

---

## Appendix A — Quick glossary

- **Counter:** monotonic “only goes up” metric (requests_total)
- **Gauge:** point-in-time value (memory usage)
- **Histogram:** distribution metric (latency buckets)
- **UpDownCounter:** counter that can go up and down (active jobs)
- **Cardinality:** how many unique label combinations exist for a metric
- **PromQL:** Prometheus query language used heavily in Grafana
- **OTLP:** OpenTelemetry protocol for exporting telemetry
- **Span event:** structured event attached to a trace span (log-like)

---

## Appendix B — Concrete examples (future spec content)

### Counter example

- `mastra.workflow.runs_total{workflow="support_agent", env="prod"}`

### Histogram example

- `mastra.tool.latency_ms{tool="web_search", env="prod"}`

### UpDownCounter example

- `mastra.workflow.active{workflow="support_agent", env="prod"}`

### Log event example (span event)

```json
{
  "ts": "2026-01-26T12:34:56Z",
  "level": "warn",
  "message": "Tool call took longer than expected",
  "traceId": "abc...",
  "spanId": "def...",
  "attributes": {
    "tool": "http_request",
    "latency_ms": 9832
  }
}
```

---

_End of summary._
