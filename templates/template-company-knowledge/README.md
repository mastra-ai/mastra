# Company Knowledge Agent

Indexes your Linear issues and Notion pages into [pgvector](https://github.com/pgvector/pgvector) (on [Neon](https://neon.tech)) and exposes a single agent that answers questions over them. The agent searches the indexed corpus first, falls back to live Linear/Notion lookups via MCP ([mcp.linear.app](https://mcp.linear.app/mcp) and `@notionhq/notion-mcp-server`), and uses provider-native web search through Mastra's Gateway as a last resort.

A scheduled workflow (`index-knowledge`) re-indexes every 6 hours automatically. Input is normalized with `UnicodeNormalizer`, and `PIIDetector` redacts emails, phone numbers, SSNs, credit card numbers, and API keys from responses before they reach the user.

## Prerequisites

- Node.js `>= 22.13.0`
- A Neon Postgres database (or any Postgres 11+ with the `vector` extension)
- A Gateway API key — get one at [gateway.mastra.ai](https://gateway.mastra.ai)
- A Linear API key and/or Notion integration token

## Setup

```bash
pnpm install
cp .env.example .env
# fill in MASTRA_GATEWAY_API_KEY, DATABASE_URL, LINEAR_API_KEY, NOTION_API_KEY
pnpm dev
```

On Neon, make sure `CREATE EXTENSION IF NOT EXISTS vector;` has been run on your database.

## Indexing your knowledge base

Run the `index-knowledge` workflow from Mastra Studio (`pnpm dev` → workflows tab) or programmatically. It will:

1. Pull up to N recent Linear issues via the Linear GraphQL API.
2. Search Notion pages the integration has access to via the Notion REST API.
3. Embed each document with `mastra/openai/text-embedding-3-small` through the Gateway.
4. Upsert into the `company_knowledge` pgvector index.

The workflow is scheduled to run every 6 hours automatically. You can also trigger it manually from Studio or programmatically.

## How the agent answers

The agent's instructions force this order:

1. `search-knowledge` — semantic search over the indexed corpus.
2. Live Linear / Notion tools (via MCP) — when fresh data is needed.
3. Provider-native `web_search` — for public information.

Sources (URLs) are always cited in the response.

## Environment variables

| Variable                 | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `MASTRA_GATEWAY_API_KEY` | Routes the chat model, embeddings, and provider tools through the Gateway. |
| `DATABASE_URL`           | Neon (or other) Postgres connection string with `?sslmode=require`.        |
| `LINEAR_API_KEY`         | Linear personal API key (for Linear MCP server).                           |
| `NOTION_API_KEY`         | Notion internal integration token (for Notion MCP server).                 |

## Agent Editor

This template enables the code-backed Agent Editor with `new MastraEditor({ source: 'code', codePath: 'mastra/editor' })`. Edits made in Studio are written as deterministic JSON overrides under `mastra/editor/agents/`, so Mastra Platform can open GitHub pull requests for agent changes instead of only saving them to the database.
