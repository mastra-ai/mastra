---
'@mastra/code-sdk': patch
---

Mastra Code sessions no longer load web search providers, the Postgres store, the local trace store (DuckDB), the MCP client, local embeddings or voice SDKs until a feature needs them, which cuts startup memory by about 90 MB.

If you import the web tool factories from `@mastra/code-sdk/tools/web-search`, `createWebSearchTool`, `createWebExtractTool`, `createParallelWebSearchTool`, `createParallelWebExtractTool` and `createConfiguredWebTools` now return Promises, so `await` them.
