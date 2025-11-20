---
'@mastra/core': patch
---

Fix message list provider metadata handling and reasoning text optimization

- Improved provider metadata preservation across message transformations
- Optimized reasoning text storage to avoid duplication (using `details` instead of `reasoning` field)
- Fixed test snapshots for timestamp precision and metadata handling
