---
'@mastra/core': patch
---

Fixed tool output normalization across model-message ingestion, client hooks, and loop callbacks. Client `onOutput` and `toModelOutput` hooks now receive sole-key legacy `{ value }` results unwrapped while preserving sibling metadata and unknown `{ type, value }` domain objects. Stored `error-text` and `error-json` tool-invocation results no longer fire `onOutput`.
