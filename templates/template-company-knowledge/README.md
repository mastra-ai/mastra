# Company Knowledge Agent

Indexes your Linear issues and Notion pages into [pgvector](https://github.com/pgvector/pgvector) (on [Neon](https://neon.tech)) and exposes a single agent that answers questions over them. The agent searches the indexed corpus first, falls back to live Linear/Notion lookups through [Mastra Connect](https://mastra.ai/docs/mastra-platform/overview), and uses provider-native web search through Mastra's Gateway as a last resort.

A scheduled workflow (`index-knowledge`) re-indexes every 6 hours automatically. Input is normalized with `UnicodeNormalizer`, and `PIIDetector` redacts emails, phone numbers, SSNs, credit card numbers, and API keys from responses before they reach the user.

## Prerequisites

- Node.js `>= 22.13.0`
- A Neon Postgres database (or any Postgres 11+ with the `vector` extension)
- A Gateway API key — get one at [gateway.mastra.ai](https://gateway.mastra.ai)
- A Mastra platform project with a Linear and/or Notion connection attached, and an access token for it

## Setup

```bash
pnpm install
cp .env.example .env
# fill in MASTRA_GATEWAY_API_KEY, DATABASE_URL, MASTRA_PLATFORM_ACCESS_TOKEN, MASTRA_PROJECT_ID
pnpm dev
```

On Neon, make sure `CREATE EXTENSION IF NOT EXISTS vector;` has been run on your database.

## Indexing your knowledge base

Run the `index-knowledge` workflow from Mastra Studio (`pnpm dev` → workflows tab) or programmatically. It will:

1. Pull up to N recent Linear issues through the project's Linear connection.
2. Search Notion pages the Notion connection can see, and read each one as markdown.
3. Embed each document with `mastra/openai/text-embedding-3-small` through the Gateway.
4. Upsert into the `company_knowledge` pgvector index.

The workflow is scheduled to run every 6 hours automatically. You can also trigger it manually from Studio or programmatically.

## How the agent answers

The agent's instructions force this order:

1. `search-knowledge` — semantic search over the indexed corpus.
2. Live Linear / Notion tools (via Mastra Connect) — when fresh data is needed.
3. Provider-native `web_search` — for public information. Only available when the agent runs on an OpenAI model.

Sources (URLs) are always cited in the response.

## Environment variables

| Variable                       | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `MASTRA_GATEWAY_API_KEY`       | Routes the chat model, embeddings, and provider tools through the Gateway. |
| `DATABASE_URL`                 | Neon (or other) Postgres connection string with `?sslmode=require`.        |
| `MASTRA_PLATFORM_ACCESS_TOKEN` | Mastra platform access token, used by Mastra Connect.                      |
| `MASTRA_PROJECT_ID`            | The Mastra platform project whose Linear and Notion connections are used.  |
| `AGENT_MODEL`                  | Optional model router id. Defaults to `mastra/openai/gpt-5.4`.             |

## Agent Editor

This template enables the code-backed Agent Editor with `new MastraEditor({ source: 'code', codePath: 'mastra/editor' })`. Edits made in Studio are written as deterministic JSON overrides under `mastra/editor/agents/`, so Mastra Platform can open GitHub pull requests for agent changes instead of only saving them to the database.
