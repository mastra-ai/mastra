---
"@mastra/core": patch
"@mastra/observability": patch
---

Reduced default cloud observability volume by filtering model chunk spans from CloudExporter uploads by default.

Added controls to disable auto-extracted metrics, run processors without `PROCESSOR_RUN` spans, and mark processor spans as errors-only so cloud keeps tripwire/error spans while dropping successful processor noise.
