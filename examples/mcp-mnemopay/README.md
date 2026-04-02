# MnemoPay + Mastra: AI Agent with Economic Memory

This example demonstrates an AI agent that has **persistent memory** and an **economic system** (wallet + reputation), powered by [MnemoPay](https://github.com/mnemopay) via the Model Context Protocol (MCP).

## What is MnemoPay?

MnemoPay is an SDK that gives AI agents persistent memory and a wallet in a single integration. Agents can remember facts across sessions, charge for valuable work, build reputation through successful transactions, and maintain an immutable audit trail.

## What this example demonstrates

- Connecting a Mastra agent to MnemoPay via MCP (stdio transport)
- Storing and recalling memories semantically
- Charging for delivered work, settling transactions, and building reputation
- The feedback loop: settled payments reinforce recently-accessed memories
- Interactive chat with color-coded tool calls

## Prerequisites

- Node.js 18+
- `mnemopay-sdk` cloned alongside the `mastra` repo (both under the same parent directory)
- OpenAI API key

## Setup

1. **Clone and build mnemopay-sdk** (if not already done):

   ```bash
   cd /path/to/projects
   git clone https://github.com/mnemopay/mnemopay-sdk.git
   cd mnemopay-sdk
   npm install
   npm run build
   ```

2. **Install dependencies** from the mastra repo root:

   ```bash
   cd /path/to/mastra
   pnpm install
   ```

3. **Set up environment variables**:

   ```bash
   cd examples/mcp-mnemopay
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

## Available scripts

| Script | Command | Description |
|--------|---------|-------------|
| `start` | `pnpm start` | Interactive chat with the economic memory agent |
| `demo:memory` | `pnpm demo:memory` | Scripted demo: store, recall, consolidate memories |
| `demo:economic` | `pnpm demo:economic` | Scripted demo: deliver work, charge, settle, earn |
| `dev` | `pnpm dev` | Start Mastra dev server |

## MnemoPay tool reference

The MCP server exposes 12 tools to the agent:

| Tool | Category | Description |
|------|----------|-------------|
| `remember` | Memory | Store a memory with optional importance score and tags |
| `recall` | Memory | Retrieve relevant memories via semantic search |
| `forget` | Memory | Permanently delete a memory by ID |
| `reinforce` | Memory | Boost a memory's importance after a successful outcome |
| `consolidate` | Memory | Prune stale memories whose scores have decayed |
| `charge` | Economic | Create an escrow charge for delivered work |
| `settle` | Economic | Finalize a pending charge, boosting reputation +0.01 |
| `refund` | Economic | Refund a transaction, docking reputation -0.05 |
| `balance` | Economic | Check wallet balance and reputation score |
| `profile` | Status | Full agent stats: reputation, wallet, memory count, tx count |
| `logs` | Status | Immutable audit trail of all actions |
| `history` | Status | Transaction history, most recent first |

## Architecture

```
Mastra Agent (GPT-4o)
    |
    |-- MCPClient (stdio transport)
    |       |
    |       +-- MnemoPay MCP Server (node process)
    |               |
    |               +-- Mnemosyne (memory engine)
    |               +-- AgentPay (wallet + reputation)
    |
    +-- OpenAI API (LLM inference)
```

The `MCPClient` spawns the MnemoPay MCP server as a child process using stdio transport. The agent receives all 12 tools automatically via `mcp.listTools()` and can call them as part of its reasoning. No custom tool definitions needed -- the MCP protocol handles schema discovery.
