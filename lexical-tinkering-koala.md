# Mastra Metrics & Logging Design Discussion

**Status:** Exploratory discussion phase - working through design decisions topic by topic

**Initial inputs:** `mastra-observability-metrics-logging-summary.md` (ChatGPT discussion notes)

**Decisions made:**

- Metric types: Counter, Gauge, Histogram (no UpDownCounter initially)
- Logging: Separate storage with auto-correlation
- For inflight/concurrency: Use started/finished counters pattern instead of UpDownCounter
- Temporality: Delta per interval for storage (normalize cumulative on ingestion)
- Cardinality: Denylist + UUID detection + runtime warnings (see 5.2)
- Storage model: Raw events with tiered retention, CLI-based aggregation
- Storage backends: LibSQL, PostgreSQL, ClickHouse (skip MongoDB/MSSQL initially)
- Future: Consider deprecating LibSQL/PostgreSQL for observability; document better alternatives
- Naming: Prometheus-style internally (`mastra_workflow_runs_total`), convert for OTLP export
- Retention: Per-signal with defaults (traces 14d, metrics raw 7d, aggregated 90d, logs 7d)
- Auto-instrumentation: Automatic when enabled, with override options
- Phasing: All metric types at once, metrics before logging

**Source documents:**

- `mastra-observability-metrics-logging-summary.md` - Overview and use cases
- `mastra-metrics-standards-notes.md` - Metric types, histograms, multi-writer concerns

---

## Current State Understanding

### Existing Observability Architecture

Mastra already has a mature **tracing** system:

**Span Types (18 total):**

- Agent: `AGENT_RUN`
- Model: `MODEL_GENERATION`, `MODEL_STEP`, `MODEL_CHUNK`
- Workflow: `WORKFLOW_RUN`, `WORKFLOW_STEP`, `WORKFLOW_CONDITIONAL`, `WORKFLOW_PARALLEL`, `WORKFLOW_LOOP`, `WORKFLOW_SLEEP`, `WORKFLOW_WAIT_EVENT`
- Tools: `TOOL_CALL`, `MCP_TOOL_CALL`
- Other: `PROCESSOR_RUN`, `GENERIC`

**Key Components:**

- `ObservabilityStorage` - Base class for span persistence (`packages/core/src/storage/domains/observability/`)
- Exporters: `DefaultExporter` (batched to storage), `ConsoleExporter`, `JSONExporter`, `CloudExporter`
- Sampling: ALWAYS, NEVER, RATIO, CUSTOM strategies
- Context propagation via JavaScript Proxies

**Storage Domain Pattern:**

```
packages/core/src/storage/domains/{domain}/
├── base.ts      # Abstract class with interface
├── types.ts     # Zod schemas, request/response types
├── inmemory.ts  # In-memory implementation
└── index.ts     # Exports

stores/{adapter}/src/storage/domains/{domain}/
└── index.ts     # Database-specific implementation
```

---

## Design Decisions to Make

### 1. Metrics Storage Model

**Decision: Raw events with tiered retention**

**Industry validation:** Both Langfuse and Braintrust use raw events:

- Langfuse: "events-based architecture" with aggregation at query time
- Braintrust: Built custom DB (Brainstore) for fast queries on raw data
- Both invested in query infrastructure rather than pre-aggregation

**Mastra approach:**

```
Raw events (days) → Aggregated buckets (long-term)
```

| Tier       | Retention           | Data                     | Use Case                  |
| ---------- | ------------------- | ------------------------ | ------------------------- |
| Raw        | Days (configurable) | Individual metric points | Debugging, ad-hoc queries |
| Aggregated | Months/years        | Time-bucketed rollups    | Dashboards, trends        |

**Aggregation strategy:**

- NOT in Mastra server (stateless, serverless-compatible)
- CLI command: `mastra db aggregate-metrics` (similar to trace cleanup work)
- Or storage-side: ClickHouse materialized views, Postgres pg_cron
- Runs periodically to roll up old raw data into buckets

**Client-side batching:**

- Long-lived processes: Batch in memory (1-10 seconds) before flush
- Serverless: Flush on exit (single batch per invocation)
- Aligns with existing tracing exporter batching pattern

