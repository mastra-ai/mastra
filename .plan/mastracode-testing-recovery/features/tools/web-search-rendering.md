# Web search tool rendering

## Origin PR / commit

- PR: [#13870](https://github.com/mastra-ai/mastra/pull/13870) — renders provider `web_search` results as readable TUI output instead of raw JSON/encrypted blobs.
- Related earlier change: [#13609](https://github.com/mastra-ai/mastra/pull/13609) — added OpenAI native `web_search` fallback when Tavily is absent.
- Later changes: [#15448](https://github.com/mastra-ai/mastra/pull/15448) — extracts Tavily search/extract/crawl/map into the standalone `@mastra/tavily` integration package and rewires Mastra Code `web-search` / `web-extract` wrappers to delegate to it while preserving Mastra Code-specific markdown formatting and 2k-token truncation; [#16326](https://github.com/mastra-ai/mastra/pull/16326) — switches the wrapper token estimator from `js-tiktoken` to `tokenx`.

## User-visible behavior

- What the user can do: ask models with native or Tavily-backed web search to search/extract web content and read compact markdown/TUI output; package users can also import `@mastra/tavily` tools for search, extract, crawl, and map.
- Success looks like: `web_search` / `web_search_YYYYMMDD` calls show a bordered result block with `web_search "query"` in the footer, not raw provider JSON or `encryptedContent` payloads.
- Must preserve: Tavily markdown passthrough, Anthropic provider result formatting, OpenAI `sources` formatting, quiet-mode previews, and error rendering.

## Entry points / commands

- Commands / shortcuts / flags: automatic when a model/tool call invokes `web_search` or provider-versioned `web_search_YYYYMMDD`.
- Automatic triggers: `ToolExecutionComponentEnhanced` detects web-search-like tool names during live rendering and history reconstruction.

## TUI states

- Idle: no web-search renderer is visible.
- Active / modal / error: pending calls show only the bordered footer; completed calls show results; failed calls use the shared error renderer.

## Headless / non-TUI behavior

- Supported: the tool result content is still available to the model/runtime.
- Not supported / unknown: enhanced formatting is TUI-only; headless output should not rely on border/preview formatting.

## Streaming / loading / interrupted states

- Streaming / loading: pending web searches render a compact bordered footer while waiting for results.
- Abort / retry / resume: partial calls must not dump raw JSON; final failed calls should surface the error through the shared error renderer.

## Streaming vs loaded-from-history behavior

- While actively streaming: the live `ToolExecutionComponentEnhanced` formats provider result JSON into title/URL rows.
- After reload / history reconstruction: completed web-search tool results should format the same way because the renderer works from stored tool result content.

## State ownership

| State | Owner / source of truth | Consumers |
| --- | --- | --- |
| Tool call name | Harness/provider event (`web_search` or `web_search_YYYYMMDD`) | TUI renderer detection |
| Query summary | tool args `query` or nested `action.query` | footer / quiet badge |
| Search result content | tool result text (`sources`, provider arrays, or Mastra Code-formatted Tavily markdown from `@mastra/tavily`) | rendered result rows and quiet preview |
| Wrapper token budget | `mastracode/src/utils/token-estimator.ts` using `tokenx` estimate/slice helpers | 2k-token search/extract result truncation before model/TUI consumption |
| Output truncation/collapse | `ToolExecutionComponentEnhanced` collapsed/expanded state | normal TUI output |
| Quiet preview cap | `settings.preferences.quietModeMaxToolPreviewLines` | compact quiet output |

## Key files

- `mastracode/src/tui/components/tool-execution-enhanced.ts` — web-search detection, bordered renderer, provider result parser, quiet preview.
- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — compact web-search preview coverage.
- `mastracode/src/tools/web-search.ts` and `mastracode/src/utils/token-estimator.ts` — thin Mastra Code wrapper around `@mastra/tavily` search/extract tools that applies relevance filtering, markdown formatting, and `tokenx`-estimated 2k token budgets before TUI rendering.
- `integrations/tavily/src/{client,search,extract,crawl,map,tools}.ts` — standalone Tavily client/tool package with zod schemas and API response mapping.
- `mastracode/src/agents/tools.ts` — dynamic web-search tool availability, including native provider fallbacks.

## Dependencies / related features

- [Coding tools and approval permissions](./coding-tools-permissions.md) — owns web-search runtime availability and denied-tool guidance.
- [Quiet mode](../tui/quiet-mode.md) — owns compact preview behavior for web-search output.
- [Interactive TUI chat](../tui/interactive-chat.md) — renders live and historical tool components.
- [Model auth, selection, and modes](../models/model-auth-and-modes.md) — selected provider determines native web-search result shape.

## Existing tests

- `mastracode/src/tui/components/__tests__/tool-execution-enhanced.test.ts` — quiet web-search rendering with query summary and compact result preview.
- `integrations/tavily/src/__tests__/{client,search,extract,crawl,map,tools}.test.ts` — Tavily client env/config resolution, search/extract/crawl/map parameter mapping, response normalization, and `createTavilyTools()` bundle coverage.
- Existing dynamic-tool tests indirectly cover whether web-search tools are available; they do not assert the TUI format or wrapper-level `@mastra/tavily` delegation.

## Missing tests

- Normal-mode rendered output for Anthropic provider array results, including `pageAge` and `encryptedContent` stripping.
- Normal-mode rendered output for OpenAI `{ action, sources }` results and fallback query extraction from result content.
- Mastra Code wrapper test proving `createWebSearchTool()` / `createWebExtractTool()` delegate to `@mastra/tavily`, filter low relevance scores, preserve failed extract errors, and enforce the 2k token budget.
- Tavily markdown passthrough stays readable and collapsed without double-formatting.
- Loaded-history parity for web-search results.

## Known risks / regressions

- Provider result shapes are not stable; unknown JSON arrays fall back to stripped JSON while object-shaped unknown output may still render raw JSON.
- The package-level `@mastra/tavily` tests do not prove Mastra Code wrapper formatting/truncation; regressions in `web-search.ts` can slip unless wrapper-specific tests are added.
- Query extraction is split between args and nested action/result content; streamed partial args can temporarily omit the footer query.
- Quiet mode previews rely on normal formatter output, so parser regressions affect both compact and full render paths.

## Verification checklist

- [x] Code paths checked.
- [x] Existing tests identified.
- [x] Missing tests listed.
- [x] State ownership verified.
- [x] TUI/headless behavior considered.
- [x] Streaming versus loaded-from-history behavior considered.
