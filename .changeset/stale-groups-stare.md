---
'@mastra/core': minor
---

Added CostGuardProcessor — a new built-in processor that monitors cumulative token usage and estimated cost across the agentic loop. Supports per-run, per-resource, and per-thread scoping with block or warn strategies. Uses processInputStep to check limits before each LLM call. For resource and thread scopes, queries the observability storage APIs (getMetricAggregate) to retrieve cumulative usage and cost data across runs. Includes maxCost limit for price-based guardrails and onViolation callback for custom alerting.
