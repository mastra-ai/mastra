---
'@mastra/core': patch
---

Added an optional `scope` field to `ResolveToolsOpts` so tool providers can see a connection's identity bucketing (`per-author`, `shared`, or `caller-supplied`) when resolving tools. Providers can use this to let the backend auto-resolve an account within a caller's bucket instead of pinning a specific one. The field is optional and defaults to previous behavior when absent.
