---
'@mastra/e2b': minor
---

Fixed `getInstructions()` to report sandbox-level facts only (working directory, provider type) instead of counting all mount entries regardless of state. Added `instructions` option to `E2BSandbox` to override or extend default instructions.
