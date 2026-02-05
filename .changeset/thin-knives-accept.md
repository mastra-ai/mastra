---
'@mastra/core': minor
---

Added a unified observability type system with interfaces for structured logging, metrics (counters, gauges, histograms), scores, and feedback alongside the existing tracing infrastructure.

**Why?** Previously, only tracing flowed through execution contexts. Logging was ad-hoc and metrics did not exist. This change establishes the type system and context plumbing so that when concrete implementations land, logging and metrics will flow through execute callbacks automatically — no migration needed.

**What changed:**

- New `ObservabilityContext` interface combining tracing, logging, and metrics contexts
- New type definitions for `LoggerContext`, `MetricsContext`, `ScoreInput`, `FeedbackInput`, and `ObservabilityEventBus`
- `createObservabilityContext()` factory and `resolveObservabilityContext()` resolver with no-op defaults for graceful degradation
- Migrated 60+ internal forwarding sites from `TracingContext` to `ObservabilityContext` so future signals propagate without additional changes
- Added `loggerVNext` and `metrics` getters to the `Mastra` class
