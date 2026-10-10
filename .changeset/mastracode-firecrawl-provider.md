---
'@mastra/code-sdk': patch
'mastracode': patch
---

Add Firecrawl as a web search provider for Mastra Code. When `FIRECRAWL_API_KEY` is set, `web_search` and `web_extract` can run on Firecrawl alongside Tavily and Parallel. `auto` still prefers Tavily, then Parallel, then Firecrawl; pick Firecrawl explicitly under "Web search provider" in `/settings`.
