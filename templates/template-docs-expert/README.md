# Docs Expert

A research assistant that answers questions about libraries, APIs, and documentation by searching the live web and citing its sources. It uses a Mastra `web_search` tool routed through Mastra Gateway/OpenRouter web search — no extra search API key needed.

The agent uses observational memory so it learns what docs and topics you've asked about, building persistent context over time. All state is persisted to Turso (libSQL).

## Demo

This demo runs in Mastra Studio, but you can connect this agent to your React, Next.js, or Vue app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client) or agentic UI libraries like [AI SDK UI](https://mastra.ai/guides/build-your-ui/ai-sdk-ui), [CopilotKit](https://mastra.ai/guides/build-your-ui/copilotkit), or [Assistant UI](https://mastra.ai/guides/build-your-ui/assistant-ui).

## Prerequisites

- A [Mastra Gateway API key](https://mastra.ai/docs/models/gateways/mastra) — proxies to OpenAI, Anthropic, Google, etc. behind a single key.
- A [Turso](https://turso.tech) database (URL + auth token) for storage. A free dev tier is fine; in-memory libSQL works too if you swap the URL to `:memory:`.

## Quickstart 🚀

1. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your keys.
2. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

Ask things like:

- "What's the current API for `openai.tools.webSearch()` in `@ai-sdk/openai`?"
- "Compare pgvector HNSW vs IVFFlat indexes for cosine similarity."
- "What changed in Node 22 LTS vs 20 LTS?"

## Making it yours

- **Swap the model.** Change the agent model or the `web_search` tool's Gateway model independently. The tool calls Gateway's OpenRouter-compatible web-search server tool, so it does not need an OpenAI, Exa, or Tavily key.
- **Tighten the system prompt.** Constrain the agent to a single docs domain (e.g. "only answer about Mastra") and require it to refuse unrelated questions.
- **Add structured output.** Set `structuredOutput` on the agent or call `generate({ output: z.object({ answer: z.string(), sources: z.array(...) }) })` to force JSON with citations.
- **Persist conversations.** This template already wires Memory + Turso, so threads survive restarts.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show what you can build. Use the platform-created repository as your starting point, then customize it for your app.

Want to contribute? See the [Mastra contributing guide](https://github.com/mastra-ai/mastra/blob/main/CONTRIBUTING.md).
