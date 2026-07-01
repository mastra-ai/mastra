# Dakera Persistent Memory with Mastra

A Mastra agent with cross-session memory backed by [Dakera](https://dakera.ai) — a self-hosted, decay-weighted vector memory server.

## What this demonstrates

- **Persistent memory across sessions** — the agent recalls context from prior conversations, even after a process restart.
- **Decay-weighted recall** — Dakera scores memories by recency, access frequency, and semantic relevance, so important context stays accessible while stale data fades.
- **Agent-driven memory lifecycle** — the agent decides what to store (via `dakera-store` tool) and when to recall (via `dakera-recall` tool), guided by its system prompt.

## Prerequisites

### 1. Start Dakera

```bash
docker run -d -p 3300:3300 \
  -e DAKERA_API_KEY=demo \
  ghcr.io/dakera-ai/dakera:latest
```

See [dakera.ai](https://dakera.ai) for more deployment options (bare metal, Kubernetes, etc.).

### 2. Environment variables

```bash
export OPENAI_API_KEY=sk-your-key
export DAKERA_API_URL=http://localhost:3300
export DAKERA_API_KEY=demo         # match DAKERA_API_KEY above
export DAKERA_AGENT_ID=my-agent   # namespace for stored memories
```

## Run

```bash
npm install
npm run dev
```

Run it twice — on the second run the agent recalls everything stored during the first run.

## Architecture

The agent uses two lightweight tools:

| Tool | Purpose | Dakera endpoint |
|------|---------|-----------------|
| `dakera-recall` | Semantic search over all prior memories | `POST /v1/memory/search` |
| `dakera-store` | Persist a new memory for future recall | `POST /v1/memory/store` |

The agent's system prompt instructs it when to call each tool, giving it automatic memory behaviour without any hardcoded application logic.

### Files

```
src/
├── mastra/
│   ├── index.ts          # Mastra + Agent setup
│   └── dakera-tools.ts   # dakeraRecallTool + dakeraStoreTool
└── index.ts              # Example conversation driver
```

## Customise

### Use a different LLM

Replace `openai.languageModel('gpt-4o-mini')` in `src/mastra/index.ts` with any Mastra-supported model.

### Multi-user isolation

Pass a `sessionId` in the tool calls to isolate each user's memories. Dakera scopes memories by `agent_id + session_id`, so different users never see each other's data.

### Combine with Mastra's built-in memory

Mastra's thread/message memory and Dakera serve complementary roles:

- **Mastra memory** — recent conversation history within a thread (short-term, structured)
- **Dakera memory** — semantic long-term memory across all threads and sessions (persistent, decay-weighted)

Both can be active simultaneously.