**Serverless vs long-lived:**

- Both emit raw metric points
- Both use delta temporality (change since last flush)
- Batching duration differs, but storage sees same format

### 2. Logging Model

**Decision: Separate log storage with auto-correlation (Option B)**

**Conceptual distinction (Traces vs Logs):**

| Signal     | Primary Purpose                      | Primary Author   | Examples                                                          |
| ---------- | ------------------------------------ | ---------------- | ----------------------------------------------------------------- |
| **Traces** | How code runs through Mastra system  | Mastra internals | Agent runs, workflow steps, tool calls, model generations         |
| **Logs**   | How user's business logic is working | User code        | Tool validation messages, workflow decision points, error context |

Neither is exclusive:

- Users can add custom spans for their own instrumentation
- Mastra system can emit logs for internal events

But the mental model: **traces = execution flow, logs = application messages**

**Why separate storage:**

- Logs can exist without active span (startup, background jobs)
- Separate retention policies (logs often shorter than traces)
- Query logs independently without loading full traces
- Matches industry pattern (Grafana LGTM stack, OpenTelemetry signals)

**Log record schema:**

```typescript
interface LogRecord {
  // Core fields (indexed)
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;

  // Auto-correlation (system-populated from context, indexed)
  traceId?: string;
  spanId?: string;
  entityType?: EntityType; // agent, workflow, tool, processor
  entityId?: string;
  entityName?: string;
  userId?: string;
  organizationId?: string;
  resourceId?: string;
  runId?: string;
  sessionId?: string;
  threadId?: string;
  requestId?: string;
  environment?: string;
  source?: string;
  serviceName?: string;

  // User data (single flexible bag, JSONB)
  data?: Record<string, unknown>;
}
```

**Why single `data` bag (not attributes + metadata):**

- Logs are user-generated (from tools, workflow steps)
- No system-defined "log types" with known attributes
- Correlation fields are the "system" part, `data` is all user content
- Simpler mental model

**Auto-correlation behavior:**

- Logger checks current tracing context
- Captures traceId, spanId, runId, threadId, etc. automatically
- User provides message + optional `data`

**Querying:**

- Filter by indexed fields (level, timestamp, traceId, runId, etc.) = fast
- Filter within `data` = JSONB query, flexible but slower

**Retention:** Configurable, independent from trace retention

**Log levels:** `debug | info | warn | error | fatal`

### 3. Metric Types to Support

**Decision: Counter, Gauge, Histogram** (no UpDownCounter initially)

| Type          | Use Case                                    | Multi-writer safe?             |
| ------------- | ------------------------------------------- | ------------------------------ |
| **Counter**   | Totals and rates (requests, errors, tokens) | ✅ Yes - additive              |
| **Gauge**     | Current state (queue depth, memory)         | ❌ No - needs single owner     |
| **Histogram** | Distributions (latency, token counts)       | ✅ Yes - with matching buckets |

**Why skip UpDownCounter?**

- Failure mode: missed `-1` deltas on crash cause drift
- Better pattern: Use `started_total` + `finished_total` counters, derive inflight
- Example: `inflight = mastra_runs_started_total - mastra_runs_finished_total`

### 3.1 Histogram Design (Critical - Most Design Impactful)

Histograms influence storage schema, aggregation, and query semantics.

**Bucket representation:** Explicit boundaries (v1), reserve for exponential later

```
Latency (ms): [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, +Inf]
Tokens: [16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, +Inf]
```

**Datapoint payload:**

- `count` - number of observations
- `sum` - sum of all values
- `buckets[]` - count per bucket

**Merge rules (same bucket boundaries):**

- `count = Σ count`
- `sum = Σ sum`
- `bucket[i] = Σ bucket[i]`

**Temporality:** Delta per interval (normalize cumulative on ingestion)

### 3.2 Cardinality Guardrails

**BANNED as labels** (cause cardinality explosion):

- `trace_id`, `span_id`, `run_id`, `request_id`, `user_id`
- Free-form strings

**ALLOWED labels** (small, stable dimensions):

- `workflow`, `agent`, `step`, `tool`, `model`, `status`, `env`, `service`

### 4. Storage Backend Support

