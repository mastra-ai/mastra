---
'@mastra/core': patch
'@mastra/editor': patch
'@mastra/server': patch
'@mastra/client-js': patch
---

Improved observability and error isolation in the v1 ToolProvider runtime.

**Better visibility into connection-scope misconfiguration**

When an agent runs with a stored ToolProvider connection whose scope cannot be resolved from the request context, the runtime now logs a one-shot warning and falls back to a shared bucket instead of silently routing every caller to the same OAuth account. Multi-tenant deployments get a clear signal when their identity wiring isn't reaching the runtime.

**One bad toolkit no longer disables sibling providers**

If a provider returns more connections for a toolkit than its declared capabilities allow, the runtime now logs and skips that toolkit instead of throwing. Other providers and other toolkits on the same agent continue to resolve normally.
