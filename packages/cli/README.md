# The Mastra CLI

![Mastra Cli](./mastra-cli.png)

The Mastra CLI enables you to get up and running with mastra quickly. It is not required to use mastra, but helpful for getting started and more advanced use cases.

## Installing the Mastra CLI

```bash copy
npm i -g mastra
```

### Setup

```bash
mastra init
```

## Deployment

Mastra's data syncing infrastructure is designed for Next.js sites running on serverless hosting providers like Vercel or Netlify.

Logs are stored in [Upstash](https://upstash.com/).

[Full deployment docs](./docs/mastra-config.md) here.

## Commands

`mastra init`

This creates a mastra directory under `src` containing an `index.ts` entrypoint and an `agent` directory containing two sample agents.

```text
project-root/
├── src/
   ├── app/
   └── mastra/
       ├── agents/
       │   └── agents.ts
       └── index.ts
```

#### Agents

`mastra agent new`

This creates a new agent.

`mastra agent list`

This lists all available agents.

#### Engine

`mastra engine add`

This installs the `@mastra/engine` dependency to your project.

`mastra engine generate`

Generates the Drizzle database client and TypeScript types.

`mastra engine migrate`

This migrates the database forward. You might need to run this after updating mastra.

`mastra engine up`

This is a shortcut that runs the `docker-compose up` command using the `mastra-pg.docker-compose.yaml` file. This will spin up any local docker containers that mastra needs.

It is useful for cases where you don't have a dockerized `postgres` db setup.

#### Rest Endpoints

`mastra serve`

This spins up `REST` endpoints for all agents and workflows

## Local development

1. clone the repo
2. Run `pnpm i` to install deps
