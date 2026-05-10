# `brightdata-agent-test` — Design

**Date:** 2026-05-10
**Status:** Approved

## Goal

Build a small standalone CLI that exercises the new `@mastra/brightdata` integration end-to-end. Given a natural-language query, it spins up a Mastra agent backed by an OpenRouter model and lets the agent decide when to call the `web-search` and `web-fetch` tools. Step-by-step output makes it visible whether the tools were actually invoked, with what arguments, and what they returned.

This is a manual smoke test, not an automated test suite. Its purpose is to verify the integration works for a real consumer outside the monorepo before we open the PR.

## Non-goals

- No persistent memory, no thread management, no tracing wiring.
- No automated tests of the agent or model.
- No support for streaming the _model's_ token output to the terminal — we stream tool events, but the final answer is printed once at the end.
- No Mastra Studio, no playground, no HTTP server.

## Location and layout

The project lives at `/home/meirk/brightdata-agent-test/` (sibling to the mastra repo, not inside it):

```
brightdata-agent-test/
  package.json
  tsconfig.json
  index.ts
  README.md
  .gitignore
```

It is not a pnpm workspace member of the mastra monorepo. This is intentional: it depends on `@mastra/brightdata` via a `file:` path so it consumes the package's built `dist/` the way an external user would.

## Dependencies

`package.json`:

```json
{
  "name": "brightdata-agent-test",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx index.ts"
  },
  "dependencies": {
    "@mastra/brightdata": "file:../BrightAI/mastra/integrations/brightdata",
    "@mastra/core": "^1.27.0",
    "@openrouter/ai-sdk-provider": "^0.4.0",
    "zod": "^3.24.0",
    "tsx": "^4.20.0"
  }
}
```

`@brightdata/sdk` is pulled in transitively. The `@mastra/brightdata` `file:` link requires the integration's `dist/` to be built (`pnpm --filter ./integrations/brightdata build:lib` from the mastra repo).

`tsconfig.json` is minimal: `target: es2022`, `module: nodenext`, `moduleResolution: nodenext`, `strict: true`, `esModuleInterop: true`, `skipLibCheck: true`.

## Runtime contract

### Invocation

```bash
OPENROUTER_API_KEY=sk-or-... \
BRIGHTDATA_API_TOKEN=brd_... \
tsx index.ts "who won the most recent F1 race"
```

### Required inputs

- **CLI arg 1**: the user query, as a single string. If omitted, exit 1 with usage.
- **`OPENROUTER_API_KEY`**: required env var. If unset, exit 1 with a clear message.
- **`BRIGHTDATA_API_TOKEN`**: required env var. If unset, exit 1 with a clear message.

### Optional inputs

- **`OPENROUTER_MODEL`**: defaults to `openai/gpt-5`. This is passed verbatim to the OpenRouter provider's `openrouter(...)` factory. Override with any model id OpenRouter accepts (e.g., `anthropic/claude-sonnet-4.5`).
- **`MAX_STEPS`**: defaults to `5`. Caps how many tool-use iterations the agent can do before being forced to answer.

### Exit codes

- `0`: agent ran to completion and produced a final answer.
- `1`: missing input, configuration error, or runtime failure (tool error, model error, network error).

## Agent shape

```ts
import { Agent } from '@mastra/core/agent'
import { createBrightDataTools } from '@mastra/brightdata'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY! })

const agent = new Agent({
  id: 'brightdata-test-agent',
  name: 'BrightData Test Agent',
  model: openrouter(process.env.OPENROUTER_MODEL ?? 'openai/gpt-5'),
  instructions:
    'You are a research assistant. When the user asks a question that needs current ' +
    'information, use the web-search tool to find relevant pages, then optionally use ' +
    'web-fetch to read a specific page in full. Always cite the URLs you used.',
  tools: createBrightDataTools(),
})
```

`createBrightDataTools()` reads `BRIGHTDATA_API_TOKEN` from env and returns `{ webSearch, webFetch }` with tool ids `web-search` and `web-fetch`.

We pass the OpenRouter provider instance directly (not the `openrouter/...` registry string) because that path doesn't depend on Mastra's static model registry being in sync with what the user wants to run.

## Execution flow

The CLI does, in order:

1. Parse `process.argv[2]` as the query. Bail with usage if missing.
2. Validate env vars. Bail if either required key is missing.
3. Construct the OpenRouter provider and the agent.
4. Run the agent. Use the agent's streaming/event API so we can observe each step.
5. As tool events arrive, print them in the format below.
6. After the run completes, print the final answer text.
7. Exit 0.

## Step printing

Each event prints one line (or one labeled block). Format:

```
🤖 [model is thinking...]
🔧 web-search({ query: "F1 race winner 2026" })
   ↳ { results: [3 items], currentPage: 1 }
🔧 web-fetch({ url: "https://www.formula1.com/..." })
   ↳ { url: "...", content: "<2400 chars of markdown>" }
💬 Final answer:
…
```

Truncation rules to keep the terminal sane:

- Tool input args are JSON-stringified, then truncated to 200 chars.
- Tool result objects: arrays are summarized as `[N items]`; long string fields are summarized as `"<NN chars>"`. The full result is not echoed.
- The final answer is printed verbatim.

## Error handling

There is no top-level `try/catch` that swallows errors. Each failure mode surfaces:

1. **Missing input**: caught at startup, printed as `Error: <reason>` plus a one-line usage hint, exit 1.
2. **Tool error from Bright Data** (auth, zone, rate limit, network): the SDK's typed error propagates. We print `Error: <message>` and exit 1. The error type name (e.g., `AuthenticationError`) is included if available.
3. **Model error** (OpenRouter auth, rate limit, model-not-found): the AI SDK error propagates. Print and exit 1.
4. **Unhandled rejection / uncaught exception**: leave the default Node behavior — the process crashes loudly. We don't paper over surprise failures.

## README

The README is short:

- One sentence describing what the project does.
- The exact command to run, with placeholder env values.
- A note that `@mastra/brightdata` must be built (`pnpm --filter ./integrations/brightdata build:lib` from the mastra repo) before `pnpm install` here will resolve.
- A list of optional env vars (`OPENROUTER_MODEL`, `MAX_STEPS`).

## Risks and open questions

1. **Mastra agent streaming API surface.** `@mastra/core` exposes an event-stream for agent runs but the exact method name (`stream`, `streamEvents`, etc.) and event shape may differ slightly between minor versions. The implementation will pick whatever's idiomatic in `1.27.x`. If the surface has a single non-streaming "run" method that returns the conversation history, we fall back to printing tool events from the returned messages instead of from a stream — same end result, slightly less live.
2. **OpenRouter model availability.** `openai/gpt-5` is the default. If your OpenRouter account doesn't have access, set `OPENROUTER_MODEL` to one you do have (e.g., `anthropic/claude-sonnet-4.5`).
3. **Build dependency.** Because we link `@mastra/brightdata` via `file:`, npm/pnpm reads its `package.json` `main`/`exports` which point at `./dist/`. If `dist/` is empty, install will succeed but import will fail at runtime. The README mentions this explicitly.
