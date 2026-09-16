---
'@mastra/firecrawl': minor
---

Add `@mastra/firecrawl`, a new package that exposes Firecrawl Search and Scrape as Mastra tools. `createFirecrawlTools()` returns both tools; `createFirecrawlSearchTool()` and `createFirecrawlScrapeTool()` create them individually. The client reads `FIRECRAWL_API_KEY` or an explicit `apiKey` and is initialized lazily on first execution.
