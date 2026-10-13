---
'@mastra/core': patch
---

Fixed multi-step Anthropic tool loops dropping each later step's thinking block when thinking display is omitted (empty reasoning text). Reasoning cache keys now include the Anthropic signature or redactedData, so distinct thinking blocks are no longer deduplicated as identical during message merging and the model keeps its reasoning between tool steps. Fixes #25516
