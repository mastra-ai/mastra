# Mastra Framework

[![Mastra framework homepage](mastra-homepage.png)](https://mastra.ai)

Mastra lets you prototype and productionize AI features quickly with a modern JS/TS stack.

- **Workflows**: Chain calls to OpenAI, Anthropic, Google. Pipe output between steps. Create graphs with `workflow.addStep()` and `step.connect()`.
- **RAG pipeline**: Sync data into a vector DB (Pinecone). Mastra integrates with 50+ SaaS services, web scrapers, etc.
- **Agents**: provide OpenAI Assistants with tools, workflows, synced data.

Mastra uses drizzle to store and sync data into vector databases. It includes an admin panel for exploring data, a playground for testing actions, a chat UI for agents, and a visual workflow builder with variables, conditions, and branching.

The setup is completely self- contained and runs on your local machine. In production, you can self-host or deploy to Vercel/Netlify.

## Quick Start

### Prerequisites

- Node.js (version 20 or later)
- pnpm (version 9.7.0 or later)

### Installation

1. Install the Mastra CLI:

```bash
npm install -g mastra
```

2. Initialize your project:

```bash
mastra init
```

3. Provision local resources:

```bash
Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:
```

## Configuration

## Deployment

Mastra's data syncing infrastructure is designed for Next.js sites running on serverless hosting providers like Vercel or Netlify.

Logs are stored in [Upstash](https://upstash.com/).

[Full deployment docs](./docs/mastra-config.md) here.

## Commands

`mastra init`

Initializes a new project.

`mastra add engine`

Adds the engine to your project.

`mastra engine generate`

Generates Drizzle client

`mastra engine migrate`

Migrate the mastra database forward
