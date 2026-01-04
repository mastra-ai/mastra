---
"@mastra/core": patch
---

Added test assertion to verify that enum structured outputs are correctly constrained at generation time (not only validated downstream).
See packages/core/src/loop/test-utils/streamObject.ts for details.
