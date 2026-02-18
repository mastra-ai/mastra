# Mastra Pulse

**Status:** Future Vision / Internal Exploration
**Codename:** Pulse

---

## Overview

Mastra Pulse is an experimental vision for next-generation observability that goes beyond traditional traces, metrics, and logs. Instead of three separate signals, Pulse explores a **unified causal event model** that enables:

- Story reconstruction instead of span trees
- First-class causality links between events
- Proactive issue surfacing (Findings)
- Question-driven investigation

> Observability should feel like understanding, not inspection.

**Current Status:** This is a future exploration. We are building an internal-only exporter to capture data in the Pulse format, enabling us to experiment with these concepts using real-world data from local development.

---

## Core Concepts

### Moments (Unified Event Model)

Instead of separate spans, logs, and metrics, Pulse models everything as **Moments** — typed events with a common envelope:

```typescript
interface Moment {
  id: string;
  t_start: Date;
  t_end?: Date;
  kind: MomentKind;
  subject_ref: SubjectRef;        // What entity this is about
  dims: Record<string, string>;   // env, region, tenant, workflow, release, etc.
  data: MomentData;               // Typed payload based on kind
}

type MomentKind =
  | 'WORK'        // Execution (replaces spans)
  | 'SIGNAL'      // Logs, alerts
  | 'MEASURE'     // Metrics
  | 'CHANGE'      // Deploys, config changes, feature flags
  | 'ANNOTATION'  // Human notes, labels
  | 'DECISION'    // Recorded decision points
  | 'OUTCOME';    // Business outcomes linked to causal chains
```

### Moment Types

**WorkMoment** (replaces spans):
```typescript
interface WorkMoment {
  work_type: 'HTTP' | 'RPC' | 'DB' | 'TOOL' | 'LLM' | 'JOB' | 'IO' | 'LOCK' | 'WORKFLOW' | 'AGENT';
  name: string;
  status: 'ok' | 'error' | 'timeout' | 'cancelled';
  latency_ms: number;
  phases?: PhaseBreakdown[];      // Optional timing breakdown
  error_signature_id?: string;    // For clustering similar errors
  input_ref?: string;             // Reference to stored input
  output_ref?: string;            // Reference to stored output
}
```

**SignalMoment** (logs/alerts):
```typescript
interface SignalMoment {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  template_id?: string;           // For log clustering
  fields: Record<string, unknown>;
  attachments?: AttachmentRef[];
}
```

**MeasureMoment** (metrics):
```typescript
interface MeasureMoment {
  metric_key: string;
  unit: string;
  shape: 'POINT' | 'DISTRIBUTION' | 'RATE' | 'STATE';
  value: number | Distribution;
  exemplar_refs?: string[];       // Links to related WorkMoments
}
```

**ChangeMoment** (deploys, config):
```typescript
interface ChangeMoment {
  change_type: 'deploy' | 'config' | 'feature_flag' | 'schema' | 'infra';
  description: string;
  before_hash?: string;
  after_hash: string;
  rollout_percent?: number;
  actor?: string;
}
```

**DecisionMoment** (recorded choices):
```typescript
interface DecisionMoment {
  decision_type: string;
  options: string[];
  chosen: string;
  reason?: string;
  confidence?: number;
}
```

**OutcomeMoment** (business results):
```typescript
interface OutcomeMoment {
  outcome_type: string;           // 'conversion', 'churn', 'success', 'failure'
  value?: number;
  causal_chain_ref?: string;      // Link to the moments that led here
}
```

---

## Links (First-Class Causality)

Links explicitly model relationships between moments, enabling story reconstruction and causal analysis:

```typescript
interface Link {
  from_moment_id: string;
  to_moment_id: string;
  type: LinkType;
  confidence?: number;            // For inferred links
}

type LinkType =
  | 'CONTAINS'      // Parent-child (like span hierarchy)
  | 'CAUSES'        // Direct causation
  | 'AWAITS'        // Blocked waiting for
  | 'RETRIES'       // Retry of previous attempt
  | 'FALLBACKS'     // Fallback after failure
  | 'ENQUEUES'      // Produced to queue
  | 'DEQUEUES'      // Consumed from queue
  | 'READS'         // Read dependency
  | 'WRITES'        // Write effect
  | 'DERIVES';      // Computed from
```

