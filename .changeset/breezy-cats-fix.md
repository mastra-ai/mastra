---
'@mastra/core': minor
---

Added `RAG_INGESTION` to the `EntityType` enum and wired `startRagIngestion` / `getEntityTypeForSpan` to use it, so rag ingestion runs are discoverable alongside agents, workflows, and scorers.

Added `traceId` to the traces filter schema so traces can be looked up by the root span's trace id when listing.

Added a `runtimeTracingStrategy` getter on `ObservabilityStorage` (base class). Single-strategy stores resolve it automatically from `supported`; multi-strategy stores can override it to expose the active mode.
