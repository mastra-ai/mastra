# `@mastra/brightdata` Integration — Design

**Date:** 2026-05-10
**Author:** Pair design with Claude
**Status:** Approved

## Goal

Add a Bright Data integration to the Mastra monorepo that mirrors the existing `@mastra/tavily` package. Expose two Mastra agent tools backed by the official [`@brightdata/sdk`](https://github.com/brightdata/sdk-js):

- `web-search` — Google SERP via Bright Data's SERP API.
- `web-fetch` — fetch a URL and return its markdown via Bright Data's Web Unlocker.

The package lives at `integrations/brightdata/` and follows the conventions documented in the repo's root `AGENTS.md`.

## Non-goals

- Bing/Yandex search, batch search, batch scrape, browser tools, dataset platform tools, scraper studio, or any of the other Bright Data MCP tools. (May be added in follow-up work.)
- Re-implementing parsing, retry, or zone management — the SDK already handles all of that.
- Custom telemetry beyond what the SDK provides; the SDK does not expose a `clientSource` hook today.

## Reference

- Bright Data MCP server (Bright Data SSE) at `/home/meirk/brightdata-mcp-sse/server.js` is the source of truth for tool semantics. Specifically:
  - `search_engine` — [`server.js:560-622`](file:///home/meirk/brightdata-mcp-sse/server.js)
  - `scrape_as_markdown` — [`server.js:624-656`](file:///home/meirk/brightdata-mcp-sse/server.js)
  - `clean_google_search_payload` — [`server.js:1082-1110`](file:///home/meirk/brightdata-mcp-sse/server.js) (defines the parsed Google shape we surface).
- Tavily integration at [`integrations/tavily/`](../../../integrations/tavily/) is the structural template (file layout, tsconfig/tsup/vitest/turbo configs, lazy-client pattern, test conventions).
- Bright Data SDK: `@brightdata/sdk` v1.1.0+. Named export `bdclient`. Env var `BRIGHTDATA_API_TOKEN`.

## Package layout

```
integrations/brightdata/
  package.json
  README.md
  CHANGELOG.md
  tsconfig.json
  tsconfig.build.json
  tsup.config.ts
  vitest.config.ts
  turbo.json
  eslint.config.js
  src/
    index.ts
    client.ts
    search.ts
    fetch.ts
    tools.ts
    __tests__/
      client.test.ts
      search.test.ts
      fetch.test.ts
      tools.test.ts
```

All config files are copied verbatim from `integrations/tavily/`, with the only edits being package name and the vitest project name (`unit:integrations/brightdata`).

## Public API

### `src/index.ts` (barrel)

```ts
export { getBrightDataClient, type BrightDataClientOptions, type BrightDataClient } from './client.js';
export { createBrightDataSearchTool } from './search.js';
export { createBrightDataFetchTool } from './fetch.js';
export { createBrightDataTools } from './tools.js';
```

### `getBrightDataClient(config?)`

```ts
import { bdclient } from '@brightdata/sdk';

export type BrightDataClientOptions = ConstructorParameters<typeof bdclient>[0];
export type BrightDataClient = bdclient;

export function getBrightDataClient(config?: BrightDataClientOptions): BrightDataClient {
  const apiKey = config?.apiKey ?? process.env.BRIGHTDATA_API_TOKEN;
  if (!apiKey) {
    throw new Error(
      'Bright Data API token is required. Pass { apiKey } or set BRIGHTDATA_API_TOKEN env var.',
    );
  }
  return new bdclient({ ...config, apiKey });
}
```

Behavior:
- Reads `BRIGHTDATA_API_TOKEN` from env when no `apiKey` is supplied.
- Throws a clear error if neither source provides a token.
- Passes through every other constructor option the SDK accepts (`timeout`, `webUnlockerZone`, `serpZone`, `logLevel`, `rateLimit`, etc.).
- Each tool factory holds its own lazy reference; the client is constructed on the first `execute` call, matching `@mastra/tavily`.

### `createBrightDataSearchTool(config?)` — `web-search`

Wraps `client.search.google(query, { country?, cursor? })`.

Input schema:

```ts
z.object({
  query: z.string().describe('The search query'),
  country: z.string().length(2).optional()
    .describe('2-letter country code for geo-targeted results (e.g., "us", "gb")'),
  cursor: z.string().optional()
    .describe('Pagination cursor for the next page of results'),
})
```

Output schema:

```ts
z.object({
  query: z.string(),
  results: z.array(z.object({
    link: z.string(),
    title: z.string(),
    description: z.string(),
  })),
  currentPage: z.number(),
})
```

Description (agent-facing):
> "Search Google and get back parsed organic results (link, title, description). Uses Bright Data's SERP API which bypasses bot detection. Supports country targeting and pagination."

Execute logic:
1. Call `client.search.google(input.query, { country: input.country, cursor: input.cursor })`.
2. Project the SDK response to the output schema. If `organic` (or whatever field the SDK returns for parsed results) is missing, return `results: []`. If `current_page` is missing or non-positive, return `currentPage: 1`. These defaults match `clean_google_search_payload` in the MCP source.
3. Echo `query` back so the agent can correlate.

If the SDK's parsed Google shape differs from the MCP's `{ organic: [...], current_page }` shape, the implementation will adapt during dev — the *contract we expose* (link/title/description/currentPage) stays fixed.

### `createBrightDataFetchTool(config?)` — `web-fetch`

Wraps `client.scrapeUrl(url, { dataFormat: 'markdown' })`.

Input schema:

```ts
z.object({
  url: z.string().url().describe('The URL to fetch'),
})
```

Output schema:

```ts
z.object({
  url: z.string(),
  content: z.string().describe('Page content as markdown'),
})
```

Description:
> "Fetch a webpage and return its content as markdown. Uses Bright Data's Web Unlocker which bypasses bot detection and CAPTCHAs. Pass any URL, including pages that block normal scrapers."

Execute logic:
1. Call `client.scrapeUrl(input.url, { dataFormat: 'markdown' })`.
2. Return `{ url: input.url, content: <SDK return value> }`.
3. No `remark`/`strip-markdown` post-processing — the MCP's stripping is opinionated; we surface the SDK's markdown verbatim.

### `createBrightDataTools(config?)` — bundle

```ts
export function createBrightDataTools(config?: BrightDataClientOptions) {
  return {
    webSearch: createBrightDataSearchTool(config),
    webFetch: createBrightDataFetchTool(config),
  };
}
```

The keys are `webSearch` / `webFetch` to match Tavily's camelCase keys. The agent-visible **tool ids** are `web-search` / `web-fetch`.

## Error handling

Errors from `@brightdata/sdk` propagate unchanged. The SDK throws typed errors extending `BRDError` (`AuthenticationError`, `ZoneError`, `NetworkError`, `NetworkTimeoutError`, `TimeoutError`, `APIError`, `ValidationError`, etc.). Wrapping them would lose information; consumers can inspect the type if they need to branch.

## Configuration

| Option | Source | Default | Notes |
|---|---|---|---|
| `apiKey` | options arg or `BRIGHTDATA_API_TOKEN` | — | Required |
| `webUnlockerZone` | options arg | SDK default (`mcp_unlocker`-style auto-create) | Custom zone name |
| `serpZone` | options arg | SDK default | Custom zone name for SERP |
| `timeout` | options arg | SDK default (~120000ms) | 1000–300000 ms |
| `rateLimit` / `ratePeriod` | options arg | SDK default | Caller-side throttling |

All standard `BrightDataClientOptions` flow through — power users get the full SDK surface, casual users only need an API token.

## Testing

Vitest, colocated under `src/__tests__/`. Mock `@brightdata/sdk` the same way Tavily mocks `@tavily/core`.

- `client.test.ts`
  - throws if no `apiKey` and no env var;
  - reads `BRIGHTDATA_API_TOKEN` from env;
  - options `apiKey` overrides env;
  - returns a client exposing `search` and `scrapeUrl`.
- `search.test.ts`
  - tool id is `web-search`;
  - input/output schemas exist;
  - calls `client.search.google` with mapped params;
  - projects parsed organic results to `{link,title,description}` and echoes `query` + `currentPage`;
  - missing/empty `organic` produces `results: []`;
  - missing `current_page` produces `currentPage: 1`;
  - SDK errors propagate.
- `fetch.test.ts`
  - tool id is `web-fetch`;
  - input/output schemas exist;
  - calls `client.scrapeUrl(url, { dataFormat: 'markdown' })`;
  - returns SDK content verbatim;
  - SDK errors propagate.
- `tools.test.ts`
  - `createBrightDataTools()` returns `{ webSearch, webFetch }` with the correct tool ids;
  - shared config flows to both tools.

Run scope: `pnpm --filter ./integrations/brightdata test`.

## `package.json`

```jsonc
{
  "name": "@mastra/brightdata",
  "version": "0.1.0",
  "description": "Bright Data web search and web fetch tools for Mastra agents",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "CHANGELOG.md"],
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.ts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build:lib": "tsup --silent --config tsup.config.ts",
    "build:watch": "pnpm build:lib --watch",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "keywords": ["mastra", "brightdata", "web-search", "web-fetch", "tools", "ai-agent"],
  "license": "Apache-2.0",
  "repository": { "type": "git", "url": "git+https://github.com/mastra-ai/mastra.git", "directory": "integrations/brightdata" },
  "bugs": { "url": "https://github.com/mastra-ai/mastra/issues" },
  "homepage": "https://mastra.ai",
  "engines": { "node": ">=22.13.0" },
  "dependencies": { "@brightdata/sdk": "^1.1.0" },
  "peerDependencies": {
    "@mastra/core": ">=1.0.0-0 <2.0.0-0",
    "zod": ">=3.0.0 || >=4.0.0"
  },
  "devDependencies": {
    "@internal/lint": "workspace:*",
    "@internal/types-builder": "workspace:*",
    "@mastra/core": "workspace:*",
    "tsup": "^8.5.1",
    "typescript": "catalog:",
    "vitest": "catalog:",
    "zod": "catalog:"
  }
}
```

## README

Mirrors `integrations/tavily/README.md` structure:
1. Install command (`@mastra/brightdata @brightdata/sdk zod`).
2. Quick Start with `createBrightDataTools()`.
3. Individual tool sections (`web-search`, `web-fetch`).
4. Config table (`apiKey` / `BRIGHTDATA_API_TOKEN`).
5. RAG pairing example: search → fetch.
6. License.

## Changeset

After implementation, per `.mastracode/commands/changeset.md`:

```bash
pnpm changeset -s -m "Added @mastra/brightdata integration with web-search and web-fetch tools backed by Bright Data's SERP API and Web Unlocker." --minor @mastra/brightdata
```

## Risks and open questions

1. **Parsed Google response shape from the SDK.** The README does not document the exact schema returned by `client.search.google()`. The MCP parses Bright Data's `parsed_light` SERP into `{ organic: [{link,title,description}], current_page }` via `clean_google_search_payload`. The SDK is likely to do something equivalent, but this needs to be verified during implementation. If the SDK returns a different field set, the projection in `search.ts` adapts, but the *output schema* we expose to the agent stays the same.
2. **`bdclient` typing.** The export is a named class. `ConstructorParameters<typeof bdclient>[0]` should give us the options type without a hand-written interface, but if the SDK's typings are looser than expected we may need to declare a minimal `BrightDataClientOptions` interface ourselves and document the passthrough.
3. **Rate limits and zones.** First-time users will rely on the SDK's `autoCreateZones: true` default. If that fails (e.g., insufficient permissions on the API token), the error from the SDK is the right thing to surface — no wrapping needed.
