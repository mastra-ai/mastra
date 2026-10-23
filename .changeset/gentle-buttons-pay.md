---
'@mastra/pg': patch
---

Added support for recovering evented agent runs when a worker process stops. Another worker can finish the run without overwriting completed steps or repeating completed loop iterations.

Requires `@mastra/core` in the range `>=1.80.0-0 <2.0.0-0` for worker recovery support. Runs started on older versions can finish after upgrading, but do not have guaranteed crash recovery. Rows written without occurrence metadata keep their existing unguarded behavior.
