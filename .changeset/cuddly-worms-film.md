---
'@mastra/e2b': minor
---

Fixed `getInstructions()` to report sandbox-level facts only (working directory, provider type) instead of counting all mount entries regardless of state. Added `instructions` option to override or extend auto-generated instructions — pass a string to replace them, or a function to receive the auto-generated text and optional `requestContext` for per-request customization.
