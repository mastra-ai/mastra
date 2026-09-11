---
'@mastra/code-sdk': patch
'mastracode': patch
---

Added Firecrawl as a web search and extract provider for Mastra Code. Set `FIRECRAWL_API_KEY` to enable it, and pick it under `/settings` → **Web search provider**. In the default `auto` mode it is used when no Tavily or Parallel key is configured.
