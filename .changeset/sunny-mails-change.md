---
'@mastra/observability': patch
'@mastra/inngest': patch
'@mastra/core': patch
'@mastra/libsql': patch
---

Fixed resumed workflow runs sampling again: a resume now keeps the suspended run's sampling decision and trace settings and nests under its span on the default, evented and Inngest engines, and an evented worker in another process persists the tracing context it needs at suspend.