**Decision: LibSQL, PostgreSQL, ClickHouse for initial implementation**

| Backend    | Tracing | Metrics/Logging | Notes                                    |
| ---------- | ------- | --------------- | ---------------------------------------- |
| LibSQL     | ✅      | ✅              | Local dev, low volume                    |
| PostgreSQL | ✅      | ✅              | Mid-size, with performance caveats       |
| ClickHouse | ✅      | ✅              | Production recommended, best performance |
| MongoDB    | ✅      | ❌ Skip         | Not in initial implementation            |
| MSSQL      | ✅      | ❌ Skip         | Not in initial implementation            |

**PostgreSQL/LibSQL performance caveat:**
Row-based storage is suboptimal for time-series analytics:

- PostgreSQL is ~6x slower than ClickHouse for aggregation queries
- Uses ~20x more disk than ClickHouse
- Acceptable for local dev and low-to-mid volume, but not recommended for production scale

**⚠️ Future deprecation consideration:**
PostgreSQL and LibSQL may be deprecated for observability (tracing, metrics, logging) in a future major version. Users requiring production-grade observability should plan to migrate to ClickHouse or a dedicated time-series backend.

Rationale:

- Maintaining multiple storage backends for observability is costly
- Performance gap is significant enough to impact user experience at scale
- ClickHouse provides a better foundation for future features (histograms, aggregations, retention)

### 4.1 Future Storage Backends to Consider

Backends that could be added for observability in future versions:

| Backend              | Type                 | Consideration                                                                  |
| -------------------- | -------------------- | ------------------------------------------------------------------------------ |
| **DuckDB**           | Embedded OLAP        | Could replace LibSQL for local dev; much better analytics performance          |
| **TimescaleDB**      | PostgreSQL extension | Middle ground between Postgres and ClickHouse; requires extension installation |
| **QuestDB**          | Time-series native   | High-performance time-series DB with SQL interface                             |
| **InfluxDB 3.0**     | Time-series native   | Purpose-built for metrics; InfluxQL/SQL support                                |
| **Prometheus/Mimir** | Metrics native       | Native PromQL support; OTLP export path                                        |

**Not recommended for future consideration:**

- MongoDB: Document-oriented, poor time-series performance
- MSSQL: Row-oriented, licensing costs, not optimized for telemetry
- Convex: Not suited for high-volume telemetry ingestion

### 5. Metric Identity & Naming

**Decision: Prometheus-style internally, convert for OTLP export**

**Internal storage format (Prometheus-style):**

```
mastra_{domain}_{metric}_{unit}

Examples:
mastra_workflow_runs_total
mastra_tool_latency_seconds
mastra_model_tokens_total
mastra_agent_generation_duration_seconds
```

**OTLP export format (dot-separated):**

```
mastra.workflow.runs
mastra.tool.latency
mastra.model.tokens
```

Exporter handles the conversion (drop `_total` suffix, convert underscores to dots).

**Metric identity:**

```
name + labels = unique series

Example:
mastra_workflow_runs_total{workflow="support_agent", env="prod", status="completed"}
```

**Naming conventions:**

- Snake_case throughout
- `_total` suffix for counters
- `_seconds` or `_ms` suffix for durations
- `_bytes` suffix for sizes

### 5.1 Label Guidelines

**Required labels:** None by default (all optional)

**Recommended labels (bounded cardinality):**

- `env` - environment (dev/staging/prod)
- `workflow` - workflow name
- `agent` - agent name
- `tool` - tool name
- `model` - model name (gpt-4o, claude-3-opus, etc.)
- `status` - outcome (success/error/timeout)
- `step` - workflow step name
- `error_type` - error category (not full message)

### 5.2 Cardinality Guards

**Decision: Denylist + UUID detection + runtime warnings**

**Layer 1: Blocked label keys (hard reject)**

```typescript
const BLOCKED_LABEL_KEYS = [
  'trace_id',
  'traceId',
  'span_id',
  'spanId',
  'run_id',
  'runId',
  'request_id',
  'requestId',
  'user_id',
  'userId',
  'session_id',
  'sessionId',
  'thread_id',
  'threadId',
  'message',
  'error_message',
  'errorMessage',
];
```

