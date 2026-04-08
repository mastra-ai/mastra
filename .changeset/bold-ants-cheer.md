---
'@mastra/memory': patch
---

Fixed reflection threshold not respecting per-record overrides set via the PATCH API. Previously, lowering the reflection threshold for a specific record had no effect on the actual reflection trigger — only the default 40k threshold was used. Now per-record overrides are correctly applied in both sync and async reflection paths.
