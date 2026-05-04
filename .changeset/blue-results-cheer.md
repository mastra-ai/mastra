---
'@mastra/convex': patch
---

Fixed @mastra/convex `persistWorkflowSnapshot` failing when a workflow snapshot contained `$`-prefixed keys (e.g. `$schema`, `$ref`, `$defs`, `$id` from serialized Zod-to-JSON-Schema fragments embedded in tool outputs). Convex reserves field names starting with `$`, which caused every agent run with at least one Zod-schema tool to crash on the first persisted turn of the internal `agentic-loop` workflow with: `ArgumentValidationError: Object contains extra field $schema that is not in the validator`. The snapshot is now serialized with `JSON.stringify` before insert, symmetric with the existing `loadWorkflowSnapshot` path that already accepts string-encoded snapshots. Fixes #16110.
