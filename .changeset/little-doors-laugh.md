---
'@mastra/longmemeval': patch
'@mastra/mcp-docs-server': patch
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/agent-builder': patch
'create-mastra': patch
'@mastra/playground-ui': patch
'@mastra/agent-browser': patch
'@mastra/client-js': patch
'@mastra/opencode': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/ai-sdk': patch
'@mastra/stagehand': patch
'@mastra/react': patch
'@mastra/deployer': patch
'@mastra/deployer-cloud': patch
'@mastra/editor': patch
'@mastra/memory': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'mastra': patch
'mastracode': patch
'@mastra/pg': patch
---

Fixed an issue where nested agent sub-tool streams dropped the 'uiMessages' and 'messages' properties during chunk propagation. The response payloads are now merged into the buffered pipeline execution correctly.
