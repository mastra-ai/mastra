# Mastra Framework

[![Mastra framework homepage](mastra-homepage.png)](https://mastra.ai)

Mastra lets you prototype and productionize AI features quickly with a modern JS/TS stack.

- **Workflows**: Chain calls to OpenAI, Anthropic, Google. Pipe output between steps. Create graphs with `workflow.addStep()` and `step.connect()`.
- **RAG pipeline**: Sync data into a vector DB (Pinecone). Mastra integrates with 50+ SaaS services, web scrapers, etc.  
- **Agents**: provide OpenAI Assistants with tools, workflows, synced data.

Mastra uses Inngest and Prisma to store and sync data into vector databases. It includes an admin panel for exploring data, a playground for testing actions, a chat UI for agents, and a visual workflow builder with variables, conditions, and branching. 

The setup is completely self- contained and runs on your local machine. In production, you can self-host or deploy to Vercel/Netlify.

## Quick Start

### Prerequisites

- Node.js (version 20 or later)
- pnpm (version 9.7.0 or later)
- Docker (the daemon should be running)

### Installation

1. Install the Mastra CLI:

```console
$ npm install -g mastra
```

2. Initialize your project:

```console
$ mastra init
```

3. Provision local resources:

```console
$ Enter your PostgreSQL connection string (postgresql://username:password@host:port/database) or press Enter to create a new instance:
$ Enter your Inngest server URL or press Enter to create a new instance:
```

## Configuration

After initialization, you'll find an `mastra.config.ts` file in your project root. You can find the full list of configuration options in the [Mastra config docs](./docs/mastra-config.md).

## Deployment

Mastra's data syncing infrastructure is designed for Next.js sites running on serverless hosting providers like Vercel or Netlify. 

Job queues are managed with [Inngest](https://inngest.com/), which can be self-hosted or run as a managed service. 

Logs are stored in [Upstash](https://upstash.com/).

[Full deployment docs](./docs/mastra-config.md) here.

## Commands:

`mastra init`

Initializes a new project.

Run this from the root of the Next.js app you want to add Mastra to. This will create a `mastra.config.ts` file in the root of your project, a `docker-compose.yml` file in the root of your project, and a `.env` file in the root of your project.

`mastra admin`

Starts the admin server

`mastra generate`

Generates types

`mastra migrate`

Migrate the mastra database forward
