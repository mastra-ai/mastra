# Company Knowledge Agent

A Mastra template that indexes your Linear issues and Notion pages into [pgvector](https://github.com/pgvector/pgvector) (on [Neon](https://neon.tech)) and exposes a single agent that answers questions over them, with live Linear/Notion lookups and provider-native web search as fallbacks.

## What it showcases

- **`@mastra/pg`** — `PostgresStore` for state and `PgVector` for semantic recall.
- **Multi-source tool agent** — Linear SDK + Notion SDK tools, semantic search, and OpenAI provider-native web search through the **Mastra Gateway**.
- **Indexing workflow** — `index-knowledge` pulls recent Linear issues + Notion pages, embeds them with `text-embedding-3-small`, and upserts into pgvector.

## Prerequisites

- Node.js `>= 22.13.0`
- A Neon Postgres database (or any Postgres 11+ with the `vector` extension)
- A Mastra Gateway API key — get one at [gateway.mastra.ai](https://gateway.mastra.ai)
- A Linear API key and/or Notion integration token
- An OpenAI API key for embeddings (the chat model still runs through the Mastra Gateway)

## Setup

```bash
pnpm install
cp .env.example .env
# fill in MASTRA_GATEWAY_API_KEY, DATABASE_URL, LINEAR_API_KEY, NOTION_API_KEY, OPENAI_API_KEY
pnpm dev
```

On Neon, make sure `CREATE EXTENSION IF NOT EXISTS vector;` has been run on your database.

## Indexing your knowledge base

Run the `index-knowledge` workflow from Mastra Studio (`pnpm dev` → workflows tab) or programmatically. It will:

1. Pull up to N recent Linear issues (via `@linear/sdk`).
2. Search Notion pages the integration has access to (via `@notionhq/client`).
3. Embed each document with `text-embedding-3-small`.
4. Upsert into the `company_knowledge` pgvector index.

You can re-run this on a schedule to keep the index fresh.

## How the agent answers

The agent's instructions force this order:

1. `search-knowledge` — semantic search over the indexed corpus.
2. Live Linear / Notion tools — when fresh data is needed.
3. Provider-native `web_search` — for public information.

Sources (URLs) are always cited in the response.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `MASTRA_GATEWAY_API_KEY` | Routes the chat model and provider tools through the Mastra Gateway. |
| `DATABASE_URL` | Neon (or other) Postgres connection string with `?sslmode=require`. |
| `LINEAR_API_KEY` | Linear personal API key. |
| `NOTION_API_KEY` | Notion internal integration token. |
| `OPENAI_API_KEY` | Used only for embeddings (`text-embedding-3-small`). |
