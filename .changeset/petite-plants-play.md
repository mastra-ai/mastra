---
'@mastra/mcp': patch
---

Fixed @mastra/mcp crashing Cloudflare Workers at module initialization. The createRequire(import.meta.url) call for optional Datadog tracer loading was running unconditionally at module scope, which fails on workerd where import.meta.url is undefined. Moved the call inside the Datadog loading function so it only runs when Datadog is actually present.