**Layer 2: Value pattern detection (warn)**

```typescript
// UUID pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Long hex/digit strings (likely IDs)
const LIKELY_ID_PATTERN = /^[0-9a-f]{16,}$/i;
```

**Layer 3: Runtime cardinality monitoring (warn)**

- Track unique label combinations per metric
- Warn when exceeding threshold (e.g., 1,000 unique series)
- Log warning, don't block (user may have legitimate use case)

**Value length:** Cap at 128 characters (truncate with warning)

### 6. Built-in Metrics Catalog

Metrics Mastra should provide automatically (whether derived from traces or explicitly instrumented):

#### Workflow Metrics

| Metric                             | Type      | Labels                    | Description                     |
| ---------------------------------- | --------- | ------------------------- | ------------------------------- |
| `mastra_workflow_runs_total`       | Counter   | workflow, status, env     | Total workflow executions       |
| `mastra_workflow_duration_seconds` | Histogram | workflow, status, env     | Workflow execution time         |
| `mastra_workflow_steps_executed`   | Histogram | workflow, env             | Distribution of steps per run   |
| `mastra_workflow_errors_total`     | Counter   | workflow, error_type, env | Workflow failures by error type |

#### Agent Metrics

| Metric                           | Type      | Labels                 | Description                    |
| -------------------------------- | --------- | ---------------------- | ------------------------------ |
| `mastra_agent_runs_total`        | Counter   | agent, status, env     | Total agent executions         |
| `mastra_agent_duration_seconds`  | Histogram | agent, env             | Agent execution time           |
| `mastra_agent_generations_total` | Counter   | agent, model           | Model generations per agent    |
| `mastra_agent_steps_executed`    | Histogram | agent, env             | Steps/iterations per agent run |
| `mastra_agent_errors_total`      | Counter   | agent, error_type, env | Agent failures by error type   |

#### Tool Metrics

| Metric                         | Type      | Labels                   | Description                 |
| ------------------------------ | --------- | ------------------------ | --------------------------- |
| `mastra_tool_calls_total`      | Counter   | tool, agent, status, env | Total tool invocations      |
| `mastra_tool_duration_seconds` | Histogram | tool, agent, env         | Tool execution time         |
| `mastra_tool_errors_total`     | Counter   | tool, agent, error_type  | Tool failures by error type |

#### Model/LLM Metrics

| Metric                          | Type      | Labels               | Description           |
| ------------------------------- | --------- | -------------------- | --------------------- |
| `mastra_model_requests_total`   | Counter   | model, agent, status | Total model API calls |
| `mastra_model_duration_seconds` | Histogram | model, agent         | Model response time   |
| `mastra_model_input_tokens`     | Counter   | model, agent, type   | Input tokens by type  |
| `mastra_model_output_tokens`    | Counter   | model, agent, type   | Output tokens by type |

**Token type labels** (matching existing tracing schema):

Input types (`mastra_model_input_tokens{type="..."}`):

- `text` - Regular text tokens
- `cache_read` - Tokens served from cache
- `cache_write` - Tokens written to cache (Anthropic)
- `audio` - Audio input tokens
- `image` - Image input tokens (includes PDFs)

Output types (`mastra_model_output_tokens{type="..."}`):

- `text` - Regular text output
- `reasoning` - Reasoning/thinking tokens (o1, Claude thinking)
- `audio` - Audio output tokens
- `image` - Image output tokens (DALL-E)

**Note:** Cost is calculated at query time from token counts + current pricing, not stored as a metric.

#### Processor Metrics

| Metric                              | Type      | Labels                     | Description                      |
| ----------------------------------- | --------- | -------------------------- | -------------------------------- |
| `mastra_processor_calls_total`      | Counter   | processor, status, env     | Total processor invocations      |
| `mastra_processor_duration_seconds` | Histogram | processor, env             | Processor execution time         |
| `mastra_processor_errors_total`     | Counter   | processor, error_type, env | Processor failures by error type |

#### Aggregate Error Metrics

| Metric                | Type    | Labels                       | Description                    |
| --------------------- | ------- | ---------------------------- | ------------------------------ |
| `mastra_errors_total` | Counter | entity_type, error_type, env | All errors across entity types |

