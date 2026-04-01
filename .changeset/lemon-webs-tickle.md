---
'@mastra/sentry': patch
---

Added Sentry mappings for scorer tracing spans.

**What changed**
- Added Sentry span mappings for `SCORER_RUN` and `SCORER_STEP`.

**Why**
This keeps scorer tracing visible in Sentry when the new scorer spans are emitted by `@mastra/core`.
