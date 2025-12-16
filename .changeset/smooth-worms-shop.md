---
'@mastra/ai-sdk': patch
---

Fix requestContext not being forwarded from middleware in chatRoute and networkRoute

Previously, when using middleware to set values in requestContext (e.g., extracting agentId and organizationId from the request body), those values were not properly forwarded to agents, tools, and workflows when using chatRoute and networkRoute from the AI SDK.

This fix ensures that requestContext set by middleware is correctly prioritized and forwarded with the following precedence:
1. Context from middleware (highest priority)
2. Context from defaultOptions
3. Context from request body (lowest priority)

The fix explicitly removes any requestContext from the request params before spreading to avoid ambiguity and ensures the effective context is passed through to agent execution.

Resolves #11192
