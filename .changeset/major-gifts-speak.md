---
'@mastra/longmemeval': patch
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'create-mastra': patch
'@mastra/playground-ui': patch
'@mastra/nestjs': patch
'@mastra/client-js': patch
'@mastra/opencode': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/temporal': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/server': patch
'@mastra/core': patch
'mastra': patch
'mastracode': patch
---

End the AGENT_RUN observability span when an agent stream suspends for HITL tool approval (`tool-call-approval`) or tool `suspend()` (`tool-call-suspended`). Previously these terminations left the span open, so traces never reached observability backends like Langfuse, Braintrust, or Datadog. The span output now includes the suspend reason, tool name, and tool call ID.
