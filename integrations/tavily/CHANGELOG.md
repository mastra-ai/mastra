# @mastra/tavily

## 1.0.0-alpha.1

### Major Changes

- Added the `@mastra/tavily` integration with first-class Mastra tools for Tavily web search, extract, crawl, and map APIs, and migrated `mastracode`'s web search tools to use it. ([#15448](https://github.com/mastra-ai/mastra/pull/15448))

### Patch Changes

- Updated dependencies [[`a371ac5`](https://github.com/mastra-ai/mastra/commit/a371ac534aa1bb368a1acf9d8b313378dfdc787e), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e), [`c80dc16`](https://github.com/mastra-ai/mastra/commit/c80dc16e113e6cc159f510ffde501ad4711b2189), [`47cee3e`](https://github.com/mastra-ai/mastra/commit/47cee3e137fe39109cf7fffd2a8cf47b76dc702e)]:
  - @mastra/core@1.26.0-alpha.12

## 0.1.0-alpha.0

### Minor Changes

- Initial release of `@mastra/tavily` with search, extract, crawl, and map tools for Mastra agents.
  - `createTavilySearchTool` — Web search with full parameter support (search depth, time range, domain filtering).
  - `createTavilyExtractTool` — Extract content from URLs in markdown or text format.
  - `createTavilyCrawlTool` — Crawl websites with configurable depth, breadth, and domain constraints.
  - `createTavilyMapTool` — Discover and list URLs on a website without extracting content.
  - `createTavilyTools` — Convenience function returning all four tools with shared configuration.
