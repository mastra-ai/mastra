---
'@mastra/e2b': patch
---

Fixed `getInstructions()` to report sandbox-level facts only (working directory, provider type) instead of counting all mount entries regardless of state. Added `instructions` option to override auto-generated instructions.
