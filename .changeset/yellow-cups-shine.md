---
'@mastra/ai-sdk': patch
---

Fixed workflow routes to properly receive request context from middleware. This aligns the behavior of `workflowRoute` with `chatRoute`, ensuring that context set in middleware is consistently forwarded to workflows.

When both middleware and request body provide a request context, the middleware value now takes precedence, and a warning is emitted to help identify potential conflicts.

See [#10427](https://github.com/mastra-ai/mastra/pull/10427)
