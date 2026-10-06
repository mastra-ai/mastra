---
'@mastra/core': patch
---

Fixed evented agents hanging forever when workflow workers run in a separate process (for example, an API server started with `MASTRA_WORKERS=false` plus a dedicated worker deployment). Runs now reach the worker process and stream back to the caller. Values used in more than one place in a workflow now keep their data when sent between processes instead of arriving as `null`. A process without workers now logs a warning instead of silently dropping a workflow it can only run locally.
