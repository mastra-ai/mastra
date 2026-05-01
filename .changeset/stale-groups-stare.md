---
'@mastra/core': minor
---

Added CostGuardProcessor — a new built-in processor that monitors cumulative token usage and step count across the agentic loop. Supports per-run, per-resource, and per-thread scoping with block or warn strategies. Uses processInputStep to check limits before each LLM call and processOutputStep to persist cross-run usage via the Mastra server cache.