### Why Links Matter

Traditional tracing only captures CONTAINS (parent-child). With explicit link types:

- **RETRIES** links show retry storms
- **FALLBACKS** links show degraded paths
- **AWAITS** links identify blocking dependencies
- **CAUSES** links enable "why did this happen?" queries

---

## Findings (Proactive Surfacing)

Instead of passive dashboards, Pulse proactively surfaces issues:

```typescript
interface Finding {
  finding_id: string;
  status: 'OPEN' | 'ACKED' | 'MUTED' | 'RESOLVED';
  priority: 'P0' | 'P1' | 'P2' | 'P3';

  // Scope
  time_range: TimeRange;
  subjects: SubjectRef[];
  dims: Record<string, string>;

  // Analysis
  symptoms: Symptom[];            // What's wrong (metric spikes, errors)
  hypotheses: Hypothesis[];       // Ranked suspects
  evidence: MomentRef[];          // Supporting moments/links
  causal_path?: Link[];           // Reconstructed story

  // Action
  recommendations: string[];
  similar_findings?: FindingRef[];
  owner?: string;
}
```

### Detectors

Streaming rules that produce findings:
- Anomaly detection (baseline deviation)
- Error spikes (rate change)
- Deploy correlation (changes near incidents)
- Saturation patterns (resource exhaustion)
- Queue lag (backpressure)
- Novel error signatures (new failure modes)

### Explainers

Build bounded causal subgraphs:
- 1-2 hop traversal from symptoms
- Top contributors by impact
- Change overlap detection
- Exemplar selection

---

## Dream UI Concepts

These UI ideas inform but don't constrain implementation:

### Living System Map
- Services as nodes, dependencies as edges
- Heat/motion/deformation show load/latency/errors
- Zoom: global → service → operation → execution → code

### Time as Scrubbable Dimension
- Timeline scrubbing like video
- Incidents visibly form
- Divergence points highlighted

### Traces Become Stories
- Narrative causal chains instead of span trees
- Decision points visible
- Retries, fallbacks, waits labeled semantically

### Metrics as Forces
- Latency = friction
- Throughput = flow
- Errors = turbulence
- Saturation = pressure

### Question-Driven Investigation
- "Why did EU users get slower after deploy?"
- System highlights relevant services, time windows, causal paths

### AI Co-Pilot
- Anomaly detection
- Likely cause suggestions
- Similar past incidents
- Natural language explanations

---

## Storage Architecture

### ClickHouse as Primary Store

Pulse uses ClickHouse for:
- High-volume moment ingestion
- Dimensional slicing (dims)
- Fast aggregates
- Materialized windows

**Tables:**
- `moments` - All moment types
- `links` - Causality links
- `measure_windows` - Pre-aggregated metrics
- `findings` - Surfaced issues
- `episodes` - Pre-materialized causal subgraphs

### Adjacency Sidecar (Optional)

For <200ms interactive graph expansion:
- Redis/KeyDB/RocksDB
- `moment_id → neighbor_ids[]`
- Hot retention only (recent data)

**Pattern:**
1. Expand neighbors → sidecar
2. Fetch moment details → ClickHouse

### No Graph Database Required

Graph traversal needs are:
- Shallow (1-2 hops)
- Time-bounded
- Often pre-materialized

Full graph DB only needed for deep interactive algorithms.

---

## Internal Experimentation: MomentExporter

To explore this vision with real data, we're building an internal-only exporter.

### Purpose

- Capture Mastra observability data in Pulse format
- Send to shared internal ClickHouse instance
- Enable exploration and prototyping
- Build dataset for future Pulse development

### Architecture: Event-Native

Instead of converting completed spans after the fact, the MomentExporter subscribes directly to observability event buses and creates moments from raw events:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Observability Event Buses                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  TracingBus              MetricsBus              LogsBus            │
│  ┌─────────────┐        ┌─────────────┐        ┌─────────────┐      │
│  │ span.start  │        │ metric.emit │        │ log.emit    │      │
│  │ span.update │        │             │        │             │      │
│  │ span.end    │        │             │        │             │      │
│  └──────┬──────┘        └──────┬──────┘        └──────┬──────┘      │
│         │                      │                      │             │
└─────────┼──────────────────────┼──────────────────────┼─────────────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     MomentExporter      │
                    │  (subscribes to buses)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Shared ClickHouse     │
                    │   (moments + links)     │
                    └─────────────────────────┘
