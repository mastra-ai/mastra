---
'@mastra/editor': patch
---

Fixed editor-owned agent instructions failing silently. Agents configured with `editor: { instructions: true }` now throw a clear error instead of running with empty instructions when no published version is available in Studio. This affected agents that were never provisioned, only had a draft version, were deleted, or hit a storage error while loading. Fixes https://github.com/mastra-ai/mastra/issues/21373
