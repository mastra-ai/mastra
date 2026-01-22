---
"@mastra/core": patch
---

fix(workflows): change bail() type to accept flexible payload. The bail() function now accepts `TStepOutput | Record<string, any>` instead of only `TStepOutput`, allowing early workflow exits with any object structure while maintaining type compatibility.
