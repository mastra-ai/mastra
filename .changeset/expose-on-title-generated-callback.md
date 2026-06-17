---
"@mastra/core": patch
---

Add `onTitleGenerated` callback to the `generateTitle` config. Called once after the generated title is written to storage, enabling use cases like pushing SSE events to clients without wrapping or subclassing a storage adapter.