#### Future Consideration: Concurrency Metrics

Deferred from initial implementation. If needed later, use started/finished counter pattern:

- `mastra_workflow_started_total` / `mastra_workflow_finished_total`
- Inflight = started - finished (no UpDownCounter needed)

### 7. Grafana Integration

**Primary use case:** Backup/comparison UI during Mastra UI development.

**Approach:** Extend existing exporters to support all three signals, add Grafana Cloud support.

```typescript
// Existing pattern - exporters handle all signals they support
observability: new Observability({
  configs: {
    default: {
      serviceName: 'mastra',
      exporters: [
        new DefaultExporter(), // traces + metrics + logs → storage
        new CloudExporter(), // traces + metrics + logs → Mastra Cloud
        new GrafanaCloudExporter(), // traces + metrics + logs → Grafana Cloud (future)
      ],
    },
  },
});
```

**Grafana Cloud receives:**

- Traces → Tempo (OTLP)
- Metrics → Mimir (OTLP)
- Logs → Loki (OTLP)

**Note:** Exporter architecture is a separate discussion topic. Key principle: each exporter handles all signals it supports, not one exporter per signal type.

### 7.1 Exporter Architecture (To Be Discussed)

Current exporters need updates to support metrics & logging:

| Exporter             | Traces   | Metrics | Logs   | Notes                 |
| -------------------- | -------- | ------- | ------ | --------------------- |
| DefaultExporter      | ✅ Today | 🆕 Add  | 🆕 Add | Persists to storage   |
| CloudExporter        | ✅ Today | 🆕 Add  | 🆕 Add | Sends to Mastra Cloud |
| ConsoleExporter      | ✅ Today | 🆕 Add  | 🆕 Add | Debug output          |
| JSONExporter         | ✅ Today | 🆕 Add  | 🆕 Add | File output           |
| GrafanaCloudExporter | 🆕 New   | 🆕 New  | 🆕 New | OTLP to Grafana stack |

This requires designing:

- Common exporter interface for all three signals
- Signal-specific export methods
- Configuration for which signals each exporter handles

### 8. Retention Policies

**Decision: Per-signal retention with sensible defaults**

| Signal               | Default Retention | Notes                      |
| -------------------- | ----------------- | -------------------------- |
| Traces               | 14 days           | Expensive, debugging focus |
| Metrics (raw)        | 7 days            | High volume, debugging     |
| Metrics (aggregated) | 90 days           | Dashboards, compact        |
| Logs                 | 7 days            | Moderate volume            |

**CLI commands:**

```bash
mastra db cleanup-traces --older-than 14d
mastra db cleanup-metrics --older-than 7d
mastra db aggregate-metrics --older-than 3d
mastra db cleanup-logs --older-than 7d
```

**Configuration override:**

```typescript
observability: new Observability({
  retention: {
    traces: '14d',
    metricsRaw: '7d',
    metricsAggregated: '90d',
    logs: '7d',
  },
});
```

### 9. Auto-Instrumentation

**Decision: Automatic when observability is enabled, with override options**

- Enable observability → automatically get traces + metrics + logs
- Built-in metrics from catalog are emitted without additional config
- **Users can always override or opt-out**

**Override options:**

```typescript
observability: new Observability({
  // Opt-out of specific signals
  signals: {
    traces: true, // default: true
    metrics: true, // default: true
    logs: true, // default: true
  },

  // Log level control
  logging: {
    level: 'info', // debug | info | warn | error | fatal
  },

  // Disable specific built-in metrics
  metrics: {
    disabled: ['mastra_model_input_tokens'], // opt-out of specific metrics
  },
});
```

**User-defined metrics/logs:** Always explicit

```typescript
// User must call these explicitly
mastra.metrics.counter('my_custom_metric').add(1);
mastra.logger.info('My custom log message', { data: foo });
```

**Sampling:** Shares config with traces (can be extended per-signal if needed)

```typescript
observability: new Observability({
  sampling: {
    strategy: 'ratio',
    ratio: 0.1, // 10% sampling
  },
});
```

### 10. Implementation Phasing

**Decision: All metric types at once, metrics before logging**

