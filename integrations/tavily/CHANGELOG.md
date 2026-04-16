# @mastra/tavily

## 0.1.0-alpha.0

### Minor Changes

- Initial release of `@mastra/tavily` with search, extract, crawl, and map tools for Mastra agents.
  - `createTavilySearchTool` — Web search with full parameter support (search depth, time range, domain filtering).
  - `createTavilyExtractTool` — Extract content from URLs in markdown or text format.
  - `createTavilyCrawlTool` — Crawl websites with configurable depth, breadth, and domain constraints.
  - `createTavilyMapTool` — Discover and list URLs on a website without extracting content.
  - `createTavilyTools` — Convenience function returning all four tools with shared configuration.
