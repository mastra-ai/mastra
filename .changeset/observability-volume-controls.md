---
"@mastra/core": patch
"@mastra/observability": patch
---

Reduced default cloud observability volume by filtering model chunk spans from CloudExporter uploads by default.

Added controls to run processors without `PROCESSOR_RUN` spans and mark processor spans as errors-only so cloud keeps errors and tripwire aborts while dropping successful processor noise.