#### Phase 1: Metrics (Counter + Gauge + Histogram)

- Implement all three metric types together
- Storage domain for metrics
- Built-in metrics catalog
- Exporter updates (DefaultExporter, etc.)
- LibSQL, PostgreSQL, ClickHouse support

#### Phase 2: Logging

- Storage domain for logs
- Logger API with auto-correlation
- Exporter updates for logging
- Same backend support as metrics

#### Phase 3: Enhancements

- Grafana Cloud exporter
- CLI aggregation commands
- Advanced retention management
- Additional exporters as needed

---

## Open Questions for Discussion

### ⚠️ KEY ARCHITECTURAL DECISION: Metrics Source

**Should Mastra have separate metrics, or derive them from traces?**

This is a fundamental decision that affects the entire metrics architecture. Document both options for team discussion:

#### Option A: Separate Metrics Signal (Traditional)

```typescript
// Explicit instrumentation
metrics.counter('mastra_workflow_runs_total').add(1, { workflow: 'foo' });
metrics.histogram('mastra_tool_latency_seconds').record(0.5, { tool: 'bar' });
```

- Separate metrics storage
- Standard metrics patterns (Prometheus/OTel style)
- Works for non-trace scenarios
- More instrumentation code needed
- Duplicate data capture

#### Option B: Derive All Metrics from Traces (Braintrust/Langfuse approach)

```sql
-- Metrics computed at query time from span data
SELECT count(*) as runs_total, avg(duration_ms) as avg_duration
FROM spans WHERE span_type = 'WORKFLOW_RUN'
GROUP BY workflow_name, time_bucket('1 minute', timestamp)
```

- Single source of truth (traces)
- Zero extra instrumentation for system metrics
- Requires good indexing / materialized views for dashboard perf
- Some metrics hard to derive (gauges, custom business metrics)

#### Option C: Hybrid

- Auto-derive system metrics from traces (latency, counts, errors)
- Explicit metrics API for user-defined metrics (gauges, custom counters)
- Best of both worlds, but more complex model

**Industry context:**

- Braintrust/Langfuse: Derive from traces
- Traditional observability (Prometheus): Separate metrics
- OpenTelemetry: Supports both as separate signals

---

### Other Open Questions

~~1. **Storage model**: Raw events vs aggregated vs hybrid?~~ → **Decided: Raw events with tiered retention**
~~2. **Log relationship**: Span events only, or separate storage?~~ → **Decided: Separate storage with auto-correlation**
~~3. **Phasing**: All metric types at once, or start with Counter/Gauge?~~ → **Decided: All types, metrics first**
~~4. **LibSQL support**: Include for local dev, or PostgreSQL minimum?~~ → **Decided: Include LibSQL**
~~5. **Auto-instrumentation**: How much should be automatic vs opt-in?~~ → **Decided: Automatic when enabled**
~~6. **Cardinality guards**: Enforce limits, warn, or trust users?~~ → **Decided: Denylist + detection + warnings**
~~7. **Retention**: Same as traces, or separate retention policies?~~ → **Decided: Per-signal with defaults**
~~8. **Metric naming**: Enforce convention? Required vs optional labels?~~ → **Decided: Prometheus-style, convert for OTLP**
~~9. **Grafana integration**: SQL-based, PromQL translation, OTLP export, or custom plugin?~~ → **Decided: Extend exporters for all signals**
~~10. **Built-in metrics catalog**: Which metrics should Mastra emit automatically?~~ → **Decided: See section 6**

---

## Signal Relationships & Diagnostic Workflows

### The Three Pillars

| Signal      | Purpose                   | Answers                                             |
| ----------- | ------------------------- | --------------------------------------------------- |
| **Metrics** | Aggregate health & trends | "Is something wrong? How bad? Where?"               |
| **Logs**    | Specific events & context | "What happened? What was the input/output?"         |
| **Traces**  | Causal structure & timing | "How did it flow? What was slow? What called what?" |

### Correlation

**Traces ↔ Logs:** Direct correlation via IDs

- Logs have `traceId`, `spanId`, `runId`, `threadId`, `sessionId`
- Click a log entry → jump to the exact trace/span
- Expand a trace span → see attached logs

