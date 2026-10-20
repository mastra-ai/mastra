---
'@mastra/code-sdk': patch
---

Mastra Code sessions no longer load web search providers, the Postgres store, the local trace store (DuckDB), the MCP client, local embeddings or voice SDKs until a feature needs them, which cuts startup memory by about 90 MB.
