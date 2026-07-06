---
'@mastra/keenable': patch
---

Add `@mastra/keenable`, Keenable web search and page-fetch tools for Mastra agents. Exposes `createKeenableSearchTool`, `createKeenableFetchTool`, and `createKeenableTools`, each returning `createTool`-compatible tools with full Zod schemas. Keyless by default (no API key required); an optional `KEENABLE_API_KEY` lifts the rate limit. No provider SDK dependency; talks to the Keenable HTTP API directly.