**Metrics ↔ Traces/Logs:** Correlation via shared dimensions

- Metrics have labels like `agent`, `tool`, `workflow`, `model`, `env`
- No trace/span IDs on metrics (cardinality constraint)
- Navigate by filtering: "Show traces where agent=X and tool=Y"

```
┌─────────────────────────────────────────────────────────────┐
│  METRICS (aggregated)                                       │
│  └── Labels: agent="support", tool="search", env="prod"     │
│      └── Filter traces/logs by these dimensions             │
├─────────────────────────────────────────────────────────────┤
│  LOGS (per-event)                                           │
│  └── traceId, spanId, runId + agent, tool, etc.             │
│      └── Click to navigate to trace                         │
├─────────────────────────────────────────────────────────────┤
│  TRACES (structured)                                        │
│  └── traceId, spanId hierarchy                              │
│      └── Expand spans to see logs                           │
└─────────────────────────────────────────────────────────────┘
```

**Correlation fields by signal:**

| Field      | Metrics    | Logs | Traces         |
| ---------- | ---------- | ---- | -------------- |
| `traceId`  | ❌         | ✅   | ✅             |
| `spanId`   | ❌         | ✅   | ✅             |
| `runId`    | ❌         | ✅   | ✅             |
| `agent`    | ✅ (label) | ✅   | ✅ (attribute) |
| `tool`     | ✅ (label) | ✅   | ✅ (attribute) |
| `workflow` | ✅ (label) | ✅   | ✅ (attribute) |
| `model`    | ✅ (label) | ✅   | ✅ (attribute) |
| `env`      | ✅ (label) | ✅   | ✅ (attribute) |

### Diagnostic Workflows

**Workflow 1: Metrics → Logs → Traces** (Top-down)

1. **Metrics**: Dashboard shows error spike or latency increase
   - "Error rate jumped 20% at 2pm"
   - "p95 latency increased from 500ms to 2s"
2. **Logs**: Filter by time range, find specific errors
   - "Tool 'web_search' failed with timeout"
   - "Input was: {query: '...'}"
3. **Traces**: Click through to full execution trace
   - See exact sequence of calls
   - Identify which step was slow
   - See parent/child relationships

**Workflow 2: Traces → Logs → Metrics** (Bottom-up)

1. **Traces**: User reports slow response, look up specific trace
   - See workflow took 8 seconds
   - Model call took 6 seconds (the culprit)
2. **Logs**: Check logs attached to that span
   - "Large context: 15000 tokens"
   - "Model: gpt-4o-mini"
3. **Metrics**: Check if this is a pattern
   - "Token counts have been high all day"
   - "This model's latency trending up"

**Workflow 3: Cross-signal investigation**

```
Question: "Why are my agent runs slow today?"

1. Metrics (mastra_agent_duration_seconds)
   → Histogram shows p95 went from 2s to 8s
   → Breakdown by agent shows "support_agent" is the problem

2. Metrics (mastra_model_duration_seconds{agent="support_agent"})
   → Model latency is normal
   → Not the model's fault

3. Metrics (mastra_tool_duration_seconds{agent="support_agent"})
   → Tool "database_query" latency spiked
   → Found the root cause

4. Logs (filter: agent="support_agent", tool="database_query")
   → "Query took 5.2s: SELECT * FROM large_table..."
   → Missing index identified

5. Traces (for specific slow request)
   → Full execution shows the query was called 3 times
   → Optimization opportunity
```

### UI Navigation

The observability UI should enable seamless navigation:

| From             | To           | Via                                        |
| ---------------- | ------------ | ------------------------------------------ |
| Metric dashboard | Logs         | Time range + filters (agent, tool, status) |
| Metric dashboard | Traces       | Click "View traces" for time range         |
| Log entry        | Trace        | Click traceId link                         |
| Log entry        | Related logs | Filter by runId/threadId                   |
| Trace span       | Logs         | Expand span to see attached logs           |
| Trace span       | Metrics      | Link to metrics for that span type         |

---

## Proposed Architecture (Revised)

**Principle:** Types in `@mastra/core`, instrumentation in `observability/mastra/`, storage domains in `packages/core/`.

