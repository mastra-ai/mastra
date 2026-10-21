---
'@mastra/core': patch
---

Fixed `generate()`, `resumeStream()`, and `resumeGenerate()` to reject invalid `modelSettings.timeout` values with the same `TypeError`. Durable and evented agents now validate caller settings and static defaults before cold recovery executes. A rejected resume leaves the suspended run available for a retry with corrected settings.