```

### Event → Moment Mapping

| Bus Event | Pulse Moment | Notes |
|-----------|--------------|-------|
| `span.start` | WorkMoment (open) | Creates moment with `t_start`, no `t_end` yet |
| `span.update` | WorkMoment update | Updates attributes, or creates SignalMoment for significant events |
| `span.end` | WorkMoment (close) | Adds `t_end`, `status`, `output`, `latency_ms` |
| `log.emit` | SignalMoment | Direct mapping with level, message, fields |
| `metric.emit` | MeasureMoment | Direct mapping with metric_key, value, shape |

### Link Creation

| Event Pattern | Link Type | Notes |
|---------------|-----------|-------|
| Child span starts | CONTAINS | Parent → child relationship |
| Span with `parentSpanId` | CONTAINS | Explicit hierarchy |
| Same `traceId` | (implicit) | Moments share trace context |

### Usage (Internal Only)

```typescript
import { MomentExporter } from '@mastra/observability-internal';

const mastra = new Mastra({
  observability: new Observability({
    configs: {
      default: {
        exporters: [
          new DefaultExporter(),      // Normal storage
          new MomentExporter({        // Internal: Pulse experimentation
            endpoint: process.env.PULSE_CLICKHOUSE_URL,
          }),
        ],
      },
    },
  }),
});
```

### Benefits of Event-Native Approach

1. **More granular data** - Capture when things started, not just duration
2. **Streaming-friendly** - Moments flow as events occur
3. **Preserves intermediate state** - Span updates become visible
4. **Cleaner mapping** - Events → Moments is natural 1:1
5. **Future-proof** - New event types map directly to new moment kinds

### Future Enrichment

As we add more event types, they map naturally to moments:

| Future Event | Pulse Moment |
|--------------|--------------|
| `deploy.complete` | ChangeMoment |
| `config.update` | ChangeMoment |
| `tool.selected` | DecisionMoment (which tool, why) |
| `agent.complete` | OutcomeMoment (success/failure, value) |

And richer link inference:

| Pattern | Inferred Link |
|---------|---------------|
| Retry span after error | RETRIES |
| Fallback span after failure | FALLBACKS |
| Span starts after queue dequeue | DEQUEUES |
| Long gap between spans | AWAITS (potential) |

### Data Governance

- Internal use only - not for production customer data
- Local development environments only
- Shared ClickHouse for team exploration
- Data retention: experimental, not guaranteed

---

## Relationship to Current Design

Pulse is an evolution, not a replacement. Current Mastra observability (T/M/L) remains the production system.

| Aspect | Current | Pulse (Future) |
|--------|---------|----------------|
| Model | Separate T/M/L signals | Unified Moments |
| Relationships | Parent-child spans only | First-class Links |
| Issue detection | Export to external tools | Built-in Findings |
| Investigation | Dashboard-driven | Question-driven |
| Status | Production | Experimental |

### Migration Path

If Pulse proves valuable:
1. Moment model becomes internal representation
2. T/M/L remain as export formats (OTel compatibility)
3. Links inferred automatically, explicit where available
4. Findings layer added as optional feature

---

## Open Questions

1. **Link inference accuracy** - Can we reliably infer RETRIES, AWAITS, etc. from timing patterns?
2. **Storage cost** - Links multiply data volume; what's the practical overhead?
3. **Query patterns** - What causal queries do users actually need?
4. **Finding quality** - How to avoid alert fatigue with proactive surfacing?
5. **UI investment** - Which dream UI concepts have highest ROI?

---

## Next Steps

1. ✅ Document vision (this page)
2. ⏳ Build MomentExporter (internal)
3. ⏳ Set up shared ClickHouse instance
4. ⏳ Capture data from local dev usage
5. ⏳ Prototype causal queries
6. ⏳ Evaluate Findings feasibility

---

## Related Documents

- [Observability](./README.md) (parent)
- [Architecture & Configuration](./architecture-configuration.md)
- [Tracing](./tracing.md) - Current span model
- [Metrics](./metrics.md) - Current metrics model
- [Logging](./logging.md) - Current logging model
