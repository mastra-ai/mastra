---
"@mastra/core": patch
---

Workspace search no longer throws when requesting hybrid or vector mode if the configuration does not support it. The search tool now gracefully falls back to the best available mode instead of throwing an error.
