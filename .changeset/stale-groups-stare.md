---
'@mastra/core': minor
---

Added `CostGuardProcessor`, a built-in processor for limiting cumulative token usage and estimated cost across agent runs. Supports run, resource, and thread scopes, with either blocking or warning when configured limits are reached. Includes `maxCost` for price-based guardrails and an `onViolation` callback for custom alerting.
