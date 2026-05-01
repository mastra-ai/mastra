---
'@mastra/core': minor
---

Added `CostGuardProcessor`, a built-in processor for enforcing monetary cost limits across agent runs. Supports run, resource, and thread scopes with configurable time windows (default 7 days), blocking or warning when limits are reached. Also added `onViolation` callback to the base `Processor` interface for generalized violation handling across all processors.