### Types (@mastra/core)

```
packages/core/src/observability/types/
├── index.ts
├── tracing.ts      # Span types, attributes (existing)
├── metrics.ts      # Counter, Gauge, Histogram types (new)
└── logging.ts      # LogRecord, LogLevel types (new)
```

### Instrumentation (observability/mastra)

```
observability/mastra/src/
├── index.ts              # Main exports
├── config.ts             # Config (existing)
├── registry.ts           # Registry (existing)
├── usage.ts              # Usage tracking (existing)
├── model-tracing.ts      # Model tracing (existing)
│
├── exporters/            # All signal exporters (existing + extended)
│   ├── base.ts           # Base exporter class
│   ├── default.ts        # Storage exporter (traces + metrics + logs)
│   ├── cloud.ts          # Mastra Cloud exporter
│   ├── console.ts        # Console exporter
│   ├── json.ts           # JSON file exporter
│   └── index.ts
│
├── spans/                # Tracing (existing)
│   ├── base.ts
│   ├── default.ts
│   └── no-op.ts
│
├── span_processors/      # Span processors (existing)
│   └── sensitive-data-filter.ts
│
├── metrics/              # Metrics instrumentation (new)
│   ├── index.ts
│   ├── registry.ts       # MetricRegistry - manages all metrics
│   └── instruments/
│       ├── counter.ts
│       ├── gauge.ts
│       └── histogram.ts
│
└── logging/              # Logging API (new)
    ├── index.ts
    └── logger.ts         # Logger class with auto-correlation

packages/core/src/storage/domains/
├── observability/        # Trace storage (existing)
│   ├── base.ts
│   ├── types.ts
│   └── inmemory.ts
│
├── metrics/              # Metrics storage (new)
│   ├── base.ts           # MetricsStorage abstract class
│   ├── types.ts          # MetricPoint, aggregation types
│   └── inmemory.ts
│
└── logs/                 # Log storage (new)
    ├── base.ts           # LogsStorage abstract class
    ├── types.ts          # LogRecord storage types
    └── inmemory.ts

stores/{adapter}/src/storage/domains/
├── metrics/              # Per-backend metrics implementation
│   └── index.ts
└── logs/                 # Per-backend logs implementation
    └── index.ts
```

**Key points:**

- Types live in `@mastra/core` (`packages/core/src/observability/types/`)
- Instrumentation/API lives in `observability/mastra/` (tracing, metrics, logging)
- Storage domain base classes stay in `packages/core/src/storage/domains/`
- Backend implementations in `stores/{adapter}/` follow existing pattern
- Other observability packages will also export logging & metrics

### Other Observability Packages

Each package in `observability/` will need metrics & logging support:

```
observability/
├── mastra/         # Core instrumentation (primary)
├── langfuse/       # → add metrics/logs export to Langfuse
├── braintrust/     # → add metrics/logs export to Braintrust
├── datadog/        # → add metrics/logs export to Datadog
├── arize/          # → add metrics/logs export to Arize
├── laminar/        # → add metrics/logs export to Laminar
├── langsmith/      # → add metrics/logs export to LangSmith
├── posthog/        # → add metrics/logs export to PostHog
├── sentry/         # → add metrics/logs export to Sentry
├── otel-bridge/    # → OTLP export for metrics/logs
└── otel-exporter/  # → OTLP export for metrics/logs
```

---

## Next Steps

1. ✅ Design decisions documented (this plan)
2. Write formal design docs for Notion (Metrics, Logging, Tracing)
3. Define type schemas in `@mastra/core`
4. Implement storage domain base classes + in-memory
5. Add LibSQL, PostgreSQL, ClickHouse implementations
6. Implement metrics instrumentation in `observability/mastra`
7. Implement logging API in `observability/mastra`
8. Extend existing exporters to handle metrics/logs
9. Add auto-instrumentation to existing tracing points
10. Update other observability packages
11. Documentation

---

## References

- ChatGPT summary: `mastra-observability-metrics-logging-summary.md`
- Notion docs format: `.claude/docs/notion-document-formats.md`
- Existing observability: `packages/core/src/storage/domains/observability/`
- MastraAdmin design (has ClickHouse observability): Notion
