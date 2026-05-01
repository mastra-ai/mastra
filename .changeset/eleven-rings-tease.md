---
'@mastra/core': patch
---

Fixed type inference on workflow loop helpers (`foreach`, `dowhile`, `dountil`) so a step's `requestContextSchema` correctly aligns with the workflow's `requestContextSchema`. Previously these methods dropped the workflow's `TRequestContext` from the step parameter, causing TypeScript to reject typed-context steps even when the workflow declared a matching schema. Steps without a `requestContextSchema` are still accepted; steps whose schema does not match the workflow's now produce a type error. Fixes [#15989](https://github.com/mastra-ai/mastra/issues/15989).
