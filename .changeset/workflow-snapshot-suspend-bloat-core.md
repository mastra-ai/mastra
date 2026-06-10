---
'@mastra/core': patch
---

Reduced workflow snapshot bloat when tool approval suspends with large tool payloads.

When tool approval is enabled, every approval cycle suspends the agent loop and persists a stream-state snapshot. The serialized state now keeps per-step message deltas instead of cumulative `request`/`response` per buffered step, and replaces large tool-result payloads in step content with references to the message-list copy that get rehydrated on resume. Snapshots written by older versions still resume.

Fixes [#17738](https://github.com/mastra-ai/mastra/issues/17738).
